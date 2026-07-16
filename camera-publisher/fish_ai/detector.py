"""YOLO + SORT: detecta peces y asigna IDs estables."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .sort import Sort


@dataclass
class TrackedFish:
    track_id: int
    x1: float
    y1: float
    x2: float
    y2: float
    conf: float

    @property
    def cx(self) -> float:
        return (self.x1 + self.x2) / 2

    @property
    def cy(self) -> float:
        return (self.y1 + self.y2) / 2


class FishDetector:
    def __init__(
        self,
        model_path: str | Path,
        conf: float = 0.35,
        class_name: str = "fish",
        device: str | None = None,
    ):
        from ultralytics import YOLO

        self.model = YOLO(str(model_path))
        self.conf = conf
        self.class_name = class_name.lower()
        self.device = device
        self.tracker = Sort(max_age=20, min_hits=1, iou_threshold=0.2)
        self._class_ids = self._resolve_class_ids()

    def _resolve_class_ids(self) -> set[int] | None:
        names = self.model.names
        if not names:
            return None
        if isinstance(names, dict):
            items = names.items()
        else:
            items = enumerate(names)
        ids = {int(i) for i, n in items if str(n).lower() == self.class_name}
        return ids or None

    def process(self, frame) -> tuple[list[TrackedFish], int, float | None]:
        """Devuelve tracks, nº de detecciones raw y confianza media."""
        kwargs = {"conf": self.conf, "verbose": False}
        if self.device:
            kwargs["device"] = self.device
        result = self.model(frame, **kwargs)[0]
        boxes = result.boxes

        if boxes is None or len(boxes) == 0:
            tracks = self.tracker.update(np.empty((0, 5)))
            return [], 0, None

        xyxy = boxes.xyxy.cpu().numpy()
        scores = boxes.conf.cpu().numpy()
        cls = boxes.cls.cpu().numpy().astype(int)

        if self._class_ids is not None:
            mask = np.isin(cls, list(self._class_ids))
            xyxy = xyxy[mask]
            scores = scores[mask]

        detections = len(xyxy)
        conf_avg = float(scores.mean()) if detections else None

        if detections > 0:
            dets = np.hstack((xyxy, scores.reshape(-1, 1)))
        else:
            dets = np.empty((0, 5))

        tracks_np = self.tracker.update(dets)
        tracked: list[TrackedFish] = []
        for row in tracks_np:
            x1, y1, x2, y2, tid = row
            # Asocia confianza de la detección más cercana por IoU simple (centro).
            conf = conf_avg or 0.0
            tracked.append(
                TrackedFish(
                    track_id=int(tid),
                    x1=float(x1),
                    y1=float(y1),
                    x2=float(x2),
                    y2=float(y2),
                    conf=float(conf),
                )
            )
        return tracked, detections, conf_avg
