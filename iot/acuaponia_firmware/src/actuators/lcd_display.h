#pragma once

// Inicializa la pantalla LCD por I2C (dirección 0x27 o 0x3F típicamente)
void lcd_begin();

// Actualiza el contenido de la pantalla con datos del sistema
void lcd_update(bool wifiOk, bool mqttOk, float temp, int waterPercent);
