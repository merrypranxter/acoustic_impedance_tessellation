// =============================================================================
// demo/fetal_scan.frag — An obstetric profile view. A fetus curled in anechoic
// amniotic fluid: bright bony skull and spine, soft body, a flickering heart.
// The image everyone recognizes, rendered from impedance and echo.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // Amniotic fluid fills the frame (dark), uterine wall as a bright arc.
    float wall = abs(length(uv - vec2(0.5, 0.55)) - 0.46) - 0.02;

    // Fetal head (skull = bright ring of bone, brain = soft inside).
    vec2 headC = vec2(0.40, 0.40);
    float skull = abs(sdCircle(uv, headC, 0.12)) - 0.012;     // bony rim
    float brain = sdCircle(uv, headC, 0.10);

    // Curled body + a hint of spine (string of bright vertebrae).
    float body = sdCapsule(uv, vec2(0.48, 0.50), vec2(0.66, 0.66), 0.09);
    float spine = sdCapsule(uv, vec2(0.50, 0.52), vec2(0.64, 0.64), 0.006);
    float vert = spine + 0.01 * sin(uv.x * 120.0 + uv.y * 120.0);

    // Tiny flickering heart inside the chest.
    float beat = 0.006 * (0.5 + 0.5 * sin(iTime * TWO_PI * 2.4));
    float heart = sdCircle(uv, vec2(0.55, 0.57), 0.012 + beat);

    // Assemble reflectivity from structures.
    float echo = 0.0;
    echo += smoothstep(0.012, 0.0, abs(skull)) * 1.0;        // skull, very bright
    echo += smoothstep(0.012, 0.0, abs(wall))  * 0.5;        // uterine wall
    echo += smoothstep(0.09,  0.0, body)       * 0.18;       // soft body
    echo += smoothstep(0.10,  0.0, brain)      * 0.10;       // brain tissue
    echo += smoothstep(0.006, 0.0, abs(vert))  * 0.9;        // vertebrae
    echo += smoothstep(0.012, 0.0, abs(heart)) * 0.8;        // heartbeat fleck
    echo += reflectivity(uv) * 0.25;                         // speckle texture

    echo *= attenuation(uv.y, uProbeFrequency)
          * timeGainCompensation(uv.y) * uGain;
    echo *= beamProfile(uv, uv.x);

    float b = logCompress(echo);
    vec3 col = vec3(b) * vec3(1.04, 1.0, 0.94);
    fragColor = vec4(col, 1.0);
}
