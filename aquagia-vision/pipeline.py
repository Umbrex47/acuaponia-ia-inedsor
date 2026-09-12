"""Pipeline maestro orquestador de AquaGia Vision."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from analysis.color import extract_color_metrics
from analysis.growth import calculate_growth_rate
from analysis.health import evaluate_plant_health
from analysis.leaves import estimate_leaf_metrics
from database.models import PlantObservation
from database.repository import VisionRepository
from decision.model import DecisionEngine, DecisionResult
from detection.detector import BasePlantDetector, DetectedPlantRegion, FixedRoiDetector
from detection.yolo import YoloPlantDetector
from plants.history import PlantHistoryManager
from plants.identity import PlantIdentityManager
from segmentation.opencv import segment_vegetation
from segmentation.plantcv import extract_phenotype_features

logger = logging.getLogger("AquaGiaVision.Pipeline")


class AquaGiaVisionPipeline:
    """Orquestador completo del sistema de monitoreo individual de plantas."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        db_path = config.get("database", {}).get("db_path", "data/aquagia_vision.db")
        self.repository = VisionRepository(db_path)
        self.identity_mgr = PlantIdentityManager(self.repository)
        self.history_mgr = PlantHistoryManager(self.repository)
        self.decision_engine = DecisionEngine(self.repository)

        self.mode = config.get("system", {}).get("mode", "fixed")
        self.px_to_cm2 = config.get("camera", {}).get("px_to_cm2", 0.015)

        self.detector: BasePlantDetector = self._init_detector()

        self._last_analysis_result: Optional[Dict[str, Any]] = None
        self._last_annotated_frame: Optional[np.ndarray] = None

    def _init_detector(self) -> BasePlantDetector:
        if self.mode == "yolo":
            yolo_cfg = self.config.get("yolo", {})
            return YoloPlantDetector(
                model_path=yolo_cfg.get("model_path", "models/yolov8n_plants.pt"),
                conf_threshold=yolo_cfg.get("conf_threshold", 0.35),
                iou_threshold=yolo_cfg.get("iou_threshold", 0.45),
                tracker_max_disappeared=yolo_cfg.get("tracker_max_disappeared", 15),
            )

        # Modo A por defecto (ROIs fijas)
        grid_cfg = self.config.get("grid", {})
        rois_file = grid_cfg.get("custom_rois_file")
        if rois_file and not Path(rois_file).is_absolute():
            rois_file = Path(__file__).resolve().parent / rois_file

        return FixedRoiDetector(
            rois_file=rois_file,
            rows=grid_cfg.get("rows", 3),
            cols=grid_cfg.get("cols", 3),
            prefix=grid_cfg.get("prefix", "P"),
        )

    def set_mode(self, mode: str) -> None:
        """Permite alternar dinámicamente entre Modo A ('fixed') y Modo B ('yolo')."""
        if mode not in ("fixed", "yolo"):
            raise ValueError("Modo debe ser 'fixed' o 'yolo'")
        self.mode = mode
        self.detector = self._init_detector()
        logger.info(f"Modo de detección cambiado a: {mode}")

    def analyze(
        self,
        frame: np.ndarray,
        sensor_data: Optional[Dict[str, Any]] = None,
        persist: bool = True,
    ) -> Dict[str, Any]:
        """Ejecuta el ciclo de visión artificial completo sobre un frame."""
        now_iso = datetime.now(timezone.utc).isoformat()
        if sensor_data is None:
            latest_sensor = self.repository.get_latest_sensor_reading()
            sensor_data = latest_sensor.to_dict() if latest_sensor else {}

        # 1. Identificación / Extracción de regiones por planta
        regions: List[DetectedPlantRegion] = self.detector.detect(frame)

        # Registrar plantas en base de datos si no existían
        self.identity_mgr.ensure_plants_exist(
            [
                {
                    "plant_id": r.plant_id,
                    "name": r.name,
                    "bbox_norm": list(r.bbox_norm),
                }
                for r in regions
            ]
        )

        plant_results: List[Dict[str, Any]] = []

        # 2. Análisis fenotípico por cada planta individual
        for r in regions:
            crop = r.crop
            # Segmentación de vegetación
            seg_cfg = self.config.get("segmentation", {})
            mask, contours = segment_vegetation(
                crop,
                exg_threshold=seg_cfg.get("exg_threshold"),
                min_area_px=seg_cfg.get("min_area_px", 300),
                morph_kernel_size=seg_cfg.get("morph_kernel_size", 5),
                morph_iterations=seg_cfg.get("morph_iterations", 2),
            )

            # Fenotipado morfológico (área, solidez, aspect ratio)
            phenotype = extract_phenotype_features(crop, mask, self.px_to_cm2)

            # Métricas de color (verde, clorosis, necrosis)
            color_metrics = extract_color_metrics(crop, mask)

            # Conteo de hojas
            leaf_metrics = estimate_leaf_metrics(mask)

            # Historial previo y cálculo de crecimiento G = (At - At-1) / Δt
            prev_obs = self.repository.get_latest_observation(r.plant_id)
            prev_area = prev_obs.area_cm2 if prev_obs else None
            prev_time = prev_obs.timestamp if prev_obs else None
            prev_rate = prev_obs.growth_rate if prev_obs else None

            growth = calculate_growth_rate(
                curr_area=phenotype["area_cm2"],
                prev_area=prev_area,
                curr_time_iso=now_iso,
                prev_time_iso=prev_time,
                prev_growth_rate=prev_rate,
            )

            # Motor de estado vegetal (salud y anomalías)
            health = evaluate_plant_health(
                phenotype=phenotype,
                color_metrics=color_metrics,
                growth_metrics=growth,
                sensor_data=sensor_data,
            )

            # Construir observación completa
            obs = PlantObservation(
                plant_id=r.plant_id,
                timestamp=now_iso,
                area=float(phenotype["area_px"]),
                area_cm2=float(phenotype["area_cm2"]),
                green_ratio=float(color_metrics["green_ratio"]),
                yellow_ratio=float(color_metrics["yellow_ratio"]),
                brown_ratio=float(color_metrics["brown_ratio"]),
                mean_hue=float(color_metrics["mean_hue"]),
                mean_saturation=float(color_metrics["mean_saturation"]),
                leaf_count=int(leaf_metrics["leaf_count"]),
                growth_rate=float(growth["growth_rate_per_day"]),
                growth_percent=float(growth["growth_percent"]),
                health_score=float(health["health_score"]),
                anomaly_score=float(health["anomaly_score"]),
                status=str(health["status"]),
                extra_data={
                    "solidity": phenotype["solidity"],
                    "aspect_ratio": phenotype["aspect_ratio"],
                    "leaf_density": leaf_metrics["leaf_density_px"],
                    "factors": health["factors"],
                },
            )

            if persist:
                self.repository.add_observation(obs)

            plant_results.append(
                {
                    "plant_id": r.plant_id,
                    "name": r.name,
                    "bbox_norm": list(r.bbox_norm),
                    "bbox_px": list(r.bbox_px),
                    "status": health["status"],
                    "status_label": health["status_label"],
                    "area_cm2": phenotype["area_cm2"],
                    "green_coverage_pct": int(round(color_metrics["green_ratio"] * 100)),
                    "yellow_coverage_pct": int(round(color_metrics["yellow_ratio"] * 100)),
                    "brown_coverage_pct": int(round(color_metrics["brown_ratio"] * 100)),
                    "growth_rate_pct_per_day": growth["growth_percent"],
                    "growth_rate_cm2_per_day": growth["growth_rate_per_day"],
                    "leaf_count": leaf_metrics["leaf_count"],
                    "health_score": health["health_score"],
                    "anomaly_score": health["anomaly_score"],
                    "factors": health["factors"],
                }
            )

        # 3. Motor de decisión y generación de recomendaciones
        decisions: List[DecisionResult] = self.decision_engine.analyze_all(
            plant_results, sensor_data=sensor_data
        )

        decisions_dict = {d.plant_id: d.to_dict() for d in decisions}
        for pr in plant_results:
            pid = pr["plant_id"]
            if pid in decisions_dict:
                pr["recommendations"] = decisions_dict[pid]["recommended_actions"]
                pr["has_alert"] = decisions_dict[pid]["has_alert"]

        # Resumen general del cultivo
        total_plants = len(plant_results)
        healthy_count = sum(1 for p in plant_results if p["status"] == "normal")
        stress_count = sum(1 for p in plant_results if p["status"] in ("atencion", "estres"))
        anomaly_count = sum(1 for p in plant_results if p["status"] == "anomalia")

        avg_health = (
            round(sum(p["health_score"] for p in plant_results) / total_plants, 3)
            if total_plants > 0
            else 0.0
        )

        summary = {
            "timestamp": now_iso,
            "total_plants": total_plants,
            "healthy_count": healthy_count,
            "stress_count": stress_count,
            "anomaly_count": anomaly_count,
            "avg_health_score": avg_health,
            "mode": self.mode,
        }

        # 4. Generar frame anotado visual
        annotated = self.draw_annotations(frame, plant_results)
        self._last_annotated_frame = annotated

        result = {
            "summary": summary,
            "plants": plant_results,
            "sensors": sensor_data,
        }
        self._last_analysis_result = result
        return result

    def draw_annotations(
        self, frame: np.ndarray, plants: List[Dict[str, Any]]
    ) -> np.ndarray:
        """Dibuja las cajas, nombres de plantas y estados con colores semafóricos."""
        out = frame.copy()
        color_map = {
            "normal": (40, 200, 40),  # Verde
            "atencion": (30, 215, 235),  # Amarillo
            "estres": (20, 140, 240),  # Naranja
            "anomalia": (30, 30, 230),  # Rojo
        }

        for p in plants:
            bx, by, bw, bh = p["bbox_px"]
            status = p.get("status", "normal")
            color = color_map.get(status, (200, 200, 200))

            # Dibujar rectángulo de planta
            cv2.rectangle(out, (bx, by), (bx + bw, by + bh), color, 2)

            # Etiqueta de cabecera
            pid = p["plant_id"]
            growth_sign = "+" if p.get("growth_rate_pct_per_day", 0) >= 0 else ""
            growth_txt = f"{growth_sign}{p.get('growth_rate_pct_per_day', 0):.1f}%"
            label = f"{pid} | {p['status_label']} | {growth_txt}"

            # Fondo de texto para legibilidad
            (w_txt, h_txt), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1
            )
            cv2.rectangle(
                out,
                (bx, max(0, by - 20)),
                (bx + w_txt + 8, max(0, by)),
                color,
                -1,
            )
            cv2.putText(
                out,
                label,
                (bx + 4, max(14, by - 5)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (0, 0, 0),
                1,
                cv2.LINE_AA,
            )

            # Sub-etiqueta inferior con área y hojas
            sub_label = f"Area: {p['area_cm2']}cm2 | Hojas: {p['leaf_count']}"
            cv2.putText(
                out,
                sub_label,
                (bx + 4, by + bh - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.40,
                (255, 255, 255),
                1,
                cv2.LINE_AA,
            )

        return out

    def get_last_result(self) -> Optional[Dict[str, Any]]:
        return self._last_analysis_result

    def get_last_annotated_frame(self) -> Optional[np.ndarray]:
        return self._last_annotated_frame
