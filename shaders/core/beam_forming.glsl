// =============================================================================
// core/beam_forming.glsl
// Phased-array transmit/receive. A row of elements along the probe face fire
// with per-element delays so their wavefronts add up at the focus. The same
// geometry defines the beam profile that blurs the image laterally — tight at
// the focus, spreading above and below it (the hourglass).
//
// Requires: common/uniforms.glsl, core/impedance_map.glsl
// =============================================================================

#ifndef BEAM_FORMING_GLSL
#define BEAM_FORMING_GLSL

#define NUM_ELEMENTS 64

// Position of array element i along the probe face (uv space, y = 0).
vec2 probeElement(int i) {
    float x = (float(i) + 0.5) / float(NUM_ELEMENTS);
    return vec2(x, 0.0);
}

// Transmit delay (in normalized time units) applied to element i so all paths
// arrive in phase at the focal point. Classic delay-and-focus law.
float elementDelay(int i, float focusDepth) {
    vec2 e = probeElement(i);
    vec2 focus = vec2(0.5, max(focusDepth, 0.02));
    return distance(e, focus);
}

// Lateral beam width at a given depth — the hourglass. Narrowest at uFocusDepth,
// widening above (near field) and below (far field divergence). Smaller
// wavelength (higher freq) => tighter beam.
float beamWidth(float depth) {
    float waist = 0.010 + 0.004 * (8.0 / max(uProbeFrequency, 2.0));
    float defocus = abs(depth - uFocusDepth);
    return waist + defocus * defocus * 1.6 + depth * 0.012;
}

// Lateral sensitivity of the beam centered on `axis` (x in uv) at this depth.
// Gaussian main lobe; a faint cosine ripple stands in for side lobes.
float beamProfile(vec2 uv, float axis) {
    float w = beamWidth(uv.y);
    float lat = (uv.x - axis) / w;
    float mainLobe = exp(-lat * lat);
    float sideLobe = 0.06 * cos(lat * 6.0) * exp(-abs(lat) * 0.5);
    return clamp(mainLobe + sideLobe, 0.0, 1.0);
}

// Coherent transmit field at a point: sum the array contributions with their
// focusing delays. Reproduces the README's ultrasound_pulse() sketch.
float transmitField(vec2 pos, float t) {
    float wave = 0.0;
    float cycles = uProbeFrequency * 6.0;
    for (int i = 0; i < NUM_ELEMENTS; i++) {
        vec2 e = probeElement(i);
        float delay = elementDelay(i, uFocusDepth);
        float dist = distance(pos, e);
        float phase = TWO_PI * (cycles * (dist) - t * 3.0 - delay * cycles);
        // Aperture apodization (Hann) suppresses side lobes at the edges.
        float ap = 0.5 - 0.5 * cos(TWO_PI * (float(i) + 0.5) / float(NUM_ELEMENTS));
        wave += sin(phase) * ap;
    }
    return wave / float(NUM_ELEMENTS) * beamProfile(pos, 0.5);
}

// One A-line (depth scan) sampled along the vertical beam centered at x = axis.
// Returns the beamformed echo brightness at this fragment.
float scanLine(vec2 uv, float axis) {
    float echo = echoAmplitude(uv) * beamProfile(uv, axis);
    return logCompress(echo);
}

#endif // BEAM_FORMING_GLSL
