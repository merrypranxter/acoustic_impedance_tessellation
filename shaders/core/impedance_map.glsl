// =============================================================================
// core/impedance_map.glsl
// The screen as a 2D tissue phantom. Builds an acoustic-impedance field Z(uv)
// out of layers, organs, vessels, and fine scatterers, then exposes the
// gradients and reflection coefficients the rest of the pipeline reads from.
//
// Requires: common/uniforms.glsl
// =============================================================================

#ifndef IMPEDANCE_MAP_GLSL
#define IMPEDANCE_MAP_GLSL

// ---- Value noise (cheap, tileable-ish) for scatterers and texture ----------
float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i + vec2(0.0, 0.0));
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * valueNoise(p);
        p *= 2.02;
        amp *= 0.5;
    }
    return v;
}

// Smooth disk / capsule helpers for organs and vessels.
float sdCircle(vec2 p, vec2 c, float r) { return length(p - c) - r; }

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

// -----------------------------------------------------------------------------
// impedanceAt: the base impedance field in MRayl, before scatterer micro-texture.
// The structure depends on uTissuePreset so each preset scans a different body.
// -----------------------------------------------------------------------------
float impedanceBase(vec2 uv) {
    float depth = uv.y;

    // Skin / fat / muscle layering near the probe is common to every preset.
    float z = Z_FAT;
    z = mix(z, Z_MUSCLE, smoothstep(0.04, 0.12, depth));   // skin->fat->muscle
    z = mix(z, Z_LIVER,  smoothstep(0.18, 0.30, depth));   // into soft organ bed

    if (uTissuePreset == 0) {
        // ABDOMEN: liver bed with a gallbladder (fluid) and a rib shadowing edge.
        float gall = sdCircle(uv, vec2(0.62, 0.55), 0.10);
        z = mix(z, Z_WATER, smoothstep(0.01, -0.01, gall));        // anechoic fluid
        float rib = sdCircle(uv, vec2(0.20, 0.16), 0.05);
        z = mix(z, Z_BONE, smoothstep(0.01, -0.01, rib));
    } else if (uTissuePreset == 1) {
        // CARDIAC: chamber walls (muscle) wrapping a blood pool.
        float chamber = sdCircle(uv, vec2(0.5, 0.55), 0.26);
        float wall    = abs(chamber) - 0.05;
        z = mix(z, Z_BLOOD,  smoothstep(0.01, -0.01, chamber));     // pool
        z = mix(z, Z_MUSCLE, smoothstep(0.01, -0.01, wall));        // myocardium
    } else if (uTissuePreset == 2) {
        // VASCULAR: a long vessel running laterally with flowing blood.
        float vessel = sdCapsule(uv, vec2(0.1, 0.5), vec2(0.9, 0.46), 0.06);
        z = mix(z, Z_BLOOD, smoothstep(0.01, -0.01, vessel));
    } else if (uTissuePreset == 3) {
        // MUSCULOSKELETAL: muscle slab over a bright bone cortex with shadow.
        z = Z_MUSCLE;
        float bone = uv.y - (0.6 + 0.04 * sin(uv.x * 8.0));
        z = mix(z, Z_BONE, smoothstep(0.0, 0.02, bone));
    } else {
        // OCULAR: fluid-filled globe with a bright lens and posterior wall.
        float globe = sdCircle(uv, vec2(0.5, 0.5), 0.30);
        z = mix(Z_FAT, Z_WATER, smoothstep(0.01, -0.01, globe));    // vitreous
        float lens = sdCircle(uv, vec2(0.5, 0.24), 0.06);
        z = mix(z, Z_MUSCLE, smoothstep(0.01, -0.01, lens));
    }

    return z;
}

// Add fine sub-resolution scatterers — the source of speckle. Returns MRayl.
float impedanceAt(vec2 uv) {
    float z = impedanceBase(uv);
    // Scatterer density scales with frequency: higher MHz resolves finer texture.
    float scale = 90.0 + uProbeFrequency * 22.0;
    float micro = (fbm(uv * scale) - 0.5) * 0.08;
    return max(z + micro, Z_AIR);
}

// Central-difference gradient of the impedance field (per-uv-unit).
vec2 impedanceGradient(vec2 uv) {
    vec2 e = vec2(1.5 / iResolution.y, 0.0);
    float zx = impedanceAt(uv + e.xy) - impedanceAt(uv - e.xy);
    float zy = impedanceAt(uv + e.yx) - impedanceAt(uv - e.yx);
    return vec2(zx, zy) / (2.0 * e.x);
}

// Pressure reflection coefficient at a Z1|Z2 interface (intensity form, [0,1]).
float reflectionCoeff(float z1, float z2) {
    float r = (z2 - z1) / (z2 + z1 + 1e-6);
    return r * r;
}

// Local reflectivity from the impedance gradient — what makes echoes bright.
// Strong, abrupt mismatches (bone, gas, organ capsules) light up.
float reflectivity(vec2 uv) {
    vec2 g = impedanceGradient(uv);
    float z = impedanceAt(uv);
    float dz = length(g);
    return (dz * dz) / ((2.0 * z + dz) * (2.0 * z + dz));
}

// Local speed of sound, interpolated from impedance (rough but useful for TOF).
float speedAt(vec2 uv) {
    float z = impedanceAt(uv);
    // Map MRayl -> m/s monotonically across the soft-tissue/bone range.
    return mix(C_FAT, C_BONE, clamp((z - Z_FAT) / (Z_BONE - Z_FAT), 0.0, 1.0));
}

#endif // IMPEDANCE_MAP_GLSL
