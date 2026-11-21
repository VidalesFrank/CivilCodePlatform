from uuid import UUID

from sqlalchemy import Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class ElementForce(Base):
    """Demanda (M3, V2, T) de un elemento en una estación bajo un caso/combo.

    Un XLSX de ETABS trae miles de estos registros (una fila por elemento ×
    estación × combo). Se vinculan al Element por tag (Unique Name de ETABS).
    """

    __tablename__ = "element_forces"
    __table_args__ = (
        Index(
            "ix_element_forces_rev_tag_case_station",
            "building_revision_id",
            "element_tag",
            "output_case",
            "station_m",
        ),
    )

    building_revision_id: Mapped[UUID] = mapped_column(
        ForeignKey("building_revisions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Elemento linkado (nullable si el tag no existe en la revisión).
    element_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("elements.id", ondelete="CASCADE"), index=True, nullable=True
    )
    element_tag: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    output_case: Mapped[str] = mapped_column(String(128), nullable=False)
    # tipos ETABS: "Linear", "Combo", "LinModRitz", "LinRespSpec", "NonlinStatic", ...
    case_type: Mapped[str] = mapped_column(String(32), nullable=False, default="")
    # "Max"/"Min" en envolventes, vacío en combos lineales.
    step_type: Mapped[str] = mapped_column(String(16), nullable=False, default="")

    # Posición a lo largo del elemento desde el nodo I (m).
    station_m: Mapped[float] = mapped_column(Float, nullable=False)

    # Flexión en el plano principal (eje 3 local), kN·m.
    # Convención ETABS: +M3 → fibra inferior en tensión.
    m3_knm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Cortante local eje 2 (kN).
    v2_kn: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # Torsión alrededor del eje longitudinal (kN·m). Normalmente 0 para vigas.
    t_knm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
