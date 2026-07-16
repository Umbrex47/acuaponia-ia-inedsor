from __future__ import annotations

from dataclasses import dataclass


@dataclass
class GrowthState:
    stage: str
    confidence: float
    area_fraction: float


STAGES = ("seedling", "vegetative", "flowering", "harvest_ready")


def estimate_growth_state(
    area_px: int,
    total_plant_area_px: int,
    *,
    seedling_max: float = 0.08,
    vegetative_max: float = 0.35,
    flowering_max: float = 0.65,
) -> GrowthState:
    """Estima etapa por tamaño relativo — sin etiquetas, cámara fija."""
    if total_plant_area_px <= 0:
        return GrowthState("seedling", 0.4, 0.0)

    fraction = area_px / total_plant_area_px

    if fraction <= seedling_max:
        stage = "seedling"
        conf = 0.7 + (seedling_max - fraction) * 0.5
    elif fraction <= vegetative_max:
        stage = "vegetative"
        mid = (seedling_max + vegetative_max) / 2
        conf = 0.75 - abs(fraction - mid) * 0.5
    elif fraction <= flowering_max:
        stage = "flowering"
        mid = (vegetative_max + flowering_max) / 2
        conf = 0.7 - abs(fraction - mid) * 0.4
    else:
        stage = "harvest_ready"
        conf = 0.65 + min((fraction - flowering_max) * 0.3, 0.25)

    return GrowthState(stage, min(max(conf, 0.5), 0.92), round(fraction, 4))
