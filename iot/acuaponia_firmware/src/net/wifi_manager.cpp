#include "wifi_manager.h"
#include "config_store.h"
#include "../config.h"

#include <WiFi.h>

static bool apStarted = false;
static uint8_t apChannel = 1;

// Estado de la máquina de reconexión no bloqueante.
static bool staConnecting = false;
static unsigned long staAttemptStartedAt = 0;
static unsigned long lastAttemptAt = 0;
static uint8_t failureStreak = 0;
static bool wasConnected = false;
static uint8_t staChannel = 0;  // canal detectado del router (0 = desconocido)

// Backoff exponencial: 5s, 10s, 20s, 40s … con techo de 5 min, para no
// martillar el router cuando la contraseña es incorrecta o la red no existe.
static const unsigned long RETRY_BASE_MS = 5000UL;
static const unsigned long RETRY_MAX_MS = 300000UL;

const char* wifi_ap_ssid() { return AP_SSID; }

bool wifi_ap_active() { return apStarted; }

IPAddress wifi_ap_ip() { return WiFi.softAPIP(); }

IPAddress wifi_sta_ip() { return WiFi.localIP(); }

int wifi_sta_rssi() {
  return wifi_connected() ? WiFi.RSSI() : 0;
}

/** Texto legible para el estado del driver WiFi. */
static const char* staStatusName(wl_status_t status) {
  switch (status) {
    case WL_NO_SHIELD: return "sin driver";
    case WL_IDLE_STATUS: return "inactivo";
    case WL_NO_SSID_AVAIL: return "SSID no encontrado";
    case WL_SCAN_COMPLETED: return "scan completo";
    case WL_CONNECTED: return "conectado";
    case WL_CONNECT_FAILED: return "fallo de autenticación (¿contraseña?)";
    case WL_CONNECTION_LOST: return "conexión perdida";
    case WL_DISCONNECTED: return "desconectado";
    default: return "desconocido";
  }
}

/**
 * Busca el SSID objetivo y devuelve su canal, o 0 si no aparece.
 * En modo AP+STA el ESP32 comparte una sola radio: el SoftAP y el STA deben
 * usar el MISMO canal. Si no coinciden, la asociación se cae en bucle.
 */
static uint8_t scanChannelFor(const char* ssid) {
  // Scan filtrado por SSID: mucho más rápido que enumerar todas las redes.
  int16_t found = WiFi.scanNetworks(false, true, false, 300, 0, ssid);
  if (found <= 0) {
    Serial.printf("[WiFi] '%s' no visible en el scan\n", ssid);
    WiFi.scanDelete();
    return 0;
  }

  uint8_t channel = 0;
  int32_t bestRssi = -127;
  for (int16_t i = 0; i < found; i++) {
    int32_t rssi = WiFi.RSSI(i);
    if (rssi > bestRssi) {
      bestRssi = rssi;
      channel = (uint8_t)WiFi.channel(i);
    }
  }

  if (channel) {
    Serial.printf("[WiFi] '%s' encontrado en canal %u (%d dBm)\n",
                  ssid, channel, (int)bestRssi);
  }
  WiFi.scanDelete();
  return channel;
}

/** Levanta (o mueve) el SoftAP en el canal indicado. */
static void startSoftAP(uint8_t channel) {
  if (channel < 1 || channel > 13) channel = 1;
  if (apStarted && channel == apChannel) return;

  bool ok = WiFi.softAP(AP_SSID, AP_PASSWORD, channel, 0, 4);
  apStarted = ok;
  if (ok) {
    apChannel = channel;
    Serial.printf("[WiFi] SoftAP OK · SSID=%s · IP=%s · canal %u\n",
                  AP_SSID, WiFi.softAPIP().toString().c_str(), channel);
  } else {
    Serial.println("[WiFi] SoftAP falló");
  }
}

/**
 * Lanza un intento de conexión STA sin bloquear el loop.
 * Alinea el canal del SoftAP con el del router antes de asociar.
 */
static void beginStaAttempt() {
  lastAttemptAt = millis();

  const DeviceConfig& cfg = config_get();
  if (cfg.wifiSsid[0] == '\0') {
    if (failureStreak < 255) failureStreak++;
    Serial.println("[WiFi] STA sin SSID configurado · usa el portal en 192.168.4.1");
    return;
  }

  // El scan bloquea ~1-3 s, así que solo se repite cuando aún no sabemos el
  // canal o tras varios fallos seguidos (el router pudo cambiar de canal).
  const bool needScan = (staChannel == 0) || (failureStreak > 0 && failureStreak % 3 == 0);
  if (needScan) {
    uint8_t found = scanChannelFor(cfg.wifiSsid);
    if (found) staChannel = found;
  }

  if (staChannel) {
    // Mover el SoftAP al canal del router evita el conflicto de radio.
    startSoftAP(staChannel);
  } else if (!apStarted) {
    startSoftAP(1);
  }

  Serial.printf("[WiFi] STA conectando a %s (intento %u)\n", cfg.wifiSsid, failureStreak + 1);
  WiFi.disconnect(false, false);
  WiFi.begin(cfg.wifiSsid, cfg.wifiPassword);

  staConnecting = true;
  staAttemptStartedAt = millis();
  lastAttemptAt = staAttemptStartedAt;
}

/** Espera calculada antes del siguiente intento, según fallos acumulados. */
static unsigned long retryDelayMs() {
  unsigned long delayMs = RETRY_BASE_MS;
  for (uint8_t i = 1; i < failureStreak && delayMs < RETRY_MAX_MS; i++) {
    delayMs <<= 1;
  }
  return delayMs > RETRY_MAX_MS ? RETRY_MAX_MS : delayMs;
}

void wifi_begin() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  // Sin autoreconnect propio del SDK: la máquina de estados de este módulo
  // controla los reintentos y el canal del SoftAP.
  WiFi.setAutoReconnect(false);
  WiFi.persistent(false);

  startSoftAP(1);
  beginStaAttempt();
}

void wifi_ensure_connected() {
  const bool connected = WiFi.status() == WL_CONNECTED;

  if (connected) {
    if (!wasConnected) {
      Serial.printf("[WiFi] STA OK · IP: %s · RSSI: %d dBm · canal %d\n",
                    WiFi.localIP().toString().c_str(), WiFi.RSSI(), WiFi.channel());
      wasConnected = true;
      staConnecting = false;
      failureStreak = 0;
    }
    return;
  }

  if (wasConnected) {
    Serial.println("[WiFi] STA caído");
    wasConnected = false;
    staConnecting = false;
    failureStreak = 0;
    // El router pudo cambiar de canal: forzar un nuevo scan y reintentar ya.
    staChannel = 0;
    beginStaAttempt();
    return;
  }

  // Intento en curso: esperar hasta el timeout antes de declararlo fallido.
  if (staConnecting) {
    if (millis() - staAttemptStartedAt < WIFI_TIMEOUT_MS) return;
    staConnecting = false;
    if (failureStreak < 255) failureStreak++;
    Serial.printf("[WiFi] Intento fallido (%s) · reintento en %lus\n",
                  staStatusName(WiFi.status()), retryDelayMs() / 1000UL);
    lastAttemptAt = millis();
    return;
  }

  if (millis() - lastAttemptAt < retryDelayMs()) return;
  beginStaAttempt();
}

bool wifi_connected() {
  return WiFi.status() == WL_CONNECTED;
}
