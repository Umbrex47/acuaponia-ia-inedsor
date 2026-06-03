#pragma once
#include "sensor_types.h"

// Medidor de electroconductividad analógico DFRobot DFR0300 (Gravity EC V2).
void    ec_begin();
Reading ec_read();
