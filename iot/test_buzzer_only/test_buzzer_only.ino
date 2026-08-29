// ────────────────────────────────────────────────────────────────
//  Diagnóstico de buzzer pasivo vs activo
//  Placa: ESP32 Dev Module
//
//  Conexión:
//    GPIO 19 → resistencia 100 Ω → (+) del buzzer
//    (-) del buzzer → GND
//
//  Un buzzer PASIVO necesita una señal PWM/tone() para sonar.
//  Un buzzer ACTIVO suena solo con HIGH (tensión continua).
//
//  Este sketch prueba ambos tipos y te dice por serial cuál responde.
// ────────────────────────────────────────────────────────────────

const int PIN_BUZZER = 19;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("=== Diagnóstico de buzzer ===");
  Serial.println("Escucha cada etapa y lee el resultado.");

  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // Test 1: activo DC (HIGH constante).
  Serial.println("[TEST 1] Buzzer ACTIVO: HIGH constante 2s...");
  digitalWrite(PIN_BUZZER, HIGH);
  delay(2000);
  digitalWrite(PIN_BUZZER, LOW);
  Serial.println("  ¿Sonó un tono continuo? Sí → es ACTIVO.");
  delay(1000);

  // Test 2: pasivo con tone() a 2000 Hz.
  Serial.println("[TEST 2] Buzzer PASIVO: tone(2000Hz) 2s...");
  tone(PIN_BUZZER, 2000);
  delay(2000);
  noTone(PIN_BUZZER);
  Serial.println("  ¿Sonó un pitido agudo? Sí → es PASIVO.");
  delay(1000);

  // Test 3: pasivo a frecuencias variadas.
  Serial.println("[TEST 3] Buzzer PASIVO: barrido 1kHz → 4kHz...");
  for (int freq = 1000; freq <= 4000; freq += 500) {
    Serial.print("  Frecuencia ");
    Serial.print(freq);
    Serial.println(" Hz");
    tone(PIN_BUZZER, freq);
    delay(400);
  }
  noTone(PIN_BUZZER);
  delay(1000);

  // Test 4: parpadeo simple (HIGH/LOW largo) — como usaba el firmware antes.
  Serial.println("[TEST 4] Parpadeo HIGH/LOW 200ms (buzzer pasivo NO sonará así)...");
  for (int i = 0; i < 5; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(200);
    digitalWrite(PIN_BUZZER, LOW);
    delay(200);
  }
  Serial.println("  Si solo hizo clic, confirma que es PASIVO.");

  Serial.println("=== Fin del diagnóstico ===");
  Serial.println("Recomendación:");
  Serial.println("  - Si sonó el TEST 1: el buzzer es ACTIVO → usar digitalWrite(HIGH).");
  Serial.println("  - Si sonó el TEST 2/3: el buzzer es PASIVO → usar tone()/noTone().");
}

void loop() {
  // No hace nada.
}
