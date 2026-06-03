#pragma once
#include "sensor_types.h"

// BME280 (I2C): temperatura ambiente, humedad relativa y presión barométrica.
// Requiere Adafruit_BME280 + Adafruit Unified Sensor.
void    bme280_begin();
Reading bme280_temp_ambiente_read();
Reading bme280_humedad_read();
Reading bme280_presion_read();
