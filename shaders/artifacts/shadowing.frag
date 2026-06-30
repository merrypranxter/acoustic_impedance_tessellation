// =============================================================================
// artifacts/shadowing.frag — Acoustic shadow. A strongly reflecting/absorbing
// structure (bone, calculus, gas) returns almost no sound from behind it, so a
// dark column trails deep to the object. The defining sign of a gallstone or
// kidney stone.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // A bright, hard stone sitting in soft tissue.
    vec2 stoneC = vec2(0.5, 0.34);
    float stone = sdCircle(uv, stoneC, 0.06);

    float b = scanLine(uv, uv.x);

    // March from the probe down this column; if we pass through the stone,
    // attenuate everything deeper (the shadow).
    float shadow = 1.0;
    if (uv.y > stoneC.y) {
        float dx = abs(uv.x - stoneC.x);
        float withinWidth = smoothstep(0.06, 0.03, dx); // shadow as wide as stone
        shadow = mix(1.0, 0.12, withinWidth * smoothstep(stoneC.y, stoneC.y + 0.05, uv.y));
    }

    float bright = b * shadow;
    // The stone's own bright leading edge.
    bright += smoothstep(0.005, -0.005, stone);

    vec3 col = vec3(clamp(bright, 0.0, 1.0)) * vec3(1.04, 1.0, 0.94);
    fragColor = vec4(col, 1.0);
}
