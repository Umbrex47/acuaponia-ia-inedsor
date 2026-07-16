"""API en la nube para análisis de plantas (cámara fija → POST imagen)."""

from __future__ import annotations

import io
import json
from contextlib import asynccontextmanager
from typing import Any

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response
from pydantic_settings import BaseSettings

from src.config import load_config
from src.pipeline import PlantAnalysisPipeline

_config = load_config()
_pipeline: PlantAnalysisPipeline | None = None


class Settings(BaseSettings):
    host: str = _config.get("api", {}).get("host", "0.0.0.0")
    port: int = _config.get("api", {}).get("port", 8000)
    max_upload_mb: int = _config.get("api", {}).get("max_upload_mb", 10)


settings = Settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    global _pipeline
    _pipeline = PlantAnalysisPipeline(_config)
    yield
    _pipeline = None


app = FastAPI(
    title="IAPlantass API",
    description="Análisis de salud, tamaño y estado de plantas (cámara fija, multi-cultivo)",
    version="0.1.0",
    lifespan=lifespan,
)


def _read_image(upload: UploadFile) -> np.ndarray:
    content = upload.file.read()
    max_bytes = settings.max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(413, f"Imagen mayor a {settings.max_upload_mb} MB")
    arr = np.frombuffer(content, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise HTTPException(400, "Formato de imagen no válido")
    return bgr


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/info")
async def info() -> dict[str, Any]:
    assert _pipeline is not None
    return {
        "calibrated": _pipeline.calibration is not None,
        "health_model_loaded": _pipeline.health_classifier.model is not None,
        "health_fallback": _pipeline.health_classifier.fallback_heuristics,
        "segmentation": "ExG (sin etiquetas, cámara fija)",
    }


@app.post("/analyze")
async def analyze(image: UploadFile = File(...)) -> JSONResponse:
    assert _pipeline is not None
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(400, "Se requiere un archivo de imagen")
    bgr = _read_image(image)
    result = _pipeline.analyze(bgr)
    return JSONResponse(content=result)


@app.post("/analyze/annotated")
async def analyze_annotated(image: UploadFile = File(...)) -> Response:
    """Devuelve JPEG con bounding boxes y etiquetas."""
    assert _pipeline is not None
    bgr = _read_image(image)
    result = _pipeline.analyze(bgr)
    annotated = _pipeline.draw_annotations(bgr, result)
    ok, buf = cv2.imencode(".jpg", annotated)
    if not ok:
        raise HTTPException(500, "Error al generar imagen")
    return Response(content=buf.tobytes(), media_type="image/jpeg")


@app.post("/analyze/full")
async def analyze_full(image: UploadFile = File(...)) -> JSONResponse:
    """JSON + metadatos; la imagen anotada se puede pedir por separado."""
    assert _pipeline is not None
    bgr = _read_image(image)
    result = _pipeline.analyze(bgr)
    result["_meta"] = {
        "annotated_endpoint": "/analyze/annotated",
        "docs": "/docs",
    }
    return JSONResponse(content=result)


def run() -> None:
    import uvicorn

    uvicorn.run("api.main:app", host=settings.host, port=settings.port, reload=False)


if __name__ == "__main__":
    run()
