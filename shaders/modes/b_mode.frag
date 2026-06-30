// =============================================================================
// modes/b_mode.frag — Brightness mode. The classic grayscale ultrasound image.
// Each pixel's brightness is the beamformed, attenuated, log-compressed echo
// from that depth. Speckle falls out of the scatterer field for free.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // Beamform along the column the pixel sits in.
    float b = scanLine(uv, uv.x);

    // A faint scan-converter vignette + the gentle warmth of a clinical monitor.
    float vign = smoothstep(1.15, 0.35, length(uv - 0.5));
    b *= mix(0.85, 1.0, vign);

    // Ultrasound grayscale leans slightly warm; pure gray reads as "dead".
    vec3 col = vec3(b);
    col *= vec3(1.04, 1.0, 0.94);

    // Skin line marker at the very top.
    col += vec3(0.25) * smoothstep(0.006, 0.0, uv.y);

    fragColor = vec4(col, 1.0);
}
