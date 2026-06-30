# Tissue Properties

Reference values used throughout the repo. The `#define`s in
`shaders/common/uniforms.glsl` and the table in `examples/python/tissue_properties.py`
are kept in sync with this file. Values are typical adult soft-tissue figures
at body temperature; sources disagree at the ~few-percent level, which is fine
for a simulator.

## Master table

| Tissue   | Density ρ (kg/m³) | Speed c (m/s) | Impedance Z = ρc (MRayl) | Atten. (dB/cm/MHz) |
|----------|-------------------|---------------|--------------------------|--------------------|
| Air      | 1.2               | 330           | 0.0004                   | 12 (huge)          |
| Lung     | 300               | 650           | 0.195                    | ~40                |
| Fat      | 920               | 1450          | 1.33                     | 0.6                |
| Water    | 1000              | 1480          | 1.48                     | 0.002              |
| Blood    | 1060              | 1570          | 1.66                     | 0.2                |
| Kidney   | 1050              | 1560          | 1.62                     | 1.0                |
| Liver    | 1060              | 1555          | 1.65                     | 0.9                |
| Muscle   | 1060              | 1580          | 1.67                     | 1.0–3.3 (anisotropic) |
| Bone     | 1900              | 4080          | 7.75                     | 20                 |

The scanner assumes a single calibration speed of **1540 m/s** ("soft tissue
average") for all depth math. Every place real tissue deviates from that is a
place an artifact is born.

## Reflection coefficients at key interfaces

`R = ((Z₂ − Z₁)/(Z₂ + Z₁))²`, as a percentage of incident **intensity**.

| Interface       | R (%)   | Consequence                                  |
|-----------------|---------|----------------------------------------------|
| Fat ↔ Muscle    | 0.9     | faint, normal soft-tissue echoes             |
| Fat ↔ Liver     | 1.2     | organ boundaries visible but gentle          |
| Muscle ↔ Bone   | 41      | bright cortex, then shadow                   |
| Soft tissue ↔ Air | 99.9  | total reflection → need gel; gas shadows     |
| Blood ↔ Vessel wall | 0.1 | lumen is nearly anechoic (dark)              |

## Imaging presets

The `uTissuePreset` uniform (0–4) selects the phantom built in
`impedance_map.glsl`:

| # | Preset           | Typical probe | What's in the phantom                         |
|---|------------------|---------------|-----------------------------------------------|
| 0 | abdomen          | 2–5 MHz curved | liver bed, gallbladder (fluid), rib shadow    |
| 1 | cardiac          | 2–4 MHz phased | ventricle walls + blood pool, fluttering valve |
| 2 | vascular         | 5–12 MHz linear | a lateral vessel with pulsatile flow          |
| 3 | musculoskeletal  | 7–15 MHz linear | muscle slab over a bright bone cortex         |
| 4 | ocular           | 10–15 MHz linear | fluid-filled globe, bright lens              |

Lower frequency penetrates deep (abdomen, cardiac); higher frequency resolves
fine, shallow structure (vascular, MSK, ocular) — the fundamental trade-off.

## Why these numbers matter on screen

- **Impedance** sets *how bright* a boundary is (`reflectivity`).
- **Speed** sets *where* a structure appears in depth (time-of-flight), and its
  mismatch causes **refraction**.
- **Attenuation** sets *how dark things get with depth*, which **TGC** fights.
- **Density** is here mostly to compute Z, but also weights scattering.
