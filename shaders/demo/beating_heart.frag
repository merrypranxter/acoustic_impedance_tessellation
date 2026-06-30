// =============================================================================
// demo/beating_heart.frag — A four-chamber-ish cardiac view through the cycle.
// Myocardial walls (muscle) wrap blood pools that contract and relax. A valve
// flutters. This is the "money shot" of echocardiography, abstracted.
// =============================================================================
#include "../common/uniforms.glsl"
#include "../core/impedance_map.glsl"
#include "../core/wave_equation.glsl"
#include "../core/beam_forming.glsl"

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution;

    // Cardiac cycle phase. Systole = contracted, diastole = filled.
    float t = iTime * 1.2;
    float contract = 0.5 + 0.5 * sin(t * TWO_PI);          // 0..1
    float wallThick = mix(0.045, 0.075, contract);
    float chamberR  = mix(0.20, 0.13, contract);

    // Left and right ventricle pools.
    float lv = sdCircle(uv, vec2(0.40, 0.55), chamberR);
    float rv = sdCircle(uv, vec2(0.64, 0.52), chamberR * 0.8);
    float pool = min(lv, rv);
    float wall = abs(pool) - wallThick;

    // Build a local impedance for this beating geometry.
    float z = Z_LIVER;
    z = mix(z, Z_BLOOD,  smoothstep(0.005, -0.005, pool));   // blood pool
    z = mix(z, Z_MUSCLE, smoothstep(0.005, -0.005, wall));   // myocardium

    // A fluttering mitral valve between the chambers.
    float valveY = 0.55 + 0.03 * sin(t * TWO_PI * 4.0);
    float valve = sdCapsule(uv, vec2(0.46, valveY), vec2(0.56, valveY), 0.006);
    z = mix(z, Z_MUSCLE * 1.2, smoothstep(0.004, -0.004, valve));

    // Reflectivity from this synthetic field, then the usual B-mode pipeline.
    vec2 e = vec2(2.0 / iResolution.y, 0.0);
    // Reuse the global reflectivity for texture/speckle, blend with structure.
    float structR = smoothstep(0.02, 0.0, abs(wall)) * 0.8
                  + smoothstep(0.006, 0.0, abs(valve));
    float echo = (structR + reflectivity(uv) * 0.5)
               * attenuation(uv.y, uProbeFrequency)
               * timeGainCompensation(uv.y) * uGain;
    echo *= beamProfile(uv, uv.x);

    // Anechoic blood pool stays dark.
    echo = mix(echo, 0.02, smoothstep(0.01, -0.01, pool));

    float b = logCompress(echo);
    vec3 col = vec3(b) * vec3(1.04, 1.0, 0.94);
    fragColor = vec4(col, 1.0);
}
