// =============================================================================
// artifacts/reverberation.frag — Multipath echoes. When sound bounces back and
// forth between two strong, parallel reflectors, the scanner mistimes the later
// echoes and paints copies of the interface at regularly spaced, fading depths.
// "Comet tails" and "ring-down" are cousins of this.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // Two strong horizontal interfaces (e.g. a metal/gas surface near the probe).
    float d1 = 0.18;          // first reflector depth
    float gap = 0.12;         // spacing between the bouncing surfaces

    float b = scanLine(uv, uv.x) * 0.6;

    // Stack of decaying repeats below the real interface.
    float reverb = 0.0;
    for (int n = 1; n <= 6; n++) {
        float depth = d1 + gap * float(n);
        float line = exp(-pow((uv.y - depth) / 0.012, 2.0));
        reverb += line * pow(0.6, float(n));      // each bounce loses energy
    }
    // The genuine bright interface itself.
    reverb += exp(-pow((uv.y - d1) / 0.010, 2.0));

    float bright = clamp(b + reverb * uGain, 0.0, 1.0);
    vec3 col = vec3(bright) * vec3(1.04, 1.0, 0.94);

    fragColor = vec4(col, 1.0);
}
