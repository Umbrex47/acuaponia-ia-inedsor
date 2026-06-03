#pragma once
#include "sensor_types.h"

// Sensor ultrasónico de nivel de agua (JSN-SR04T / HC-SR04, Trig/Echo).
// Devuelve la altura de la columna de agua en cm a partir de la distancia
// medida hacia la superficie y la geometría de la pecera (config.h).
void    water_level_begin();
Reading water_level_read();
