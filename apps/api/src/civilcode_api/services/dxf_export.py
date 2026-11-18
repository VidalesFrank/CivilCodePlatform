"""Generación de DXF para el despiece/cuadro de diseño de vigas.

Un solo DXF con un cuadro tabular por cada viga: sección transversal con
barras arriba/abajo + notación de estribos + resumen de dimensiones.
"""

from __future__ import annotations

import io
import math
from typing import Any

import ezdxf
from ezdxf.enums import TextEntityAlignment


# Diámetros comerciales (mm) — mismo mapping que el worker
BAR_DB = {
    "#3": 9.52,
    "#4": 12.7,
    "#5": 15.9,
    "#6": 19.05,
    "#7": 22.22,
    "#8": 25.4,
}


def _draw_beam_section(
    msp,
    origin: tuple[float, float],
    b_cm: float,
    h_cm: float,
    cover_mm: float,
    bars_top: dict[str, Any],
    bars_bottom: dict[str, Any],
    stirrup_bar: str,
    label: str,
    layer: str = "VIGAS",
) -> None:
    """Dibuja una sección transversal de viga a escala real (cm).

    Origin es la esquina inferior-izquierda. El eje X es b, Y es h.
    """
    x0, y0 = origin

    # Contorno de hormigón
    msp.add_lwpolyline(
        [(x0, y0), (x0 + b_cm, y0), (x0 + b_cm, y0 + h_cm), (x0, y0 + h_cm), (x0, y0)],
        dxfattribs={"layer": layer, "color": 7},
    )

    # Recubrimiento (línea discontinua auxiliar)
    c = cover_mm / 10.0  # cm
    msp.add_lwpolyline(
        [(x0 + c, y0 + c), (x0 + b_cm - c, y0 + c), (x0 + b_cm - c, y0 + h_cm - c), (x0 + c, y0 + h_cm - c), (x0 + c, y0 + c)],
        dxfattribs={"layer": layer, "color": 9, "linetype": "DASHED"},
    )

    # Estribo (rectángulo interior cerca de la cara)
    s = c + 0.5  # inside stirrup center-line ~0.5 cm adentro del recubrimiento
    msp.add_lwpolyline(
        [(x0 + s, y0 + s), (x0 + b_cm - s, y0 + s), (x0 + b_cm - s, y0 + h_cm - s), (x0 + s, y0 + h_cm - s), (x0 + s, y0 + s)],
        dxfattribs={"layer": "ESTRIBOS", "color": 3},
        close=True,
    )

    # Barras longitudinales
    def _place_bars(count: int, bar_name: str, y: float, layer_: str = "BARRAS") -> None:
        if count <= 0:
            return
        db_mm = BAR_DB.get(bar_name, 12.7)
        r_cm = db_mm / 20.0  # mm → cm, radio
        x_start = x0 + c + r_cm + 0.8  # un poco adentro del recubrimiento
        x_end = x0 + b_cm - (c + r_cm + 0.8)
        if count == 1:
            xs = [(x_start + x_end) / 2]
        else:
            step = (x_end - x_start) / (count - 1)
            xs = [x_start + i * step for i in range(count)]
        for x in xs:
            msp.add_circle((x, y), r_cm, dxfattribs={"layer": layer_, "color": 1})

    # Posición vertical de capas (centroides a ~cover + r + 0.3)
    db_top = BAR_DB.get(bars_top["bar"], 12.7) / 20.0
    db_bot = BAR_DB.get(bars_bottom["bar"], 12.7) / 20.0
    y_top = y0 + h_cm - c - 0.6 - db_top
    y_bot = y0 + c + 0.6 + db_bot
    _place_bars(int(bars_top["n"]), bars_top["bar"], y_top)
    _place_bars(int(bars_bottom["n"]), bars_bottom["bar"], y_bot)

    # Texto de etiqueta + datos
    text_x = x0 + b_cm + 3
    text_y = y0 + h_cm
    msp.add_text(
        label,
        dxfattribs={"layer": "TEXTO", "height": 1.5, "color": 7},
    ).set_placement((text_x, text_y), align=TextEntityAlignment.TOP_LEFT)

    msp.add_text(
        f"{int(b_cm)}x{int(h_cm)} cm",
        dxfattribs={"layer": "TEXTO", "height": 1.0, "color": 7},
    ).set_placement((text_x, text_y - 2), align=TextEntityAlignment.TOP_LEFT)

    msp.add_text(
        f"As sup: {bars_top['n']}{bars_top['bar']} ({bars_top['as_prov_cm2']:.2f} cm2)",
        dxfattribs={"layer": "TEXTO", "height": 1.0, "color": 1},
    ).set_placement((text_x, text_y - 4), align=TextEntityAlignment.TOP_LEFT)

    msp.add_text(
        f"As inf: {bars_bottom['n']}{bars_bottom['bar']} ({bars_bottom['as_prov_cm2']:.2f} cm2)",
        dxfattribs={"layer": "TEXTO", "height": 1.0, "color": 1},
    ).set_placement((text_x, text_y - 5.5), align=TextEntityAlignment.TOP_LEFT)

    msp.add_text(
        f"Estribo: E{stirrup_bar}",
        dxfattribs={"layer": "TEXTO", "height": 1.0, "color": 3},
    ).set_placement((text_x, text_y - 7), align=TextEntityAlignment.TOP_LEFT)


def generate_beam_design_dxf(design: dict[str, Any], elements: list[dict[str, Any]]) -> bytes:
    """Genera un DXF con el cuadro de despiece completo del diseño."""
    doc = ezdxf.new(dxfversion="R2010", setup=True)
    doc.layers.add("VIGAS", color=7)
    doc.layers.add("BARRAS", color=1)
    doc.layers.add("ESTRIBOS", color=3)
    doc.layers.add("TEXTO", color=7)
    doc.layers.add("TITULO", color=5)

    msp = doc.modelspace()

    # Título
    name = design.get("name", "Diseño de vigas")
    config = design.get("config", {})
    title = f"{name}  |  f'c={config.get('fc_mpa')} MPa  fy={config.get('fy_mpa')} MPa  rec={config.get('cover_mm')} mm"
    msp.add_text(title, dxfattribs={"layer": "TITULO", "height": 3.0, "color": 5}).set_placement(
        (0, 0), align=TextEntityAlignment.BOTTOM_LEFT
    )

    # Grid de secciones: columnas de 35 cm (sección 30 + label 15 margen)
    col_w = 35.0
    row_h = 40.0
    per_row = 6
    x0 = 0.0
    y0 = -15.0  # debajo del título

    for i, el in enumerate(elements):
        if not el or el.get("error"):
            continue
        row = i // per_row
        col = i % per_row
        ox = x0 + col * col_w
        oy = y0 - row * row_h

        geom = el.get("geom", {})
        cap = el.get("capacity", {})
        shear = el.get("shear") or {}
        stirrup = (shear.get("stirrup") or {}).get("bar", "#3")

        _draw_beam_section(
            msp,
            origin=(ox, oy - geom.get("h_cm", 25)),
            b_cm=float(geom.get("b_cm", 20)),
            h_cm=float(geom.get("h_cm", 25)),
            cover_mm=float(config.get("cover_mm", 40)),
            bars_top=cap.get("bar_apoyo", {"bar": "#3", "n": 2, "as_prov_cm2": 1.4}),
            bars_bottom=cap.get("bar_centro", {"bar": "#3", "n": 2, "as_prov_cm2": 1.4}),
            stirrup_bar=str(stirrup),
            label=f"V-{el.get('tag', '?')}",
        )

    # Serialize a bytes
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")
