"""Memoria de cálculo en PDF para un BeamDesign."""

from __future__ import annotations

import io
from datetime import datetime
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)


def _styles() -> dict[str, ParagraphStyle]:
    s = getSampleStyleSheet()
    cc_blue = colors.HexColor("#1E6FE8")
    cc_navy = colors.HexColor("#0B1E3F")
    styles = {
        "title": ParagraphStyle(
            "title",
            parent=s["Title"],
            textColor=cc_navy,
            fontSize=20,
            leading=24,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=s["Normal"],
            textColor=cc_blue,
            fontSize=11,
            leading=14,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=s["Heading2"],
            textColor=cc_navy,
            fontSize=14,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "normal": s["Normal"],
        "small": ParagraphStyle("small", parent=s["Normal"], fontSize=8, leading=10),
    }
    return styles


def _header(elements_out: list, styles: dict, design: dict) -> None:
    name = design.get("name", "Diseño de vigas")
    config = design.get("config") or {}
    elements_out.append(Paragraph("CivilCode Studio", styles["subtitle"]))
    elements_out.append(Paragraph(f"Memoria de diseño — {name}", styles["title"]))
    today = datetime.now().strftime("%Y-%m-%d %H:%M")
    elements_out.append(
        Paragraph(
            f"Fecha de emisión: {today}  ·  Norma: NSR-10 (flexión + cortante simplificado)",
            styles["small"],
        )
    )
    elements_out.append(Spacer(1, 10))

    data = [
        ["f'c (MPa)", str(config.get("fc_mpa", "—"))],
        ["fy (MPa)", str(config.get("fy_mpa", "—"))],
        ["Recubrimiento (mm)", str(config.get("cover_mm", "—"))],
        ["Ductilidad", str(config.get("ductility", "—"))],
        ["Carga viva (kN/m²)", str(config.get("live_load_kN_m2", "—"))],
        ["Carga muerta extra (kN/m²)", str(config.get("dead_extra_kN_m2", "—"))],
        ["Ancho aferente (m)", str(config.get("tributary_width_m", "—"))],
    ]
    t = Table(data, colWidths=[70 * mm, 50 * mm])
    t.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#ECF1F7")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#0B1E3F")),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#BDC9D9")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements_out.append(t)
    elements_out.append(Spacer(1, 12))


def _summary_block(elements_out: list, styles: dict, summary: dict) -> None:
    elements_out.append(Paragraph("Resumen global", styles["h2"]))
    data = [
        ["N° de vigas diseñadas", str(summary.get("n_elements", 0))],
        ["Vigas OK (sin warnings)", f"{summary.get('n_elements_ok', 0)}/{summary.get('n_elements', 0)}"],
        ["Longitud total de vigas (m)", f"{summary.get('total_length_m', 0):.2f}"],
        ["As prom. apoyo (cm²)", f"{summary.get('total_as_top_cm2_avg', 0):.2f}"],
        ["As prom. centro (cm²)", f"{summary.get('total_as_bot_cm2_avg', 0):.2f}"],
        ["Warnings totales", str(summary.get("total_warnings", 0))],
    ]
    t = Table(data, colWidths=[90 * mm, 50 * mm])
    t.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 9),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#ECF1F7")),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#BDC9D9")),
            ]
        )
    )
    elements_out.append(t)
    elements_out.append(Spacer(1, 12))


def _rebar_schedule(elements_out: list, styles: dict, elems: list[dict]) -> None:
    elements_out.append(Paragraph("Cuadro de despiece", styles["h2"]))
    head = [
        "Tag",
        "Sección",
        "L (m)",
        "wu (kN/m)",
        "Mu⁻\n(kN·m)",
        "Barra\napoyo",
        "φMn⁻",
        "Barra\ncentro",
        "φMn+",
        "Vu",
        "Estribo",
        "φVn",
        "Chk",
    ]
    data = [head]
    for e in elems:
        if not e or e.get("error"):
            continue
        geom = e.get("geom") or {}
        loads = e.get("loads") or {}
        dem = e.get("demands") or {}
        cap = e.get("capacity") or {}
        sh = e.get("shear") or {}
        stir = sh.get("stirrup") or {}
        data.append(
            [
                str(e.get("tag", "—")),
                (e.get("section_name") or "—")[:28],
                f"{geom.get('length_m', 0):.2f}",
                f"{loads.get('wu_kN_m', 0):.2f}",
                f"{dem.get('mu_apoyo_kNm', 0):.2f}",
                f"{cap.get('bar_apoyo', {}).get('n', '—')}{cap.get('bar_apoyo', {}).get('bar', '')}",
                f"{cap.get('phi_mn_apoyo_kNm', 0):.2f}",
                f"{cap.get('bar_centro', {}).get('n', '—')}{cap.get('bar_centro', {}).get('bar', '')}",
                f"{cap.get('phi_mn_centro_kNm', 0):.2f}",
                f"{sh.get('vu_at_d_kN', 0):.2f}",
                (
                    f"E{stir.get('bar', '#3')} @{stir.get('s_gen_cm', 0)}cm"
                    if sh.get("needs_stirrups")
                    else f"E{stir.get('bar', '#3')} min"
                ),
                f"{stir.get('phi_vn_kN', 0):.2f}",
                "OK" if e.get("ok") else "!",
            ]
        )
    t = Table(data, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("FONT", (0, 0), (-1, -1), "Helvetica", 7),
                ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 7),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E6FE8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#BDC9D9")),
                ("ALIGN", (2, 1), (-2, -1), "RIGHT"),
                ("ALIGN", (-1, 1), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7F9FC")]),
            ]
        )
    )
    elements_out.append(t)
    elements_out.append(Spacer(1, 10))


def _warnings_block(elements_out: list, styles: dict, elems: list[dict]) -> None:
    wlist: list[str] = []
    for e in elems:
        tag = e.get("tag", "?")
        for w in e.get("warnings", []) or []:
            wlist.append(f"V-{tag}: {w}")
    if not wlist:
        return
    elements_out.append(PageBreak())
    elements_out.append(Paragraph("Advertencias", styles["h2"]))
    for w in wlist[:300]:  # cap
        elements_out.append(Paragraph(w, styles["small"]))
    elements_out.append(Spacer(1, 8))


def generate_beam_design_pdf(design: dict[str, Any], summary: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        title=f"Memoria - {design.get('name', 'Viga')}",
        author="CivilCode Studio",
    )
    styles = _styles()
    story: list = []

    _header(story, styles, design)
    _summary_block(story, styles, summary)
    _rebar_schedule(story, styles, summary.get("elements") or [])
    _warnings_block(story, styles, summary.get("elements") or [])

    doc.build(story)
    return buf.getvalue()
