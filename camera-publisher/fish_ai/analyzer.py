"""Señales de conducta: superficie, actividad (low/normal/active) y assessment."""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .detector import TrackedFish


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


@dataclass
class FishFrameResult:
    count: int
    detections: int
    confidence_avg: float | None
    mood: str
    behavior: dict[str, Any]
    assessment: dict[str, Any] | None
    overlay_tracks: list[TrackedFish] = field(default_factory=list)


class BehaviorAnalyzer:
    """Ventana deslizante de conducta a partir de tracks SORT."""

    def __init__(
        self,
        window_sec: float = 180.0,
        surface_band: float = 0.25,
        activity_low: float = 0.08,
        activity_high: float = 0.35,
        surface_thr: float = 0.55,
        assess_interval_sec: float = 90.0,
        motion_norm_px: float = 40.0,
    ):
        self.window_sec = window_sec
        self.surface_band = surface_band
        self.activity_low = activity_low
        self.activity_high = activity_high
        self.surface_thr = surface_thr
        self.assess_interval_sec = assess_interval_sec
        self.motion_norm_px = motion_norm_px

        self._samples: deque[tuple[float, int, int, float, int]] = deque()
        self._prev_centers: dict[int, tuple[float, float]] = {}
        self._last_assess_at = 0.0
        self._started_at = time.monotonic()
        self._motion_samples = 0

    def update(
        self,
        tracks: list[TrackedFish],
        detections: int,
        conf_avg: float | None,
        frame_h: int,
        now: float | None = None,
    ) -> FishFrameResult:
        now = time.monotonic() if now is None else now
        surface_hits = 0
        motion_sum = 0.0
        motion_n = 0
        new_centers: dict[int, tuple[float, float]] = {}

        for tr in tracks:
            cy_norm = tr.cy / max(frame_h, 1)
            if cy_norm <= self.surface_band:
                surface_hits += 1
            new_centers[tr.track_id] = (tr.cx, tr.cy)
            prev = self._prev_centers.get(tr.track_id)
            if prev is not None:
                dx = tr.cx - prev[0]
                dy = tr.cy - prev[1]
                dist = (dx * dx + dy * dy) ** 0.5
                motion_sum += dist
                motion_n += 1
                self._motion_samples += 1

        self._prev_centers = new_centers
        total_obs = len(tracks)
        self._samples.append((now, surface_hits, total_obs, motion_sum, motion_n))
        self._prune(now)

        surface_ratio, activity_score = self._aggregate()
        activity_state = self._activity_state(activity_score)
        near_surface = surface_ratio >= self.surface_thr
        low_activity = activity_state == "low"

        behavior = {
            "windowSec": int(self.window_sec),
            "surfaceRatio": round(surface_ratio, 3),
            "activityScore": round(activity_score, 3),
            "activityState": activity_state,
            "nearSurface": near_surface,
            "lowActivity": low_activity,
        }

        assessment = None
        # Espera a tener ventana mínima antes de emitir assessment (evita falsos
        # "low/unwell" en el primer frame estático).
        warmed = (now - self._started_at) >= min(30.0, self.window_sec * 0.25)
        if warmed and now - self._last_assess_at >= self.assess_interval_sec:
            self._last_assess_at = now
            assessment = self._build_assessment(behavior)

        mood = {
            "active": "Activos",
            "normal": "Calmados",
            "low": "Poco movimiento",
        }.get(activity_state, "Calmados")

        return FishFrameResult(
            count=len(tracks),
            detections=detections,
            confidence_avg=round(conf_avg, 3) if conf_avg is not None else None,
            mood=mood,
            behavior=behavior,
            assessment=assessment,
            overlay_tracks=tracks,
        )

    def _prune(self, now: float) -> None:
        cutoff = now - self.window_sec
        while self._samples and self._samples[0][0] < cutoff:
            self._samples.popleft()

    def _aggregate(self) -> tuple[float, float]:
        if not self._samples:
            return 0.0, 0.0
        surf_h = surf_t = 0
        mot_s = mot_n = 0
        for _t, sh, to, ms, mn in self._samples:
            surf_h += sh
            surf_t += to
            mot_s += ms
            mot_n += mn
        surface_ratio = (surf_h / surf_t) if surf_t else 0.0
        mean_px = (mot_s / mot_n) if mot_n else 0.0
        activity_score = _clamp(mean_px / self.motion_norm_px, 0.0, 1.0)
        return surface_ratio, activity_score

    def _activity_state(self, score: float) -> str:
        if score >= self.activity_high:
            return "active"
        if score <= self.activity_low:
            return "low"
        return "normal"

    def _build_assessment(self, behavior: dict[str, Any]) -> dict[str, Any]:
        hypotheses: list[dict[str, Any]] = []
        suggested: list[dict[str, str]] = []
        surface_ratio = float(behavior["surfaceRatio"])
        activity_score = float(behavior["activityScore"])
        activity_state = behavior["activityState"]

        if behavior["nearSurface"]:
            p = int(
                round(
                    _clamp(
                        (surface_ratio - self.surface_thr)
                        / max(1e-6, 1.0 - self.surface_thr),
                        0.0,
                        1.0,
                    )
                    * 100
                )
            )
            p = max(p, 40)
            hypotheses.append(
                {
                    "id": "low_oxygen_or_hunger",
                    "probability": p,
                    "message": (
                        f"Probabilidad de {p}% de que los peces les falte "
                        "oxígeno o tengan hambre"
                    ),
                    "evidence": [
                        f"surfaceRatio={surface_ratio:.2f}",
                        "nearSurface=true",
                        f"windowSec={behavior['windowSec']}",
                    ],
                }
            )
            suggested.extend(
                [
                    {
                        "action": "check_dissolved_oxygen",
                        "reason": "surface_dwelling",
                    },
                    {
                        "action": "consider_aerator_or_recirc_pump",
                        "reason": "surface_dwelling",
                    },
                    {"action": "consider_feeding", "reason": "surface_dwelling"},
                ]
            )

        if activity_state == "low" and self._motion_samples >= 10:
            p = int(
                round(
                    _clamp(
                        (self.activity_low - activity_score)
                        / max(1e-6, self.activity_low),
                        0.0,
                        1.0,
                    )
                    * 100
                )
            )
            p = max(p, 35)
            hypotheses.append(
                {
                    "id": "unwell",
                    "probability": p,
                    "message": (
                        f"Probabilidad de {p}% de que los peces estén mal"
                    ),
                    "evidence": [
                        f"activityScore={activity_score:.2f}",
                        "activityState=low",
                    ],
                }
            )
            suggested.append(
                {"action": "inspect_tank", "reason": "low_activity"}
            )

        if activity_state == "active" and not behavior["nearSurface"]:
            status, status_label = "ok", "Activo"
        elif activity_state == "normal" and not behavior["nearSurface"]:
            status, status_label = "ok", "Normal"
        elif hypotheses:
            status, status_label = "attention", "Atención"
        else:
            status, status_label = "ok", "Normal"

        return {
            "at": datetime.now(timezone.utc).isoformat(),
            "status": status,
            "statusLabel": status_label,
            "hypotheses": hypotheses,
            "suggestedActions": suggested,
        }
