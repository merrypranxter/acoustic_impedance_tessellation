#!/usr/bin/env python3
"""
2D acoustic wave propagation by finite differences — the real time-stepping
solver the fragment shaders approximate. Pure standard library (no numpy), so it
runs anywhere; it writes a grayscale PGM you can open in any image viewer.

We integrate the lossy scalar wave equation

    d2p/dt2 = c(x,y)^2 * laplacian(p) - alpha * dp/dt

on a grid where the speed of sound c (and hence impedance, since we hold density
flat) jumps at a horizontal interface. A short Gaussian pulse is launched from
the top "probe" line; you can watch part of it reflect at the interface and part
transmit — exactly the R/T split that makes ultrasound images.

Usage:
    python3 wave_sim.py [--out wavefield.pgm] [--steps 260] [--snapshot 170]

The CFL condition c*dt/dx <= 1/sqrt(2) keeps the explicit scheme stable; we pick
dt from the fastest medium automatically.
"""
import argparse
import math


def build_speed_field(nx, ny):
    """Two-layer medium: slow 'fat-like' top, fast 'muscle/bone-like' bottom.

    Returns c[y][x] in grid units and the interface row. The speed ratio sets
    the impedance mismatch (density held constant), so a real reflection appears
    at the boundary.
    """
    interface = int(ny * 0.55)
    c_top, c_bottom = 0.45, 0.80          # normalized speeds (arbitrary units)
    c = [[c_top if y < interface else c_bottom for x in range(nx)]
         for y in range(ny)]
    return c, interface, c_top, c_bottom


def reflection_coefficient(c1, c2, rho1=1.0, rho2=1.0):
    """Intensity reflection coefficient for a normal-incidence boundary."""
    z1, z2 = rho1 * c1, rho2 * c2
    r = (z2 - z1) / (z2 + z1)
    return r * r


def simulate(nx=200, ny=160, steps=260, alpha=0.012, snapshot=170):
    c, interface, c_top, c_bottom = build_speed_field(nx, ny)

    dx = 1.0
    c_max = max(c_top, c_bottom)
    dt = 0.5 * dx / c_max          # comfortably inside the CFL limit

    # Three pressure fields: previous, current, next.
    prev = [[0.0] * nx for _ in range(ny)]
    cur = [[0.0] * nx for _ in range(ny)]
    nxt = [[0.0] * nx for _ in range(ny)]

    src_x, src_y = nx // 2, 3      # the probe element
    f0 = 0.18                      # source frequency (cycles/step-ish)
    t0 = 16.0                      # pulse center time
    spread = 6.0                   # pulse width

    peak = 0.0
    for n in range(steps):
        # Inject a short Gaussian-modulated sinusoid at the probe.
        env = math.exp(-((n - t0) ** 2) / (2 * spread ** 2))
        cur[src_y][src_x] += 4.0 * env * math.sin(2 * math.pi * f0 * n)

        for y in range(1, ny - 1):
            cur_y = cur[y]
            row_up = cur[y - 1]
            row_dn = cur[y + 1]
            prev_y = prev[y]
            c_y = c[y]
            nxt_y = nxt[y]
            for x in range(1, nx - 1):
                lap = (row_up[x] + row_dn[x] + cur_y[x - 1] + cur_y[x + 1]
                       - 4.0 * cur_y[x])
                cc = c_y[x]
                # Discrete update with linear damping (alpha * dp/dt).
                a = (cc * dt / dx) ** 2
                nxt_y[x] = (2.0 * cur_y[x] - prev_y[x] + a * lap
                            - alpha * (cur_y[x] - prev_y[x]))

        # Damped (Mur-ish) edges to limit box reflections.
        for y in range(ny):
            nxt[y][0] = nxt[y][1] * 0.6
            nxt[y][nx - 1] = nxt[y][nx - 2] * 0.6
        for x in range(nx):
            nxt[0][x] = nxt[1][x] * 0.6
            nxt[ny - 1][x] = nxt[ny - 2][x] * 0.6

        prev, cur, nxt = cur, nxt, prev   # rotate buffers

        if n == snapshot:
            peak = max(abs(v) for row in cur for v in row) or 1.0
            field_snapshot = [row[:] for row in cur]

    if snapshot >= steps:
        field_snapshot = [row[:] for row in cur]
        peak = max(abs(v) for row in cur for v in row) or 1.0

    return field_snapshot, peak, interface, c_top, c_bottom


def write_pgm(path, field, peak, interface):
    """Write a signed pressure field to a PGM: 128 = zero, bright/dark = +/-.
    A faint line marks the impedance interface."""
    ny, nx = len(field), len(field[0])
    with open(path, "wb") as f:
        f.write(b"P5\n%d %d\n255\n" % (nx, ny))
        out = bytearray(nx * ny)
        i = 0
        for y in range(ny):
            row = field[y]
            mark = (y == interface)
            for x in range(nx):
                v = max(-1.0, min(1.0, row[x] / peak))
                g = int(128 + 110 * v)
                if mark and (x % 6 < 3):
                    g = 200
                out[i] = g
                i += 1
        f.write(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", default="wavefield.pgm")
    ap.add_argument("--steps", type=int, default=260)
    ap.add_argument("--snapshot", type=int, default=170)
    args = ap.parse_args()

    field, peak, interface, c_top, c_bottom = simulate(
        steps=args.steps, snapshot=args.snapshot)
    write_pgm(args.out, field, peak, interface)

    R = reflection_coefficient(c_top, c_bottom)
    print(f"simulated {args.steps} steps, snapshot at {args.snapshot}")
    print(f"top speed c1={c_top}, bottom speed c2={c_bottom}")
    print(f"intensity reflection coefficient R = {R:.3f} "
          f"({R * 100:.1f}% reflected, {(1 - R) * 100:.1f}% transmitted)")
    print(f"wrote {args.out} ({len(field[0])}x{len(field)} PGM)")


if __name__ == "__main__":
    main()
