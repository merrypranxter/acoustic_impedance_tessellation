# acoustic_impedance_tessellation

> Screen-as-tissue ultrasound warp. Sound meets surface, and the surface remembers.

## What This Is

When sound waves hit a boundary between two materials, some reflects and some transmits. The ratio depends on **acoustic impedance** Z = ρc (density × speed of sound). A large impedance mismatch means strong reflection; similar impedances mean clean transmission.

This repo simulates that physics on the screen as a suite of GLSL shaders:
- The screen is a **2D tissue phantom** with varying impedance
- An ultrasound **pulse** propagates through it
- Reflections at boundaries create the **image**
- Speckle, attenuation, and beam spreading add realism

A small WebGL2 viewer (`web/`) lets you scrub through every mode and artifact live, and pure-stdlib Python in `examples/` shows the ground-truth physics with no GPU required.

## Running

The shaders load each other with `#include`, so the viewer must be served over HTTP (a `file://` page can't `fetch` the includes).

```bash
# any static server works; this repo ships an npm shortcut
npm run serve          # -> http://localhost:8080  (uses `npx serve web`)
# or, with nothing installed:
python3 -m http.server 8080 --directory web
```

Open the URL, pick a shader from the panel, and play with probe frequency, gain, TGC, focus depth, and dynamic range. Click the canvas to set the M-mode / Doppler interrogation line.

Validate the shader suite without a GPU:

```bash
npm run check          # node tools/check_shaders.mjs — resolves includes, checks structure
```

Run the physics examples:

```bash
python3 examples/python/wave_sim.py            # FDTD wave sim -> PGM image
python3 examples/python/tissue_properties.py   # tissue table + reflection calculator
```

## Physics Model

### 1. Wave Propagation
```
∂²p/∂t² = c²∇²p - α∂p/∂t
```
Pressure wave with speed c and attenuation α.

### 2. Reflection/Transmission
```
R = ((Z₂ - Z₁)/(Z₂ + Z₁))²  // Reflection coefficient
T = 1 - R                      // Transmission coefficient
```

### 3. Tissue Properties
| Tissue | Density (kg/m³) | Speed (m/s) | Impedance (MRayl) |
|--------|----------------|-------------|-------------------|
| Air | 1.2 | 330 | 0.0004 |
| Fat | 920 | 1450 | 1.33 |
| Water | 1000 | 1480 | 1.48 |
| Muscle | 1060 | 1580 | 1.67 |
| Bone | 1900 | 4080 | 7.75 |

Full table and per-interface reflection coefficients in [`docs/tissue_properties.md`](docs/tissue_properties.md); the model itself is documented in [`docs/ultrasound_physics.md`](docs/ultrasound_physics.md).

## Visual Output

### 1. B-Mode (Brightness Mode)
Standard grayscale ultrasound. The classic "fuzzy" medical image.

### 2. M-Mode (Motion Mode)
One scan line over time. Shows motion of structures.

### 3. Color Doppler
Blood flow direction and velocity mapped to color (red = toward, blue = away).

### 4. Elastography
Tissue stiffness mapped to color. Stiffer = more likely pathological.

### 5. Artifact Showcase
- **Reverberation** — multiple reflections between strong interfaces
- **Shadowing** — bone blocks sound, creating dark regions behind
- **Enhancement** — fluid transmits sound well, brightening behind
- **Refraction** — bending at curved interfaces
- **Speckle** — interference pattern from scattering

## Parameters

| Uniform | Control | Range | Effect |
|---------|---------|-------|--------|
| `uProbeFrequency` | probe frequency | 2–15 MHz | higher = better resolution, less penetration |
| `uTissuePreset` | tissue preset | abdomen / cardiac / vascular / musculoskeletal / ocular | which body is scanned |
| `uGain` | gain | 0–2 | overall amplification |
| `uTGC` | time gain compensation | 0–1 | boost deeper signals (undo attenuation) |
| `uFocusDepth` | focus depth | 0–1 | where the beam is narrowest |
| `uDynamicRange` | dynamic range | 20–80 dB | compression curve for displayed intensities |

## Shader Architecture

Every `.frag` includes `common/uniforms.glsl` then the `core/` modules it needs. The viewer resolves `#include`s, prepends a `#version`/precision header, and appends a `main()` that calls your `mainImage(out vec4, in vec2)` — Shadertoy-style ergonomics with a real module system underneath.

```glsl
// Coherent transmit field — sum the phased-array elements with focusing delays
float transmitField(vec2 pos, float t) {
    float wave = 0.0;
    for (int i = 0; i < NUM_ELEMENTS; i++) {
        vec2 e = probeElement(i);
        float delay = elementDelay(i, uFocusDepth);
        float dist  = distance(pos, e);
        float phase = TWO_PI * (cycles * dist - t * 3.0 - delay * cycles);
        float ap    = 0.5 - 0.5 * cos(TWO_PI * (float(i)+0.5)/float(NUM_ELEMENTS)); // Hann
        wave += sin(phase) * ap;
    }
    return wave / float(NUM_ELEMENTS) * beamProfile(pos, 0.5);
}

// Local reflectivity from the impedance gradient — what makes echoes bright
float reflectivity(vec2 uv) {
    vec2 g = impedanceGradient(uv);
    float Z = impedanceAt(uv);
    float dZ = length(g);
    return (dZ * dZ) / ((2.0*Z + dZ) * (2.0*Z + dZ));
}
```

## Layout

```
acoustic_impedance_tessellation/
├── shaders/
│   ├── common/
│   │   └── uniforms.glsl          # shared uniforms, constants, tissue Z table
│   ├── core/
│   │   ├── wave_equation.glsl     # propagation, attenuation, TGC, log compress
│   │   ├── impedance_map.glsl     # tissue phantom + reflectivity + gradients
│   │   └── beam_forming.glsl      # phased array, focusing, beam profile
│   ├── modes/
│   │   ├── b_mode.frag            # standard grayscale
│   │   ├── m_mode.frag            # motion over time
│   │   ├── color_doppler.frag     # flow velocity
│   │   └── elastography.frag      # stiffness mapping
│   ├── artifacts/
│   │   ├── reverberation.frag     # multipath echoes
│   │   ├── shadowing.frag         # acoustic shadow
│   │   ├── enhancement.frag       # through-transmission bright
│   │   └── speckle.frag           # scattering interference
│   └── demo/
│       ├── beating_heart.frag     # cardiac cycle
│       ├── fetal_scan.frag        # obstetric
│       └── alien_anatomy.frag     # non-human tissue
├── web/                           # WebGL2 viewer (index.html, viewer.js, style.css)
├── examples/
│   ├── python/                    # FDTD wave sim + tissue calculator (stdlib only)
│   └── shadertoy/                 # single-file pasteable ports
├── tools/
│   └── check_shaders.mjs          # static validation of the shader suite
└── docs/
    ├── ultrasound_physics.md
    └── tissue_properties.md
```

## References

- Kremkau (2015). *Diagnostic Ultrasound: Principles and Instruments*
- Jensen (1996). *Estimation of Blood Velocities Using Ultrasound*
- Szabo (2004). *Diagnostic Ultrasound Imaging: Inside Out*

## Related

- `cymatics_sacred` — shared wave-interference visualization
- `bioluminescence_orb` — shared "light through tissue" aesthetic

## Disclaimer

A visualization and teaching toy, not a medical device. The physics is honest but simplified; nothing here is for clinical use.

---

*The screen is flesh. The shader is sound. The image is the space between them.*
