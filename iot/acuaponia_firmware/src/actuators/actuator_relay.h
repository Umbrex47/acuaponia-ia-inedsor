#pragma once

// Control de relés físicos para bomba de agua, aireador y dispensador.
// Los módulos de relé de este proyecto se cablean activos en LOW.
//
// Cada comando llega por MQTT en aquaponic/commands/<id> con payload
// {"action":"on"|"off"|"dispense", ...}. Tras actuar, el firmware publica
// el estado real en aquaponic/actuators/status/<id>.

void relay_begin();
void relay_loop();

// Ejecuta una acción sobre un actuador por su id de backend.
// Devuelve true si el id es conocido y la acción fue aplicada.
bool relay_execute(const char* id, const char* action);

// Estado físico actual de un actuador (false si el id es desconocido).
bool relay_is_on(const char* id);

// Callback opcional: se invoca cuando un relé cambia de estado (por ejemplo
// al terminar el pulso del dispensador). Recibe id, estado y razón.
typedef void (*RelayStatusCallback)(const char* id, bool on, const char* reason);
void relay_set_status_callback(RelayStatusCallback cb);
