// =============================================================================
// demo/alien_anatomy.frag — Non-human tissue. The same honest physics, an
// unfamiliar body: nested chitinous shells, a pulsing fluid bladder, radial
// muscle fans, and impossible impedance ratios. Diagnostic ultrasound as
// speculative biology.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;
    vec2 c = uv - vec2(0.5, 0.5);
    float r = length(c);
    float a = atan(c.y, c.x);

    // Concentric chitin shells — bright, hard, evenly spaced rings.
    float shells = abs(sin(r * 34.0 - iTime * 0.6));
    float shellEcho = smoothstep(0.85, 1.0, shells) * smoothstep(0.45, 0.1, r);

    // Radial muscle fans pulsing outward from a core.
    float fans = 0.5 + 0.5 * sin(a * 9.0 + sin(iTime) * 2.0);
    float fanEcho = fans * smoothstep(0.4, 0.15, r) * 0.4;

    // A central fluid bladder that breathes (anechoic, with a bright wall).
    float br = 0.10 + 0.03 * sin(iTime * 1.7);
    float bladder = sdCircle(uv, vec2(0.5, 0.5), br);
    float wallEcho = smoothstep(0.01, 0.0, abs(bladder)) * 0.9;

    float echo = shellEcho + fanEcho + wallEcho + reflectivity(uv) * 0.3;
    echo = mix(echo, 0.02, smoothstep(0.005, -0.005, bladder)); // hollow center

    echo *= attenuation(uv.y, uProbeFrequency)
          * timeGainCompensation(uv.y) * uGain;
    echo *= beamProfile(uv, uv.x);

    float b = logCompress(echo);
    // A faint alien-green cast — wrong tissue, wrong machine.
    vec3 col = vec3(b) * vec3(0.85, 1.05, 0.9);
    fragColor = vec4(col, 1.0);
}
