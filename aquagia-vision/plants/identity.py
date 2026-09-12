"""Gestor de identidad individual de plantas en AquaGia Vision."""

from __future__ import annotations

from typing import Dict, List, Optional

from database.models import Plant
from database.repository import VisionRepository


class PlantIdentityManager:
    """Asegura que cada planta posea una identidad persistente y conocida."""

    def __init__(self, repository: VisionRepository):
        self.repo = repository

    def ensure_plants_exist(self, plant_regions_meta: List[Dict[str, Any]]) -> List[Plant]:
        """Garantiza que las plantas detectadas o configuradas existan en la base de datos."""
        plants = []
        for meta in plant_regions_meta:
            pid = meta["plant_id"]
            existing = self.repo.get_plant(pid)
            if not existing:
                plant = Plant(
                    id=pid,
                    species=meta.get("species", "Lactuca sativa"),
                    position=meta.get("name", pid),
                    status="normal",
                    roi_bbox=meta.get("bbox_norm"),
                )
                self.repo.upsert_plant(plant)
                plants.append(plant)
            else:
                if meta.get("bbox_norm") and not existing.roi_bbox:
                    existing.roi_bbox = meta["bbox_norm"]
                    self.repo.upsert_plant(existing)
                plants.append(existing)
        return plants

    def update_status(self, plant_id: str, new_status: str) -> None:
        plant = self.repo.get_plant(plant_id)
        if plant:
            plant.status = new_status
            self.repo.upsert_plant(plant)

    def get_all(self) -> List[Plant]:
        return self.repo.get_all_plants()
