"""Línea de comandos (CLI) de AquaGia Vision."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2

from camera.capture import CameraCapture
from config import load_config
from pipeline import AquaGiaVisionPipeline

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="aquagia-vision",
        description="AquaGia Vision - Monitoreo individual de plantas de bajo consumo",
    )
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles")

    # 1. Comando analyze
    p_analyze = subparsers.add_parser("analyze", help="Analiza una imagen o captura sintética")
    p_analyze.add_argument("--image", type=Path, default=None, help="Ruta de imagen BGR (opcional, usa sintética si se omite)")
    p_analyze.add_argument("--mode", choices=["fixed", "yolo"], default="fixed", help="Modo de identificación")
    p_analyze.add_argument("--output-image", type=Path, default=None, help="Guardar imagen anotada")
    p_analyze.add_argument("--output-json", type=Path, default=None, help="Guardar JSON de telemetría")

    # 2. Comando status
    subparsers.add_parser("status", help="Muestra el estado actual de cada planta en la base de datos")

    # 3. Comando daemon
    p_daemon = subparsers.add_parser("daemon", help="Inicia el servicio periódico en segundo plano")
    p_daemon.add_argument("--port", type=int, default=8000, help="Puerto de API REST")

    args = parser.parse_args()

    if args.command == "analyze":
        run_analyze(args)
    elif args.command == "status":
        run_status()
    elif args.command == "daemon":
        run_daemon(args)
    else:
        parser.print_help()


def run_analyze(args: argparse.Namespace) -> None:
    cfg = load_config()
    cfg["system"]["mode"] = args.mode
    pipeline = AquaGiaVisionPipeline(cfg)

    if args.image and args.image.exists():
        frame = cv2.imread(str(args.image))
        if frame is None:
            print(f"Error: No se pudo leer {args.image}", file=sys.stderr)
            sys.exit(1)
    else:
        print("Capturando frame sintético representativo de cama acuapónica...")
        cam = CameraCapture(source="synthetic")
        frame = cam.get_frame()

    print(f"Ejecutando pipeline de visión en Modo: {pipeline.mode.upper()}...")
    result = pipeline.analyze(frame, persist=True)

    print("\n" + "=" * 55)
    print("           ESTADO INDIVIDUAL DE PLANTAS")
    print("=" * 55 + "\n")

    for plant in result["plants"]:
        pid = plant["plant_id"]
        print(pipeline.history_mgr.format_text_tree(pid))
        if plant.get("factors"):
            print(f"   ↳ Factores: {', '.join(plant['factors'])}")
        if plant.get("recommendations"):
            for rec in plant["recommendations"]:
                print(f"   ⚠️ Acción sugerida: {rec['action']} ({rec['reason']})")
        print()

    summary = result["summary"]
    print("=" * 55)
    print(
        f"Total: {summary['total_plants']} | Saludables: {summary['healthy_count']} | "
        f"Estrés: {summary['stress_count']} | Anomalías: {summary['anomaly_count']} | "
        f"Score promedio: {summary['avg_health_score'] * 100:.1f}%"
    )
    print("=" * 55)

    if args.output_json:
        args.output_json.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nTelemetría JSON guardada en: {args.output_json}")

    if args.output_image:
        annotated = pipeline.get_last_annotated_frame()
        if annotated is not None:
            cv2.imwrite(str(args.output_image), annotated)
            print(f"Imagen anotada guardada en: {args.output_image}")


def run_status() -> None:
    cfg = load_config()
    pipeline = AquaGiaVisionPipeline(cfg)
    plants = pipeline.identity_mgr.get_all()
    if not plants:
        print("No hay plantas registradas en la base de datos local.")
        return

    print("\n" + "=" * 55)
    print("     HISTORIAL ACTUAL EN BASE DE DATOS (SQLite)")
    print("=" * 55 + "\n")
    for p in plants:
        print(pipeline.history_mgr.format_text_tree(p.id))
        print()


def run_daemon(args: argparse.Namespace) -> None:
    import uvicorn
    from api.server import create_app

    cfg = load_config()
    cfg["api"]["port"] = args.port
    app = create_app(cfg, start_camera=True)
    print(f"Iniciando AquaGia Vision Daemon en http://0.0.0.0:{args.port}...")
    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
