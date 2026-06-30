#!/usr/bin/env python3
"""
Tissue acoustics calculator — the numbers behind the shaders, in one place.

Pure standard library. Prints the master tissue table, the reflection
coefficient for any pair of tissues, and a depth/frequency attenuation budget.
Kept in sync with docs/tissue_properties.md and shaders/common/uniforms.glsl.

Examples:
    python3 tissue_properties.py                       # full table
    python3 tissue_properties.py --interface fat bone  # one boundary
    python3 tissue_properties.py --attenuation 8 5     # 8 cm at 5 MHz
"""
import argparse
from dataclasses import dataclass


@dataclass(frozen=True)
class Tissue:
    name: str
    density: float        # kg/m^3
    speed: float          # m/s
    attenuation: float    # dB/cm/MHz (one-way)

    @property
    def impedance_mrayl(self) -> float:
        return self.density * self.speed / 1e6   # rho*c in MRayl


TISSUES = {
    "air":    Tissue("Air",     1.2,  330,  12.0),
    "lung":   Tissue("Lung",    300,  650,  40.0),
    "fat":    Tissue("Fat",     920,  1450, 0.6),
    "water":  Tissue("Water",   1000, 1480, 0.002),
    "blood":  Tissue("Blood",   1060, 1570, 0.2),
    "kidney": Tissue("Kidney",  1050, 1560, 1.0),
    "liver":  Tissue("Liver",   1060, 1555, 0.9),
    "muscle": Tissue("Muscle",  1060, 1580, 1.5),
    "bone":   Tissue("Bone",    1900, 4080, 20.0),
}


def reflection_coefficient(z1: float, z2: float) -> float:
    """Intensity reflection coefficient at a normal-incidence boundary."""
    r = (z2 - z1) / (z2 + z1)
    return r * r


def print_table() -> None:
    print(f"{'Tissue':9} {'rho':>6} {'c':>6} {'Z (MRayl)':>10} {'att dB/cm/MHz':>14}")
    print("-" * 49)
    for t in TISSUES.values():
        print(f"{t.name:9} {t.density:6.0f} {t.speed:6.0f} "
              f"{t.impedance_mrayl:10.4f} {t.attenuation:14.3f}")


def print_interface(a: str, b: str) -> None:
    t1, t2 = TISSUES[a], TISSUES[b]
    R = reflection_coefficient(t1.impedance_mrayl, t2.impedance_mrayl)
    print(f"{t1.name} (Z={t1.impedance_mrayl:.3f}) -> "
          f"{t2.name} (Z={t2.impedance_mrayl:.3f})")
    print(f"  reflected:   {R * 100:8.3f}%")
    print(f"  transmitted: {(1 - R) * 100:8.3f}%")


def print_attenuation(depth_cm: float, freq_mhz: float, tissue: str = "liver") -> None:
    t = TISSUES[tissue]
    one_way_db = t.attenuation * freq_mhz * depth_cm
    round_trip_db = 2 * one_way_db
    remaining = 10 ** (-round_trip_db / 20)
    print(f"{depth_cm} cm of {t.name} at {freq_mhz} MHz:")
    print(f"  round-trip loss: {round_trip_db:.1f} dB")
    print(f"  echo amplitude remaining: {remaining * 100:.2f}% "
          f"(TGC exists to claw this back)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--interface", nargs=2, metavar=("A", "B"),
                    help="reflection between two tissues, e.g. fat bone")
    ap.add_argument("--attenuation", nargs=2, type=float, metavar=("CM", "MHZ"),
                    help="round-trip attenuation budget")
    args = ap.parse_args()

    if args.interface:
        a, b = (x.lower() for x in args.interface)
        if a not in TISSUES or b not in TISSUES:
            ap.error(f"unknown tissue; choose from {', '.join(TISSUES)}")
        print_interface(a, b)
    elif args.attenuation:
        print_attenuation(args.attenuation[0], args.attenuation[1])
    else:
        print_table()


if __name__ == "__main__":
    main()
