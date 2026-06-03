#pragma once
#include "sensor_types.h"

// Termistor NTC analógico (módulo tipo KY-028, pin AO).
void    ntc_begin();
Reading ntc_read();
