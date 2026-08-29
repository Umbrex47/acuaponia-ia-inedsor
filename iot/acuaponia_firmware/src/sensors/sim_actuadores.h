#pragma once
#include "sensor_types.h"

// Sensores virtuales para validar lógica de actuadores sin hardware real.
// Rotan por estados (ok → warn → critical → ok) cada SIM_DWELL_MS por clave,
// de modo que el motor de bomba, alertas y dashboard vean lecturas reales con
// cambios de status.
//
// Para activar: cambia los `read` en sensor_registry.cpp por sim_*_read.
// Para volver al hardware real: restaura los `read` originales.
void sim_begin();
Reading sim_temperatura_read();
Reading sim_electroconductividad_read();
Reading sim_nivelAgua_read();
Reading sim_turbiedad_read();
Reading sim_temperaturaAmbiente_read();
Reading sim_humedad_read();
Reading sim_presion_read();