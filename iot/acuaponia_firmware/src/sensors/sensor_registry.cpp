#include "sensor_registry.h"

// 1) Incluye el header de cada sensor.
// ───────────────────────────────────────────────────────────────────────────
//  Telemetría activa:
//    - DS18B20 (temperatura del agua)         GPIO 4    · 1-Wire
//    - EC (electroconductividad)              GPIO 32   · ADC1
//    - BME280 (ambiente: T, HR, presión)      I2C 21/22
//    - Arduino esclavo (Serial2):             GPIO 16 RX / 17 TX
//         · nivelAgua  (cm)
//
//  La turbidez ya no se publica: el slave no la manda y no hay otra
//  fuente activa. Quedará marcada como "unavailable" en el dashboard
//  si se la quiere volver a agregar más adelante.
//
//  Comentados (sin hardware aún):
//    - temperature_ntc.h (alternativa analógica al DS18B20)
//    - sim_actuadores.h  (modo "solo actuadores" con datos simulados)
// ───────────────────────────────────────────────────────────────────────────
#include "temperature_ds18b20.h"     // sonda sumergible DFRobot (1-Wire, GPIO 4)
#include "ec_sensor.h"               // electroconductividad DFRobot (analógico)
#include "bme280_sensor.h"           // ambiente: T, HR, presión (I2C)
#include "arduino_slave.h"           // nivelAgua vía Serial2 (GPIO 16/17)

// 2) Lista de sensores activos — la ESP32 publica telemetría en MQTT.
static SensorDef SENSORS[] = {
  { "temperatura",         "°C",    ds18b20_begin,         ds18b20_read                },
  { "electroconductividad","mS/cm", ec_begin,              ec_read                     },
  { "temperaturaAmbiente", "°C",    bme280_begin,          bme280_temp_ambiente_read   },
  { "humedad",             "%",     nullptr,              bme280_humedad_read         },
  { "presion",             "hPa",   nullptr,              bme280_presion_read         },
  { "nivelAgua",           "cm",    slave_begin,           slave_nivelAgua_read        },
  // ── Alternativas / simulaciones (descomentar cuando corresponda) ──
  // { "temperatura", "°C", ntc_begin, ntc_read },
  // { "temperatura", "°C", sim_begin,  sim_temp_read  },
  // { "ph",      "",     ph_begin,     ph_read     },
  // { "oxigeno", "mg/L", oxygen_begin, oxygen_read },
};

static const int SENSOR_COUNT = sizeof(SENSORS) / sizeof(SENSORS[0]);

void sensors_begin() {
  for (int i = 0; i < SENSOR_COUNT; i++) {
    if (SENSORS[i].begin) SENSORS[i].begin();
  }
}

void sensors_build_payload(JsonObject& sensors) {
  for (int i = 0; i < SENSOR_COUNT; i++) {
    Reading r = SENSORS[i].read();

    // Publicamos TODOS los sensores, incluso los inválidos: el dashboard
    // necesita saber que el slot existe y mostrar "No disponible" en vez
    // de ocultarlo. Cuando el sensor falla, mandamos value=null y
    // status="unavailable" (compatible con el frontend).
    JsonObject o = sensors.createNestedObject(SENSORS[i].key);
    o["unit"]    = SENSORS[i].unit;

    if (r.valid) {
      o["value"]   = r.value;
      o["percent"] = r.percent;
      o["status"]  = r.status;
    } else {
      o["value"]   = nullptr;
      o["percent"] = 0;
      o["status"]  = "unavailable";
    }
  }
}