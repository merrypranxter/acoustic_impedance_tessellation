# Examples

Standalone, dependency-free demonstrations of the physics that the main shader
suite renders. These exist so you can read, run, and verify the model without a
GPU or a build step.

## Python (`python/`)

Pure standard library — no numpy, no matplotlib. Runs on any Python 3.8+.

### `wave_sim.py`
The real thing: a 2D finite-difference time-domain (FDTD) solver for the lossy
wave equation, with a speed-of-sound jump that produces a genuine reflection at
the impedance boundary. Writes a PGM snapshot of the pressure field.

```bash
cd examples/python
python3 wave_sim.py --out wavefield.pgm
# -> reports the reflection coefficient and writes a viewable image
```

The fragment shaders use the *pulse-echo approximation* instead of full
time-stepping (it has to run per-pixel, per-frame); this script shows the
ground-truth physics that approximation stands in for.

### `tissue_properties.py`
The acoustic numbers, queryable.

```bash
python3 tissue_properties.py                       # full tissue table
python3 tissue_properties.py --interface fat bone  # reflection at a boundary
python3 tissue_properties.py --attenuation 8 5     # echo loss, 8 cm @ 5 MHz
```

## Shadertoy (`shadertoy/`)

Single-file ports you can paste straight into <https://www.shadertoy.com> — they
use Shadertoy's built-in `iResolution` / `iTime` / `iMouse` and need no
`#include`. Handy for sharing a link or tinkering in a sandbox.

- `b_mode_shadertoy.glsl` — condensed B-mode; drag the mouse to move the focus.
- `color_doppler_shadertoy.glsl` — pulsatile color flow in a vessel.

These are intentionally self-contained duplicates of the modular versions in
`shaders/`; the repo proper keeps the physics factored into `core/` includes.
