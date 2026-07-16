"""Dibuja boxes/IDs sobre el frame."""

from __future__ import annotations

import cv2

from .detector import TrackedFish


def draw_tracks(frame, tracks: list[TrackedFish], count: int | None = None):
    annotated = frame.copy()
    for tr in tracks:
        x1, y1, x2, y2 = map(int, (tr.x1, tr.y1, tr.x2, tr.y2))
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 200, 80), 2)
        cv2.putText(
            annotated,
            f"Id:{tr.track_id}",
            (x1, max(y1 - 8, 12)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            (0, 200, 80),
            1,
            cv2.LINE_AA,
        )
    if count is not None:
        cv2.putText(
            annotated,
            f"Peces: {count}",
            (12, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
    return annotated
