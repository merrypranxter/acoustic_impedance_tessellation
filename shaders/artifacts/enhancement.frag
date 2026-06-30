// =============================================================================
// artifacts/enhancement.frag — Posterior acoustic enhancement (through-
// transmission). Fluid attenuates sound far less than soft tissue, so the
// region directly behind a cyst or full bladder comes back brighter than its
// neighbors. The mirror image of shadowing — and a clue that a structure is
// fluid-filled.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // An anechoic fluid cyst.
    vec2 cystC = vec2(0.5, 0.40);
    float cystR = 0.12;
    float cyst = sdCircle(uv, cystC, cystR);

    float b = scanLine(uv, uv.x);

    // Inside the cyst: nearly black (no internal echoes).
    float inside = smoothstep(0.005, -0.005, cyst);
    b = mix(b, 0.02, inside);

    // Behind the cyst: brighten, because less energy was lost crossing fluid.
    float enhance = 1.0;
    if (uv.y > cystC.y) {
        float dx = abs(uv.x - cystC.x);
        float withinWidth = smoothstep(cystR, cystR * 0.4, dx);
        enhance = mix(1.0, 1.9, withinWidth * smoothstep(cystC.y, cystC.y + 0.06, uv.y));
    }

    // The cyst's bright far wall.
    float farWall = smoothstep(0.006, 0.0, abs(cyst)) * step(cystC.y, uv.y);

    float bright = clamp(b * enhance + farWall * 0.6, 0.0, 1.0);
    vec3 col = vec3(bright) * vec3(1.04, 1.0, 0.94);
    fragColor = vec4(col, 1.0);
}
