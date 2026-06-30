// =============================================================================
// modes/m_mode.frag — Motion mode. A single scan line (chosen by mouse X, or
// screen center) is plotted against time: the X axis is time, the Y axis is
// depth. Moving structures trace wavy bands — exactly how cardiac valve motion
// is measured clinically.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // The fixed interrogation line: mouse X if the user has clicked, else center.
    float lineX = iMouse.z > 0.0 ? iMouse.x / iResolution.x : 0.5;

    // X axis = time. Scroll history leftward; "now" is the right edge.
    float scrollSpeed = 0.15;
    float tSample = iTime - (1.0 - uv.x) / scrollSpeed;

    // Gentle physiologic motion: structures heave with a ~1 Hz "heartbeat",
    // so the sampled depth is shifted by a time-varying displacement.
    float beat = 0.04 * sin(tSample * TWO_PI * 1.1)
               + 0.015 * sin(tSample * TWO_PI * 2.2);
    vec2 sampleUv = vec2(lineX, clamp(uv.y - beat, 0.0, 1.0));

    float b = scanLine(sampleUv, lineX);

    vec3 col = vec3(b) * vec3(1.04, 1.0, 0.94);

    // Time graticule + the bright "live" edge on the right.
    col += vec3(0.06) * step(0.995, fract(uv.x * 8.0));
    col += vec3(0.2) * smoothstep(0.004, 0.0, 1.0 - uv.x);

    fragColor = vec4(col, 1.0);
}
