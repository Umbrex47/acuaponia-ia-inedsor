#pragma once

// LEDs indicadores del estado de los actuadores.
//
// - OFF por defecto: pin en LOW.
// - ON: parpadeo suave cada 600 ms (HIGH/LOW).
//
// La fuente de verdad es el topic MQTT <prefix>/actuators/status/<id>, parseado
// por mqtt_manager y empujado aquí con `setActuatorState(id, isOn)`.
void led_begin();

// Llamar desde loop() con la frecuencia del WiFi/MQTT (~10–100 Hz está bien).
void led_loop();

// Actualiza el estado del actuador y, en consecuencia, su LED.
// `id` debe coincidir con el segmento final del topic (bomba_agua, aireador,
// dispensador_comida). Cualquier otro id se ignora silenciosamente.
void setActuatorState(const char* id, bool isOn);