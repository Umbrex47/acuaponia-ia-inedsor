#pragma once
#include "sensor_types.h"

// Arduino esclavo conectado por Serial2. Envía nivelAgua como JSON por línea
// (terminada en '\n'):
//   {"nivelAgua":{"value":18.3,"unit":"cm"}}
//
// La turbidez ya NO viene de acá: se publica desde otra vía o queda
// marcada como "unavailable" en el dashboard.
//
// Si no llega ninguna trama válida durante SLAVE_TIMEOUT_MS, las lecturas se
// marcan como inválidas y el dashboard muestra "No disponible".
void    slave_begin();
Reading slave_nivelAgua_read();