#pragma once
#include <Arduino.h>

// Resultado de una lectura de sensor.
struct Reading {
  float       value;     // valor físico (°C, mg/L, etc.)
  int         percent;   // 0–100 para el gauge del dashboard
  const char* status;    // "ok" | "warn" | "critical"
  bool        valid;     // false → el sensor falló / no disponible
};

// Funciones que debe proveer cada sensor.
typedef void    (*SensorBeginFn)();   // inicialización (puede ser nullptr)
typedef Reading (*SensorReadFn)();    // lectura

// Definición de un sensor en el registro.
struct SensorDef {
  const char*   key;     // clave del normalizer del frontend (ej. "temperatura")
  const char*   unit;    // unidad (ej. "°C")
  SensorBeginFn begin;
  SensorReadFn  read;
};
