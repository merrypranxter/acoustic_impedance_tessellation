// =============================================================================
// common/uniforms.glsl
// Shared uniforms, constants, and tissue-property tables.
//
// Every .frag in this repo includes this file first. The WebGL harness
// (web/viewer.js) injects the actual uniform values each frame. The harness
// also prepends `#version 300 es`, a float precision qualifier, and the
// `out vec4 fragColor` declaration, then appends a `main()` that calls your
// `mainImage(out vec4, in vec2)`. So a shader body never declares those.
//
// Coordinate convention:
//   uv = fragCoord / iResolution   -> [0,1] x [0,1]
//   uv.y == 0.0 is the PROBE FACE (skin line) at the top of the image.
//   uv.y == 1.0 is the DEEPEST tissue.
//   "depth" always means uv.y unless stated otherwise.
// =============================================================================

#ifndef UNIFORMS_GLSL
#define UNIFORMS_GLSL

// ---- Harness-provided uniforms ----------------------------------------------
uniform vec2  iResolution;        // viewport size in pixels
uniform float iTime;              // seconds since load
uniform vec4  iMouse;             // xy = current px, zw = click px (Shadertoy-ish)

uniform float uProbeFrequency;    // MHz, 2..15  (higher = finer + shallower)
uniform float uGain;              // overall amplification, ~0..2
uniform float uTGC;               // time-gain compensation, 0..1
uniform float uFocusDepth;        // normalized focus depth, 0..1
uniform float uDynamicRange;      // dB-ish compression, ~20..80
uniform int   uTissuePreset;      // 0 abdomen,1 cardiac,2 vascular,3 musculoskeletal,4 ocular

// ---- Math constants ---------------------------------------------------------
#define PI      3.14159265358979
#define TWO_PI  6.28318530717959

// ---- Acoustic impedance, Z = rho*c, in MRayl (1 MRayl = 1e6 kg/m^2/s) -------
// Matched to the table in README.md / docs/tissue_properties.md.
#define Z_AIR     0.0004
#define Z_FAT     1.33
#define Z_WATER   1.48
#define Z_BLOOD   1.66
#define Z_MUSCLE  1.67
#define Z_LIVER   1.65
#define Z_KIDNEY  1.62
#define Z_BONE    7.75

// Speeds of sound, m/s (used for time-of-flight and refraction flavor).
#define C_AIR     330.0
#define C_FAT     1450.0
#define C_WATER   1480.0
#define C_BLOOD   1570.0
#define C_MUSCLE  1580.0
#define C_BONE    4080.0
#define C_SOFT    1540.0   // the "assumed" speed all scanners calibrate to

#endif // UNIFORMS_GLSL
