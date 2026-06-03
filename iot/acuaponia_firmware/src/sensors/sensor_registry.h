#pragma once
#include <ArduinoJson.h>
#include "sensor_types.h"

// Inicializa todos los sensores registrados.
void sensors_begin();

// Lee todos los sensores y agrega los válidos al objeto JSON "sensors".
void sensors_build_payload(JsonObject& sensors);
