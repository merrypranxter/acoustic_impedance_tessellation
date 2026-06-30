// =============================================================================
// modes/elastography.frag — Tissue stiffness mapped to color. We estimate a
// Young's-modulus-like field from the impedance map (denser, higher-impedance
// tissue tends to be stiffer) plus a hidden "lesion" that is much stiffer than
// its surroundings — the kind of finding elastography exists to catch.
// Soft = blue, stiff = red (the usual strain-elastography palette).
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

float stiffness(vec2 uv) {
    float z = impedanceBase(uv);
    // Baseline: map soft-tissue impedance to a gentle stiffness gradient.
    float s = smoothstep(Z_FAT, Z_MUSCLE, z) * 0.5;

    // A stiff, suspicious lesion embedded in the soft bed.
    float lesion = sdCircle(uv, vec2(0.40, 0.50), 0.07);
    s = mix(s, 1.0, smoothstep(0.02, -0.01, lesion));

    // Bone-like regions are maximally stiff.
    s = mix(s, 1.0, smoothstep(Z_MUSCLE, Z_BONE, z));

    // A little shear-wave shimmer so it reads as a measurement, not a mask.
    s += 0.03 * sin(uv.y * 60.0 - iTime * 4.0) * smoothstep(0.05, 0.0, abs(lesion));
    return clamp(s, 0.0, 1.0);
}

vec3 elastoColor(float s) {
    // Blue (soft) -> green -> red (stiff), classic strain overlay.
    vec3 soft = vec3(0.0, 0.1, 0.9);
    vec3 mid  = vec3(0.0, 0.9, 0.2);
    vec3 hard = vec3(0.95, 0.1, 0.0);
    return s < 0.5 ? mix(soft, mid, s * 2.0) : mix(mid, hard, (s - 0.5) * 2.0);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    float b = scanLine(uv, uv.x);
    vec3 gray = vec3(b) * vec3(1.04, 1.0, 0.94);

    float s = stiffness(uv);
    vec3 elasto = elastoColor(s);

    // Translucent elastogram over anatomy, like the real split/overlay view.
    vec3 col = mix(gray, elasto, 0.55);

    fragColor = vec4(col, 1.0);
}
