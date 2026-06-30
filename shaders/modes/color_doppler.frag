// =============================================================================
// modes/color_doppler.frag — Flow velocity overlaid on B-mode. The Doppler
// shift of echoes from moving blood is mapped to color: red toward the probe,
// blue away (the "BART" convention: Blue Away, Red Toward). Only voxels inside
// vessels (low impedance, blood) carry a flow signal.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

// A synthetic flow field: pulsatile velocity along the vessel axis.
float flowVelocity(vec2 uv) {
    // Blood lives where impedance is near Z_BLOOD.
    float z = impedanceBase(uv);
    float isBlood = smoothstep(0.06, 0.0, abs(z - Z_BLOOD));
    if (isBlood < 0.01) return 0.0;

    // Pulsatile waveform (systolic spike + diastolic tail), ~1.1 Hz.
    float t = iTime * 1.1;
    float pulse = max(sin(t * TWO_PI), 0.0);
    pulse = pulse * pulse * 0.8 + 0.2;

    // Parabolic (laminar) profile across the vessel + a flow direction sign
    // that depends on which half of the screen we're in (toward vs away).
    float lateral = sin(uv.x * PI);            // fast in the middle of the lumen
    float dir = sign(0.5 - uv.y);              // upper half flows up = toward
    return isBlood * pulse * lateral * dir;
}

vec3 dopplerColor(float v) {
    // v in [-1,1]. Toward (+) = red/yellow, away (-) = blue/cyan.
    float m = clamp(abs(v), 0.0, 1.0);
    vec3 toward = mix(vec3(0.5, 0.0, 0.0), vec3(1.0, 1.0, 0.0), m); // red->yellow
    vec3 away   = mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 1.0, 1.0), m); // blue->cyan
    return v >= 0.0 ? toward : away;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // Grayscale anatomy underneath.
    float b = scanLine(uv, uv.x);
    vec3 col = vec3(b) * vec3(1.04, 1.0, 0.94);

    // Color flow overlay inside the Doppler "box" (here: full frame).
    float v = flowVelocity(uv);
    if (abs(v) > 0.02) {
        vec3 flow = dopplerColor(v);
        col = mix(col, flow, clamp(abs(v) * 1.4, 0.0, 0.85));
    }

    fragColor = vec4(col, 1.0);
}
