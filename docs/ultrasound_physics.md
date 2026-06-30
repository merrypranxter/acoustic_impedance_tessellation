# Ultrasound Physics

A working reference for the model implemented in `shaders/core/`. Everything
here is what the shaders approximate — close enough to be honest, simple enough
to run per-pixel in real time.

## 1. The wave

Ultrasound is a longitudinal pressure wave. In a lossy medium it obeys

```
∂²p/∂t² = c²∇²p − α ∂p/∂t
```

- `p` — acoustic pressure
- `c` — speed of sound in the medium (m/s)
- `α` — attenuation coefficient

Diagnostic frequencies run **2–15 MHz**. Wavelength λ = c / f; at 1540 m/s and
5 MHz, λ ≈ 0.31 mm — and axial resolution is roughly half a wavelength, which is
why higher frequency means finer images.

In `core/wave_equation.glsl` we don't time-step this PDE per frame (that needs a
ping-pong grid — see `examples/python/wave_sim.py` for the real FDTD solver).
Instead we use the **pulse-echo** approximation that B-mode reconstruction
itself assumes: a short pulse goes down, echoes come back, and brightness at a
depth is the echo strength from that depth.

## 2. Acoustic impedance

The single most important quantity here:

```
Z = ρ · c        [rayl = kg·m⁻²·s⁻¹];  clinical unit MRayl = 1e6 rayl
```

It's the resistance a medium offers to the pressure wave. Images exist because
**Z changes** from tissue to tissue.

## 3. Reflection and transmission

At a flat boundary between media of impedance `Z₁` and `Z₂`, the **pressure
reflection coefficient** is

```
R = ((Z₂ − Z₁) / (Z₂ + Z₁))²
T = 1 − R
```

- Tiny mismatch (fat↔muscle, R ≈ 0.01) → most sound transmits, faint echo.
- Huge mismatch (tissue↔bone R ≈ 0.43, tissue↔air R ≈ 0.999) → almost total
  reflection. This is why **gel** is needed (to exclude air) and why bone and
  gas cast shadows: nothing is left to image what's behind them.

In `impedance_map.glsl`, `reflectivity()` derives the local echo strength from
the **gradient** of the impedance field — a boundary is where Z changes fast.

## 4. Attenuation

Sound loses amplitude with depth to absorption and scattering. In soft tissue a
good rule of thumb is

```
≈ 0.5 dB / cm / MHz   (one-way)
```

Round trip doubles the path, so deeper and higher-frequency echoes are far
weaker. **Time-Gain Compensation (TGC)** brightens later (deeper) echoes to undo
this — `timeGainCompensation()` in `wave_equation.glsl`.

## 5. Beam forming

A modern probe is a **phased array** of dozens to hundreds of elements. Firing
them with staggered **delays** steers and focuses the beam:

```
delay(i) = (|element_i − focus|) / c
```

so all wavefronts arrive in phase at the focal point. The beam is an hourglass —
narrowest at the focus, spreading above and below — which sets the **lateral
resolution** and varies it with depth. **Apodization** (tapering element
amplitudes, e.g. a Hann window) suppresses **side lobes**, the off-axis ghosts
that smear bright targets sideways. See `core/beam_forming.glsl`.

## 6. Log compression

Echo intensities span an enormous range. To fit a display, scanners apply
**logarithmic (dB) compression** over a selectable **dynamic range**:

```
brightness = clamp((20·log₁₀(echo) + DR) / DR, 0, 1)
```

Small DR → high-contrast, "punchy" image; large DR → smooth, many grays. This
single curve is most of why ultrasound has its characteristic look.
`logCompress()` implements it.

## 7. Where artifacts come from

Every artifact in `shaders/artifacts/` is the physics above, misread by an
instrument that assumes a constant speed of sound (1540 m/s) and a single
straight-line path:

| Artifact      | Cause                                                        |
|---------------|--------------------------------------------------------------|
| Reverberation | Sound ping-ponging between two strong reflectors             |
| Shadowing     | A strong reflector/absorber starves everything behind it     |
| Enhancement   | Low-attenuation fluid lets extra energy through → bright behind |
| Refraction    | Speed change bends the beam; the echo is mismapped laterally |
| Speckle       | Coherent interference of sub-resolution scatterers           |

Artifacts are not failures — half of them are diagnostic signs.

## References

- Kremkau (2015). *Diagnostic Ultrasound: Principles and Instruments.*
- Szabo (2004). *Diagnostic Ultrasound Imaging: Inside Out.*
- Jensen (1996). *Estimation of Blood Velocities Using Ultrasound.*
- Cobbold (2007). *Foundations of Biomedical Ultrasound.*
