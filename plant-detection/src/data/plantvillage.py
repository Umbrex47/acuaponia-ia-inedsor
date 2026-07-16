"""Descarga y preparación del dataset PlantVillage (público, sin etiquetado propio)."""

from __future__ import annotations

import shutil
from pathlib import Path

from src.config import ROOT

DATA_DIR = ROOT / "data" / "plantvillage"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"


def download_plantvillage() -> Path:
    """Descarga PlantVillage vía kagglehub. Requiere credenciales Kaggle configuradas."""
    try:
        import kagglehub
    except ImportError as exc:
        raise ImportError("Instala kagglehub: pip install kagglehub") from exc

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    path = kagglehub.dataset_download("abdallahalidev/plantvillage-dataset")
    src = Path(path)
    dst = RAW_DIR / "PlantVillage"
    if not dst.exists():
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            raise FileNotFoundError(f"Dataset inesperado en {src}")
    return dst


def find_image_root(base: Path) -> Path:
    """Localiza la carpeta con subcarpetas por clase."""
    candidates = [
        base / "PlantVillage",
        base / "plantvillage dataset" / "segmented",
        base / "plantvillage dataset" / "color",
        base,
    ]
    for candidate in candidates:
        if candidate.exists() and any(candidate.iterdir()):
            return candidate
    for child in base.rglob("*"):
        if child.is_dir() and any(c.is_dir() for c in child.iterdir()):
            subs = [c for c in child.iterdir() if c.is_dir()]
            if subs and any(list(subs[0].glob("*.jpg")) or list(subs[0].glob("*.JPG"))):
                return child
    raise FileNotFoundError(f"No se encontró estructura de clases en {base}")
