#include "sensor_registry.h"

// 1) Incluye el header de cada sensor.
#include "temperature_ds18b20.h"   // sonda sumergible DFRobot (1-Wire)
#include "ec_sensor.h"             // electroconductividad DFRobot (analógico)
#include "bme280_sensor.h"         // ambiente: T, HR, presión (I2C)
#include "water_level_ultrasonic.h" // nivel de agua (ultrasónico Trig/Echo)
// #include "temperature_ntc.h"    // alternativa: termistor NTC analógico
// #include "ph_sensor.h"
// #include "oxygen_sensor.h"

// 2) Regístralo aquí (una línea por sensor).
//    La "key" debe coincidir con las claves del normalizer del frontend:
//    temperatura, ph, oxigeno, nivelAgua, nitratos, co2, electroconductividad,
//    turbiedad, temperaturaAmbiente, humedad, presion
static SensorDef SENSORS[] = {
  { "temperatura", "°C", ds18b20_begin, ds18b20_read },
  { "electroconductividad", "mS/cm", ec_begin, ec_read },
  { "nivelAgua", "cm", water_level_begin, water_level_read },
  { "temperaturaAmbiente", "°C", bme280_begin, bme280_temp_ambiente_read },
  { "humedad", "%", nullptr, bme280_humedad_read },
  { "presion", "hPa", nullptr, bme280_presion_read },
  // { "temperatura", "°C", ntc_begin, ntc_read },   // si vuelves al NTC
  // { "ph",      "",     ph_begin,     ph_read },
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
    if (!r.valid) continue;   // sensor inactivo → no se publica

    JsonObject o = sensors.createNestedObject(SENSORS[i].key);
    o["value"]   = r.value;
    o["unit"]    = SENSORS[i].unit;
    o["percent"] = r.percent;
    o["status"]  = r.status;
  }
}
