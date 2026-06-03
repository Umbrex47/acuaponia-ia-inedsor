#pragma once
#include "sensor_types.h"

// Sonda de temperatura sumergible DS18B20 (DFRobot DFR0198), bus 1-Wire.
// Requiere las librerías OneWire y DallasTemperature.
void    ds18b20_begin();
Reading ds18b20_read();
