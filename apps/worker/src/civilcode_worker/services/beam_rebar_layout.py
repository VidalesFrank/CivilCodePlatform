"""Despiece longitudinal de una viga continua (BeamGroup) — NSR-10.

Produce el layout de barras corridas + bastones top/bot, cálculo de ganchos,
longitud de desarrollo `ld` y partición en piezas comerciales con traslapos.

Convenciones:
- Posición en coordenadas del grupo (0 → total_length_m) en metros.
- Barras en cm² (as) y diámetros en mm.
- Fuerzas en kN·m y kN.

Referencias NSR-10:
- C.9.6.1.2 As_min
- C.12.2.2  ld = (fy·ψt·ψe)/(1.7·λ·√fc)·db  (SI, mm)
- C.21.5.2  (DES): 2 barras continuas top y bot; As_bottom_apoyo ≥ As_top/4
- C.7.1    Gancho 90°: extensión libre 12·db + doblez 4·db (bars #3-#8)
- C.12.15  Traslapo clase B = 1.3·ld
- Pieza comercial de vareto: 9 m (configurable).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field


# ── Catálogo de barras longitudinales (nombre, db_mm, área_cm²) ─────────────
_BAR_AREA = {
    "#3": (9.525, math.pi * (9.525 / 20) ** 2),
    "#4": (12.70, math.pi * (12.70 / 20) ** 2),
    "#5": (15.875, math.pi * (15.875 / 20) ** 2),
    "#6": (19.05, math.pi * (19.05 / 20) ** 2),
    "#7": (22.225, math.pi * (22.225 / 20) ** 2),
    "#8": (25.40, math.pi * (25.40 / 20) ** 2),
}


def _bar_db(name: str) -> float:
    return _BAR_AREA[name][0]


def _bar_area_cm2(name: str) -> float:
    return _BAR_AREA[name][1]


# Densidad del acero kg/m = 0.00785 × área_mm²  (equivalente a 7850 kg/m³)
def _unit_mass_kg_m(name: str) -> float:
    db = _bar_db(name)
    area_mm2 = math.pi * (db / 2.0) ** 2
    return 7.85e-3 * area_mm2


def _ld_mm(fy_mpa: float, fc_mpa: float, db_mm: float, top: bool) -> float:
    """Longitud de desarrollo NSR-10 C.12.2.2 (barras rectas en tracción).

    Fórmula simplificada:  ld = (fy·ψt·ψe)/(2.1·λ·√fc) · db   [mm]
    - ψt = 1.3 si la barra tiene >30 cm de concreto bajo (top bar)
    - ψt = 1.0 para barras inferiores
    - ψe = 1 (no epoxica)
    - λ  = 1 (normal weight)
    - divisor 2.1 cuando c/db >= 2.5 (zonas con cobertura holgada).
    """
    psi_t = 1.3 if top else 1.0
    return (fy_mpa * psi_t / (2.1 * math.sqrt(fc_mpa))) * db_mm


def _hook_length_mm(db_mm: float) -> float:
    """Gancho 90° NSR-10 C.7.1: extensión libre (12·db) + radio interior (4·db)."""
    return 12.0 * db_mm + 4.0 * db_mm


@dataclass
class BarRun:
    """Un tramo de barra (corrida o bastón) con posición en el grupo."""
    layer: str  # "top" | "bot"
    kind: str  # "continuous" | "baston_apoyo" | "baston_vano"
    bar: str
    n_bars: int
    start_m: float
    end_m: float
    hook_left_mm: float = 0.0
    hook_right_mm: float = 0.0
    notes: str = ""

    @property
    def length_m(self) -> float:
        return max(0.0, self.end_m - self.start_m)

    @property
    def total_length_m(self) -> float:
        return self.length_m + (self.hook_left_mm + self.hook_right_mm) / 1000.0


@dataclass
class CommercialPiece:
    """Pieza comercial cortada a partir de una barra corrida (por reglas 9m)."""
    layer: str
    bar: str
    start_m: float
    end_m: float
    piece_length_m: float
    splice_right: bool = False  # tiene traslapo al final


@dataclass
class RebarLayout:
    group_id: str
    total_length_m: float
    section: dict  # {b_cm, h_cm, d_cm}
    ductility: str
    ld_top_mm: float
    ld_bot_mm: float
    lap_class_B_top_mm: float
    lap_class_B_bot_mm: float
    hook_length_top_mm: float
    hook_length_bot_mm: float
    continuous_top_bar: str
    continuous_bot_bar: str
    continuous_top_count: int
    continuous_bot_count: int
    runs: list[BarRun] = field(default_factory=list)
    commercial_pieces: list[CommercialPiece] = field(default_factory=list)
    stirrup_zones: list[dict] = field(default_factory=list)
    total_steel_kg: float = 0.0
    warnings: list[str] = field(default_factory=list)


def compute_layout(
    group_design: dict,
    config: dict,
    commercial_length_m: float = 9.0,
) -> RebarLayout:
    """Dado el resultado de diseño de un BeamGroup, calcula el despiece.

    `group_design` es el dict que retorna `_design_group()`:
        {group_id, total_length_m, section, spans[], supports_m, ...}
    donde cada span tiene {offset_m, length_m, bar_apoyo, bar_centro, shear, ...}
    """
    fc = float(config.get("fc_mpa", 21.0))
    fy = float(config.get("fy_mpa", 420.0))
    ductility = str(config.get("ductility", "DMO"))

    section = group_design.get("section") or {}
    b_cm = float(section.get("b_cm", 30.0))
    h_cm = float(section.get("h_cm", 50.0))
    d_cm = float(section.get("d_cm", h_cm - 5.0))
    total_L = float(group_design.get("total_length_m", 0.0))
    supports_m = [float(s) for s in (group_design.get("supports_m") or [0.0, total_L])]
    spans = group_design.get("spans") or []

    # ── Dimensionado corrido: toma el calibre máximo entre todos los tramos
    def _bar_rank(name: str) -> int:
        return list(_BAR_AREA.keys()).index(name) if name in _BAR_AREA else -1

    top_bars: list[dict] = [s["bar_apoyo"] for s in spans if s.get("bar_apoyo")]
    bot_bars: list[dict] = [s["bar_centro"] for s in spans if s.get("bar_centro")]

    # Elegir la barra "corrida" como la MENOR de todas las propuestas por tramo
    # (barra continua + bastones adicionales donde haga falta).
    if top_bars:
        continuous_top_bar = min(top_bars, key=lambda b: _bar_rank(b["bar"]))["bar"]
        continuous_top_count = 2  # NSR-10 C.21.5.2 (DES/DMO): mínimo 2 barras continuas
    else:
        continuous_top_bar = "#4"
        continuous_top_count = 2
    if bot_bars:
        continuous_bot_bar = min(bot_bars, key=lambda b: _bar_rank(b["bar"]))["bar"]
        continuous_bot_count = 2
    else:
        continuous_bot_bar = "#4"
        continuous_bot_count = 2

    # Longitud de desarrollo y traslapo
    db_top = _bar_db(continuous_top_bar)
    db_bot = _bar_db(continuous_bot_bar)
    ld_top = _ld_mm(fy, fc, db_top, top=True)
    ld_bot = _ld_mm(fy, fc, db_bot, top=False)
    lap_top = 1.3 * ld_top  # Clase B (conservador)
    lap_bot = 1.3 * ld_bot
    hook_top = _hook_length_mm(db_top)
    hook_bot = _hook_length_mm(db_bot)

    runs: list[BarRun] = []

    # ── Corridas continuas top y bot (toda la longitud + ganchos en extremos)
    runs.append(
        BarRun(
            layer="top",
            kind="continuous",
            bar=continuous_top_bar,
            n_bars=continuous_top_count,
            start_m=0.0,
            end_m=total_L,
            hook_left_mm=hook_top,
            hook_right_mm=hook_top,
            notes="2 barras continuas NSR-10 C.21.5.2",
        )
    )
    runs.append(
        BarRun(
            layer="bot",
            kind="continuous",
            bar=continuous_bot_bar,
            n_bars=continuous_bot_count,
            start_m=0.0,
            end_m=total_L,
            hook_left_mm=hook_bot,
            hook_right_mm=hook_bot,
            notes="2 barras continuas NSR-10 C.21.5.2",
        )
    )

    # ── Bastones top en apoyos: donde el diseño del tramo pide más que la continua
    continuous_top_as = continuous_top_count * _bar_area_cm2(continuous_top_bar)
    continuous_bot_as = continuous_bot_count * _bar_area_cm2(continuous_bot_bar)

    for i, support_m in enumerate(supports_m):
        # Asociar al mayor As entre tramos adyacentes al apoyo
        adj_as_top: list[tuple[int, float, dict]] = []
        for j, sp in enumerate(spans):
            s_start = float(sp.get("offset_m", 0))
            s_end = s_start + float(sp.get("length_m", 0))
            if abs(support_m - s_start) < 1e-3 or abs(support_m - s_end) < 1e-3:
                bar = sp.get("bar_apoyo") or {}
                as_total = bar.get("as_prov_cm2") or 0.0
                adj_as_top.append((j, as_total, bar))
        if not adj_as_top:
            continue
        # As requerido en apoyo = máximo de los tramos adyacentes
        _, as_req_top, bar_data = max(adj_as_top, key=lambda t: t[1])
        extra_as = as_req_top - continuous_top_as
        if extra_as <= 0.01:
            continue
        # Añadir N barras de la misma denominación que la propuesta
        bar_name = bar_data.get("bar", continuous_top_bar)
        extra_n = math.ceil(extra_as / _bar_area_cm2(bar_name))
        # Regla 1/3: extensión Ln/3 a cada lado del apoyo (tomar el min de los tramos adyacentes)
        span_lengths = [float(spans[j].get("length_m", 0)) for j, _, _ in adj_as_top]
        reach_m = max(span_lengths) / 3.0
        start = max(0.0, support_m - reach_m)
        end = min(total_L, support_m + reach_m)
        # Si es apoyo exterior (extremo), añade gancho en el extremo exterior
        hook_l = hook_top if i == 0 and start <= 0.01 else 0.0
        hook_r = hook_top if i == len(supports_m) - 1 and end >= total_L - 0.01 else 0.0
        runs.append(
            BarRun(
                layer="top",
                kind="baston_apoyo",
                bar=bar_name,
                n_bars=extra_n,
                start_m=start,
                end_m=end,
                hook_left_mm=hook_l,
                hook_right_mm=hook_r,
                notes=f"Bastón en apoyo {i + 1} · extensión Ln/3",
            )
        )

    # ── Bastones bot en vanos
    for j, sp in enumerate(spans):
        bar = sp.get("bar_centro") or {}
        as_total = bar.get("as_prov_cm2") or 0.0
        extra = as_total - continuous_bot_as
        if extra <= 0.01:
            continue
        bar_name = bar.get("bar", continuous_bot_bar)
        extra_n = math.ceil(extra / _bar_area_cm2(bar_name))
        s_start = float(sp.get("offset_m", 0))
        s_end = s_start + float(sp.get("length_m", 0))
        # Extensión al menos Ln/5 hacia los apoyos (prácticamente cubre vano central)
        reach_m = max(float(sp.get("length_m", 0)) / 5.0, 0.15)
        start = max(0.0, s_start + reach_m)
        end = min(total_L, s_end - reach_m)
        runs.append(
            BarRun(
                layer="bot",
                kind="baston_vano",
                bar=bar_name,
                n_bars=extra_n,
                start_m=start,
                end_m=end,
                notes=f"Bastón en vano {j + 1} · vano libre",
            )
        )

    # ── Partición en piezas comerciales para las barras continuas
    pieces: list[CommercialPiece] = []

    def _split(run: BarRun, lap_mm: float, commercial_length_m: float) -> list[CommercialPiece]:
        L = run.length_m
        # Para evitar traslapos innecesarios, si L ≤ comercial, 1 pieza
        if L <= commercial_length_m + 0.01:
            return [
                CommercialPiece(
                    layer=run.layer,
                    bar=run.bar,
                    start_m=run.start_m,
                    end_m=run.end_m,
                    piece_length_m=L,
                    splice_right=False,
                )
            ]
        # Varias piezas con traslapo clase B
        out: list[CommercialPiece] = []
        lap_m = lap_mm / 1000.0
        cur = run.start_m
        remaining = L
        while remaining > 0:
            # Pieza = comercial_length_m, donde el solape se cuenta dentro
            piece_len = min(commercial_length_m, remaining + lap_m)
            # Posición útil (sin solape posterior)
            next_cur = cur + (piece_len - lap_m if piece_len < remaining + lap_m else piece_len)
            end = min(cur + piece_len, run.end_m)
            has_splice = end < run.end_m - 0.01
            out.append(
                CommercialPiece(
                    layer=run.layer,
                    bar=run.bar,
                    start_m=cur,
                    end_m=end,
                    piece_length_m=round(piece_len, 3),
                    splice_right=has_splice,
                )
            )
            remaining = total_L - next_cur
            cur = next_cur
            if cur >= run.end_m - 0.01:
                break
        return out

    for run in runs:
        if run.kind != "continuous":
            continue
        pieces.extend(
            _split(run, lap_top if run.layer == "top" else lap_bot, commercial_length_m)
        )

    # ── Zonas de estribos por tramo
    stirrup_zones: list[dict] = []
    for sp in spans:
        sh = sp.get("shear") or {}
        gov = sh.get("governing", "vc")
        stirrup = None
        shd = sh.get(gov) or sh.get("vc") or {}
        stirrup = shd.get("stirrup") if isinstance(shd, dict) else None
        if stirrup is None:
            continue
        s_start = float(sp.get("offset_m", 0))
        s_end = s_start + float(sp.get("length_m", 0))
        l_conf_m = (stirrup.get("l_conf_cm") or 0.0) / 100.0
        s_conf = stirrup.get("s_conf_cm") or stirrup.get("s_gen_cm")
        s_gen = stirrup.get("s_gen_cm")
        bar = stirrup.get("bar")
        stirrup_zones.append({
            "span_offset_m": round(s_start, 3),
            "span_end_m": round(s_end, 3),
            "bar": bar,
            "zone_conf_left_m": [round(s_start, 3), round(min(s_start + l_conf_m, s_end), 3)],
            "zone_conf_right_m": [round(max(s_end - l_conf_m, s_start), 3), round(s_end, 3)],
            "spacing_confined_cm": s_conf,
            "spacing_general_cm": s_gen,
            "governing": gov,
        })

    # ── Peso total de acero
    total_kg = 0.0
    for run in runs:
        um = _unit_mass_kg_m(run.bar)
        total_kg += run.n_bars * run.total_length_m * um
    # Estribos: longitud por estribo = 2*(b+h) - 8*cover + 2*hook ≈ perímetro útil
    cover_m = 0.04
    perim_m = 2 * (b_cm / 100.0 - 2 * cover_m) + 2 * (h_cm / 100.0 - 2 * cover_m) + 0.15
    for z in stirrup_zones:
        if not z.get("bar"):
            continue
        um_st = _unit_mass_kg_m(z["bar"])
        s_start = float(z["span_offset_m"])
        s_end = float(z["span_end_m"])
        # Zonas confinadas + general
        l_conf_total = max(0, z["zone_conf_left_m"][1] - z["zone_conf_left_m"][0]) + max(
            0, z["zone_conf_right_m"][1] - z["zone_conf_right_m"][0]
        )
        l_gen = max(0.0, (s_end - s_start) - l_conf_total)
        n_conf = (l_conf_total * 100.0) / max(z.get("spacing_confined_cm") or 15.0, 5.0) if l_conf_total > 0 else 0
        n_gen = (l_gen * 100.0) / max(z.get("spacing_general_cm") or 20.0, 5.0) if l_gen > 0 else 0
        total_kg += (n_conf + n_gen) * perim_m * um_st

    warnings: list[str] = []
    # Chequeos NSR-10
    if ductility == "DES":
        # 2 barras continuas top y bot — ya cubierto por diseño
        # As_bot_apoyo ≥ As_top_apoyo/4
        for i, sp in enumerate(spans):
            bar_a = sp.get("bar_apoyo") or {}
            bar_c = sp.get("bar_centro") or {}
            as_top_a = bar_a.get("as_prov_cm2") or 0.0
            as_bot_a = continuous_bot_as  # bot corrida en apoyo
            if as_bot_a < as_top_a / 4.0:
                warnings.append(
                    f"T{i + 1}: As bot en apoyo ({as_bot_a:.2f}) < As top / 4 ({as_top_a / 4:.2f}). NSR-10 C.21.5.2.2."
                )

    return RebarLayout(
        group_id=str(group_design.get("group_id", "")),
        total_length_m=total_L,
        section={"b_cm": b_cm, "h_cm": h_cm, "d_cm": d_cm},
        ductility=ductility,
        ld_top_mm=round(ld_top, 1),
        ld_bot_mm=round(ld_bot, 1),
        lap_class_B_top_mm=round(lap_top, 1),
        lap_class_B_bot_mm=round(lap_bot, 1),
        hook_length_top_mm=round(hook_top, 1),
        hook_length_bot_mm=round(hook_bot, 1),
        continuous_top_bar=continuous_top_bar,
        continuous_bot_bar=continuous_bot_bar,
        continuous_top_count=continuous_top_count,
        continuous_bot_count=continuous_bot_count,
        runs=runs,
        commercial_pieces=pieces,
        stirrup_zones=stirrup_zones,
        total_steel_kg=round(total_kg, 2),
        warnings=warnings,
    )


def layout_to_dict(layout: RebarLayout) -> dict:
    return {
        "group_id": layout.group_id,
        "total_length_m": round(layout.total_length_m, 3),
        "section": layout.section,
        "ductility": layout.ductility,
        "ld_top_mm": layout.ld_top_mm,
        "ld_bot_mm": layout.ld_bot_mm,
        "lap_class_B_top_mm": layout.lap_class_B_top_mm,
        "lap_class_B_bot_mm": layout.lap_class_B_bot_mm,
        "hook_length_top_mm": layout.hook_length_top_mm,
        "hook_length_bot_mm": layout.hook_length_bot_mm,
        "continuous_top": {
            "bar": layout.continuous_top_bar,
            "n_bars": layout.continuous_top_count,
        },
        "continuous_bot": {
            "bar": layout.continuous_bot_bar,
            "n_bars": layout.continuous_bot_count,
        },
        "runs": [
            {
                "layer": r.layer,
                "kind": r.kind,
                "bar": r.bar,
                "n_bars": r.n_bars,
                "start_m": round(r.start_m, 3),
                "end_m": round(r.end_m, 3),
                "length_m": round(r.length_m, 3),
                "hook_left_mm": round(r.hook_left_mm, 1),
                "hook_right_mm": round(r.hook_right_mm, 1),
                "notes": r.notes,
            }
            for r in layout.runs
        ],
        "commercial_pieces": [
            {
                "layer": p.layer,
                "bar": p.bar,
                "start_m": round(p.start_m, 3),
                "end_m": round(p.end_m, 3),
                "piece_length_m": p.piece_length_m,
                "splice_right": p.splice_right,
            }
            for p in layout.commercial_pieces
        ],
        "stirrup_zones": layout.stirrup_zones,
        "total_steel_kg": layout.total_steel_kg,
        "warnings": layout.warnings,
    }
