"""Helpers compartidos para diseño de concreto reforzado NSR-10.

Convenciones de unidades:
- fc, fy en MPa.
- Dimensiones en cm (b_cm, h_cm, d_cm).
- Fuerzas en kN, momentos en kN·m.
- Áreas en cm².

Factores:
- phi_flex = 0.90 (C.9.3.2.1)
- phi_shear = 0.75 (C.9.3.2.3)
- phi_axial_tied = 0.65 (columnas con estribos)
- phi_axial_spiral = 0.75 (columnas zunchadas)
"""

from __future__ import annotations

import math

# Barras ASTM/NSR-10 (número = octavos de pulgada, db en mm)
REBAR_DB: list[tuple[str, float]] = [
    ("#3", 9.52),
    ("#4", 12.7),
    ("#5", 15.9),
    ("#6", 19.05),
    ("#7", 22.22),
    ("#8", 25.4),
    ("#9", 28.65),
    ("#10", 32.26),
]

# Factores
PHI_FLEX = 0.90
PHI_SHEAR = 0.75
PHI_AXIAL_TIED = 0.65
PHI_AXIAL_SPIRAL = 0.75
CONCRETE_DENSITY_KG_M3 = 2400.0
GRAVITY = 9.80665


def bar_area_cm2(db_mm: float) -> float:
    r = db_mm / 2.0 / 10.0  # cm
    return math.pi * r * r


def beta1(fc_mpa: float) -> float:
    if fc_mpa <= 28:
        return 0.85
    return max(0.65, 0.85 - 0.05 * (fc_mpa - 28) / 7.0)


def as_min_flex_cm2(fc_mpa: float, fy_mpa: float, b_cm: float, d_cm: float) -> float:
    """As_min para flexión: NSR-10 C.9.6.1.2."""
    ratio = max(0.25 * math.sqrt(fc_mpa) / fy_mpa, 1.4 / fy_mpa)
    return ratio * b_cm * d_cm


def rho_balance(fc_mpa: float, fy_mpa: float) -> float:
    b1 = beta1(fc_mpa)
    return 0.85 * b1 * (fc_mpa / fy_mpa) * (600.0 / (600.0 + fy_mpa))


def rho_max(fc_mpa: float, fy_mpa: float) -> float:
    return 0.75 * rho_balance(fc_mpa, fy_mpa)


def as_req_flex_cm2(
    mu_kNm: float, fc_mpa: float, fy_mpa: float, b_cm: float, d_cm: float
) -> float:
    """As requerido a flexión con rectángulo equivalente.

    Devuelve inf si la sección es insuficiente.
    """
    if mu_kNm <= 0:
        return 0.0
    fy_kNcm2 = fy_mpa / 10.0
    fc_kNcm2 = fc_mpa / 10.0
    mu_kNcm = mu_kNm * 100.0 / PHI_FLEX
    disc = 0.85 * 0.85 - 2.0 * 0.85 * mu_kNcm / max(fc_kNcm2 * b_cm * d_cm * d_cm, 1e-9)
    if disc < 0:
        return float("inf")
    omega = 0.85 - math.sqrt(disc)
    a_over_d = omega / 0.85
    a_cm = a_over_d * d_cm
    return 0.85 * fc_kNcm2 * b_cm * a_cm / fy_kNcm2


def phi_mn_kNm(
    as_cm2: float, fc_mpa: float, fy_mpa: float, b_cm: float, d_cm: float
) -> float:
    if as_cm2 <= 0:
        return 0.0
    fy_kNcm2 = fy_mpa / 10.0
    fc_kNcm2 = fc_mpa / 10.0
    a_cm = as_cm2 * fy_kNcm2 / (0.85 * fc_kNcm2 * b_cm)
    mn_kNcm = as_cm2 * fy_kNcm2 * (d_cm - a_cm / 2.0)
    return PHI_FLEX * mn_kNcm / 100.0


def select_longitudinal_bars(as_req_cm2: float, as_min_cm2: float = 0.0) -> dict:
    """Elige combinación N × barra para cubrir As_req (o As_min)."""
    target = max(as_req_cm2, as_min_cm2)
    if target <= 0 or not math.isfinite(target):
        a = bar_area_cm2(9.52)
        return {"bar": "#3", "n": 2, "as_prov_cm2": round(2 * a, 3)}
    best: dict | None = None
    for bar_name, db_mm in REBAR_DB:
        a = bar_area_cm2(db_mm)
        n = max(2, math.ceil(target / a))
        if n > 12:
            continue
        as_prov = n * a
        over = as_prov - target
        if best is None or over < best["_over"]:
            best = {
                "bar": bar_name,
                "n": n,
                "as_prov_cm2": round(as_prov, 3),
                "_over": over,
            }
        if n <= 6:
            break
    assert best is not None
    best.pop("_over", None)
    return best


def vc_kN(fc_mpa: float, b_cm: float, d_cm: float) -> float:
    """Vc = 0.17*sqrt(fc)*b*d (NSR-10 C.22.5.5), b,d en cm, resultado kN."""
    return 0.17 * math.sqrt(fc_mpa) * (b_cm * 10.0) * (d_cm * 10.0) / 1000.0
