"""Repositorio SQLite local-first para AquaGia Vision."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from database.models import Plant, PlantAlert, PlantObservation, SensorReading


class VisionRepository:
    def __init__(self, db_path: str | Path = "data/aquagia_vision.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    @contextmanager
    def _connection(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._connection() as conn:
            cursor = conn.cursor()

            # 1. Tabla de plantas individuales
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS plants (
                    id TEXT PRIMARY KEY,
                    species TEXT NOT NULL,
                    position TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    roi_bbox TEXT
                )
                """
            )

            # 2. Historial de observaciones por planta
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS plant_observations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plant_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    area REAL NOT NULL,
                    area_cm2 REAL NOT NULL,
                    green_ratio REAL NOT NULL,
                    yellow_ratio REAL NOT NULL,
                    brown_ratio REAL NOT NULL,
                    mean_hue REAL NOT NULL,
                    mean_saturation REAL NOT NULL,
                    leaf_count INTEGER NOT NULL,
                    growth_rate REAL NOT NULL,
                    growth_percent REAL NOT NULL,
                    health_score REAL NOT NULL,
                    anomaly_score REAL NOT NULL,
                    status TEXT NOT NULL,
                    extra_data TEXT,
                    FOREIGN KEY (plant_id) REFERENCES plants(id)
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_obs_plant_time
                ON plant_observations(plant_id, timestamp DESC)
                """
            )

            # 3. Lecturas de sensores físicoquímicos
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS sensor_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    temperature REAL,
                    temperature_air REAL,
                    humidity REAL,
                    ph REAL,
                    ec REAL,
                    water_level REAL,
                    oxygen REAL
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sensors_time
                ON sensor_readings(timestamp DESC)
                """
            )

            # 4. Registro de alertas
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS plant_alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plant_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    rule_id TEXT NOT NULL,
                    message TEXT NOT NULL,
                    suggested_action TEXT NOT NULL,
                    resolved INTEGER DEFAULT 0,
                    FOREIGN KEY (plant_id) REFERENCES plants(id)
                )
                """
            )
            conn.commit()

    # --- Métodos de Plantas ---

    def upsert_plant(self, plant: Plant) -> None:
        bbox_json = json.dumps(plant.roi_bbox) if plant.roi_bbox else None
        with self._connection() as conn:
            conn.execute(
                """
                INSERT INTO plants (id, species, position, created_at, status, roi_bbox)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status = excluded.status,
                    species = excluded.species,
                    roi_bbox = coalesce(excluded.roi_bbox, plants.roi_bbox)
                """,
                (
                    plant.id,
                    plant.species,
                    plant.position,
                    plant.created_at,
                    plant.status,
                    bbox_json,
                ),
            )
            conn.commit()

    def get_plant(self, plant_id: str) -> Optional[Plant]:
        with self._connection() as conn:
            row = conn.execute(
                "SELECT * FROM plants WHERE id = ?", (plant_id,)
            ).fetchone()
            if not row:
                return None
            bbox = json.loads(row["roi_bbox"]) if row["roi_bbox"] else None
            return Plant(
                id=row["id"],
                species=row["species"],
                position=row["position"],
                created_at=row["created_at"],
                status=row["status"],
                roi_bbox=bbox,
            )

    def get_all_plants(self) -> List[Plant]:
        with self._connection() as conn:
            rows = conn.execute("SELECT * FROM plants ORDER BY id ASC").fetchall()
            plants = []
            for row in rows:
                bbox = json.loads(row["roi_bbox"]) if row["roi_bbox"] else None
                plants.append(
                    Plant(
                        id=row["id"],
                        species=row["species"],
                        position=row["position"],
                        created_at=row["created_at"],
                        status=row["status"],
                        roi_bbox=bbox,
                    )
                )
            return plants

    # --- Métodos de Observaciones ---

    def add_observation(self, obs: PlantObservation) -> int:
        extra_json = json.dumps(obs.extra_data) if obs.extra_data else None
        with self._connection() as conn:
            cur = conn.execute(
                """
                INSERT INTO plant_observations (
                    plant_id, timestamp, area, area_cm2, green_ratio, yellow_ratio,
                    brown_ratio, mean_hue, mean_saturation, leaf_count, growth_rate,
                    growth_percent, health_score, anomaly_score, status, extra_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    obs.plant_id,
                    obs.timestamp,
                    obs.area,
                    obs.area_cm2,
                    obs.green_ratio,
                    obs.yellow_ratio,
                    obs.brown_ratio,
                    obs.mean_hue,
                    obs.mean_saturation,
                    obs.leaf_count,
                    obs.growth_rate,
                    obs.growth_percent,
                    obs.health_score,
                    obs.anomaly_score,
                    obs.status,
                    extra_json,
                ),
            )
            obs_id = cur.lastrowid
            # Actualizar estado actual de la planta en la tabla maestra
            conn.execute(
                "UPDATE plants SET status = ? WHERE id = ?",
                (obs.status, obs.plant_id),
            )
            conn.commit()
            return obs_id

    def get_latest_observation(self, plant_id: str) -> Optional[PlantObservation]:
        with self._connection() as conn:
            row = conn.execute(
                """
                SELECT * FROM plant_observations
                WHERE plant_id = ?
                ORDER BY timestamp DESC
                LIMIT 1
                """,
                (plant_id,),
            ).fetchone()
            if not row:
                return None
            return self._row_to_obs(row)

    def get_plant_history(
        self, plant_id: str, limit: int = 100
    ) -> List[PlantObservation]:
        with self._connection() as conn:
            rows = conn.execute(
                """
                SELECT * FROM plant_observations
                WHERE plant_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
                """,
                (plant_id, limit),
            ).fetchall()
            return [self._row_to_obs(r) for r in reversed(rows)]

    def _row_to_obs(self, row: sqlite3.Row) -> PlantObservation:
        extra = json.loads(row["extra_data"]) if row["extra_data"] else {}
        return PlantObservation(
            id=row["id"],
            plant_id=row["plant_id"],
            timestamp=row["timestamp"],
            area=row["area"],
            area_cm2=row["area_cm2"],
            green_ratio=row["green_ratio"],
            yellow_ratio=row["yellow_ratio"],
            brown_ratio=row["brown_ratio"],
            mean_hue=row["mean_hue"],
            mean_saturation=row["mean_saturation"],
            leaf_count=row["leaf_count"],
            growth_rate=row["growth_rate"],
            growth_percent=row["growth_percent"],
            health_score=row["health_score"],
            anomaly_score=row["anomaly_score"],
            status=row["status"],
            extra_data=extra,
        )

    # --- Métodos de Sensores ---

    def add_sensor_reading(self, reading: SensorReading) -> int:
        with self._connection() as conn:
            cur = conn.execute(
                """
                INSERT INTO sensor_readings (
                    timestamp, temperature, temperature_air, humidity,
                    ph, ec, water_level, oxygen
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    reading.timestamp,
                    reading.temperature,
                    reading.temperature_air,
                    reading.humidity,
                    reading.ph,
                    reading.ec,
                    reading.water_level,
                    reading.oxygen,
                ),
            )
            conn.commit()
            return cur.lastrowid

    def get_latest_sensor_reading(self) -> Optional[SensorReading]:
        with self._connection() as conn:
            row = conn.execute(
                """
                SELECT * FROM sensor_readings
                ORDER BY timestamp DESC
                LIMIT 1
                """
            ).fetchone()
            if not row:
                return None
            return SensorReading(
                id=row["id"],
                timestamp=row["timestamp"],
                temperature=row["temperature"],
                temperature_air=row["temperature_air"],
                humidity=row["humidity"],
                ph=row["ph"],
                ec=row["ec"],
                water_level=row["water_level"],
                oxygen=row["oxygen"],
            )

    # --- Métodos de Alertas ---

    def add_alert(self, alert: PlantAlert) -> int:
        with self._connection() as conn:
            cur = conn.execute(
                """
                INSERT INTO plant_alerts (
                    plant_id, timestamp, severity, rule_id, message, suggested_action, resolved
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    alert.plant_id,
                    alert.timestamp,
                    alert.severity,
                    alert.rule_id,
                    alert.message,
                    alert.suggested_action,
                    1 if alert.resolved else 0,
                ),
            )
            conn.commit()
            return cur.lastrowid

    def get_active_alerts(self, plant_id: Optional[str] = None) -> List[PlantAlert]:
        with self._connection() as conn:
            query = "SELECT * FROM plant_alerts WHERE resolved = 0"
            params = []
            if plant_id:
                query += " AND plant_id = ?"
                params.append(plant_id)
            query += " ORDER BY timestamp DESC LIMIT 50"

            rows = conn.execute(query, params).fetchall()
            return [
                PlantAlert(
                    id=r["id"],
                    plant_id=r["plant_id"],
                    timestamp=r["timestamp"],
                    severity=r["severity"],
                    rule_id=r["rule_id"],
                    message=r["message"],
                    suggested_action=r["suggested_action"],
                    resolved=bool(r["resolved"]),
                )
                for r in rows
            ]
