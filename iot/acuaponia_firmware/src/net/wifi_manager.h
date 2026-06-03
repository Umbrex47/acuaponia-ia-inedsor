#pragma once

// Gestión de la conexión WiFi.
void wifi_begin();             // conecta (bloqueante con timeout)
void wifi_ensure_connected();  // reconecta si se cayó
bool wifi_connected();
