"""Servidor FastAPI para la API REST de AquaGia Vision."""

from __future__ import annotations

import io
from typing import Any, Dict, List, Optional

import cv2
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from camera.camera_manager import CameraManager
from camera.capture import CameraCapture
from config import load_config
from database.models import SensorReading
from pipeline import AquaGiaVisionPipeline


# Modelos Pydantic para endpoints
class SensorInput(BaseModel):
    temperature: Optional[float] = Field(None, description="Temperatura del agua (°C)")
    temperature_air: Optional[float] = Field(None, description="Temperatura ambiente (°C)")
    humidity: Optional[float] = Field(None, description="Humedad relativa (%)")
    ph: Optional[float] = Field(None, description="pH del agua")
    ec: Optional[float] = Field(None, description="Conductividad eléctrica (mS/cm)")
    water_level: Optional[float] = Field(None, description="Nivel de agua (cm)")
    oxygen: Optional[float] = Field(None, description="Oxígeno disuelto (mg/L)")


class ModeInput(BaseModel):
    mode: str = Field(..., pattern="^(fixed|yolo)$", description="'fixed' (Modo A) o 'yolo' (Modo B)")


def create_app(
    config: Optional[Dict[str, Any]] = None,
    start_camera: bool = True,
) -> FastAPI:
    cfg = config or load_config()

    pipeline = AquaGiaVisionPipeline(cfg)

    # Inicializar cámara
    cam_cfg = cfg.get("camera", {})
    camera = CameraCapture(
        source=cam_cfg.get("source", "synthetic"),
        width=cam_cfg.get("width", 1280),
        height=cam_cfg.get("height", 720),
    )

    sched_cfg = cfg.get("scheduler", {})
    camera_manager = CameraManager(
        camera=camera,
        on_frame_captured=lambda frame: pipeline.analyze(frame, persist=True),
        day_interval_sec=sched_cfg.get("day_interval_sec", 30.0),
        night_interval_sec=sched_cfg.get("night_interval_sec", 300.0),
        day_start_hour=sched_cfg.get("day_start_hour", 6),
        night_start_hour=sched_cfg.get("night_start_hour", 20),
        change_detection_enabled=sched_cfg.get("change_detection_enabled", True),
        change_threshold_pct=sched_cfg.get("change_threshold_pct", 3.0),
    )

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        # Ejecutar una primera captura de arranque
        camera_manager.capture_now()
        if start_camera:
            camera_manager.start()
        try:
            yield
        finally:
            camera_manager.stop()

    app = FastAPI(
        title="AquaGia Vision API",
        description="API de monitoreo individual de plantas con visión artificial de bajo consumo.",
        version=cfg.get("system", {}).get("version", "1.0.0"),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.get("api", {}).get("cors_origins", ["*"]),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Estado en app
    app.state.pipeline = pipeline
    app.state.camera_manager = camera_manager

    @app.get("/api/status")
    def get_status():
        last = pipeline.get_last_result()
        summary = last.get("summary") if last else None
        return {
            "status": "online",
            "mode": pipeline.mode,
            "version": cfg.get("system", {}).get("version", "1.0.0"),
            "summary": summary,
        }

    @app.get("/api/plants")
    def get_all_plants():
        """Retorna el estado actual de todas las plantas monitoreadas."""
        last = pipeline.get_last_result()
        if not last or not last.get("plants"):
            # Generar captura fresca si no hay datos
            last = pipeline.analyze(camera.get_frame(), persist=True)

        return {
            "summary": last.get("summary", {}),
            "plants": last.get("plants", []),
        }

    @app.get("/api/plants/{plant_id}")
    def get_plant_detail(plant_id: str):
        card = pipeline.history_mgr.get_summary_card(plant_id)
        if card["status"] == "desconocido":
            raise HTTPException(status_code=404, detail=f"Planta {plant_id} no encontrada")
        return card

    @app.get("/api/plants/{plant_id}/card")
    def get_plant_card_text(plant_id: str):
        text = pipeline.history_mgr.format_text_tree(plant_id)
        return Response(content=text, media_type="text/plain")

    @app.get("/api/plants/{plant_id}/history")
    def get_plant_history(plant_id: str, limit: int = Query(50, ge=1, le=500)):
        history = pipeline.history_mgr.get_evolution(plant_id, limit=limit)
        return {"plant_id": plant_id, "history": history}

    @app.post("/api/capture")
    def trigger_capture():
        """Fuerza una captura y procesamiento inmediato."""
        frame = camera_manager.capture_now()
        last = pipeline.get_last_result()
        return {
            "message": "Captura y procesamiento completados",
            "summary": last.get("summary", {}) if last else {},
        }

    @app.get("/api/frame/annotated")
    def get_annotated_frame():
        """Retorna el último frame con anotaciones en formato JPEG."""
        annotated = pipeline.get_last_annotated_frame()
        if annotated is None:
            frame = camera.get_frame()
            pipeline.analyze(frame, persist=True)
            annotated = pipeline.get_last_annotated_frame()

        ret, jpeg = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not ret:
            raise HTTPException(status_code=500, detail="Error codificando imagen JPEG")

        return Response(content=jpeg.tobytes(), media_type="image/jpeg")

    @app.post("/api/config/mode")
    def set_detection_mode(payload: ModeInput):
        pipeline.set_mode(payload.mode)
        # Recapturar con el nuevo modo
        camera_manager.capture_now()
        return {"status": "ok", "mode": pipeline.mode}

    @app.post("/api/sensors")
    def ingest_sensors(payload: SensorInput):
        reading = SensorReading(
            temperature=payload.temperature,
            temperature_air=payload.temperature_air,
            humidity=payload.humidity,
            ph=payload.ph,
            ec=payload.ec,
            water_level=payload.water_level,
            oxygen=payload.oxygen,
        )
        reading_id = pipeline.repository.add_sensor_reading(reading)
        return {"status": "ok", "reading_id": reading_id}

    @app.get("/api/alerts")
    def get_alerts(plant_id: Optional[str] = None):
        alerts = pipeline.repository.get_active_alerts(plant_id)
        return {"alerts": [a.to_dict() for a in alerts]}

    return app


if __name__ == "__main__":
    import uvicorn

    config = load_config()
    app = create_app(config, start_camera=True)
    api_cfg = config.get("api", {})
    uvicorn.run(
        app,
        host=api_cfg.get("host", "0.0.0.0"),
        port=api_cfg.get("port", 8000),
    )
