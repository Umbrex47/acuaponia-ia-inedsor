// ────────────────────────────────────────────────────────────────
//  Test individual de los 3 relés (bomba, aireador, dispensador).
//  Placa: ESP32 Dev Module
//
//  Pines (mismos que el firmware principal):
//    - Bomba de agua      → GPIO 26
//    - Aireador           → GPIO 27
//    - Dispensador comida → GPIO 25
//
//  ⚠️ Módulos de relé baratos son ACTIVOS EN LOW: digitalWrite(pin, LOW)
//  enciende la carga. Si tu módulo es activo en HIGH, cambiá ACTIVE_LOW
//  a 0.
// ────────────────────────────────────────────────────────────────

#define ACTIVE_LOW 1

const int RELAYS[] = {26, 27, 25};
const char* NAMES[] = {"bomba_agua", "aireador", "dispensador_comida"};

void setRelay(int pin, bool on) {
  digitalWrite(pin, (ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW)));
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("=== Test relés ===");
  Serial.println("Cada relé se enciende/apaga durante 2 s, en orden.");
  Serial.println();
  for (int i = 0; i < 3; i++) {
    pinMode(RELAYS[i], OUTPUT);
    setRelay(RELAYS[i], false);   // arrancar apagado
  }
}

void loop() {
  for (int i = 0; i < 3; i++) {
    Serial.printf("[TEST] %s ON 2s\n", NAMES[i]);
    setRelay(RELAYS[i], true);
    delay(2000);
    Serial.printf("[TEST] %s OFF\n", NAMES[i]);
    setRelay(RELAYS[i], false);
    delay(500);
  }
  Serial.println("[TEST] Los 3 relés ON 2s");
  for (int i = 0; i < 3; i++) setRelay(RELAYS[i], true);
  delay(2000);
  Serial.println("[TEST] Todos OFF. Repetir en 3 s.\n");
  for (int i = 0; i < 3; i++) setRelay(RELAYS[i], false);
  delay(3000);
}