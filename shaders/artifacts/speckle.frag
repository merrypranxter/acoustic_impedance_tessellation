// =============================================================================
// artifacts/speckle.frag — Speckle. Not noise: a deterministic interference
// pattern from sub-resolution scatterers within the resolution cell. It carries
// texture (organs have characteristic speckle) but obscures fine detail. This
// shader isolates and exaggerates it, and shows how spatial compounding /
// averaging tames it.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

// Fully-developed speckle: sum of many randomly-phased scatterer returns within
// the resolution cell, magnitude-detected. Produces the Rayleigh-ish texture.
float speckle(vec2 uv, float cell) {
    vec2 re = vec2(0.0);
    for (int i = 0; i < 12; i++) {
        vec2 jitter = (vec2(hash21(uv * 100.0 + float(i)),
                            hash21(uv * 137.0 - float(i))) - 0.5) * cell;
        float phase = TWO_PI * hash21(floor((uv + jitter) / cell));
        re += vec2(cos(phase), sin(phase));
    }
    return length(re) / 12.0;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // Resolution cell shrinks with frequency -> finer speckle at high MHz.
    float cell = 0.02 * (8.0 / max(uProbeFrequency, 2.0));

    float s = speckle(uv, cell);

    // Right half: spatial compounding (average a few looks) to suppress speckle.
    if (uv.x > 0.5) {
        float acc = 0.0;
        for (int k = 0; k < 4; k++) {
            acc += speckle(uv + vec2(float(k) * 0.5 * cell, 0.0), cell);
        }
        s = acc / 4.0;
    }

    float b = mix(0.15, 0.9, s) * uGain;
    vec3 col = vec3(clamp(b, 0.0, 1.0)) * vec3(1.04, 1.0, 0.94);

    // Divider line between "raw speckle" and "compounded".
    col += vec3(0.15) * smoothstep(0.003, 0.0, abs(uv.x - 0.5));

    fragColor = vec4(col, 1.0);
}
