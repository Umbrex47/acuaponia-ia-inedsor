#include "lcd_display.h"
#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "../config.h"

// Inicializamos el objeto lcd con la dirección típica 0x27, de 16 columnas x 2 filas
// Si en físico no enciende o no muestra texto, puede que la dirección sea 0x3F.
static LiquidCrystal_I2C lcd(0x27, 16, 2);

static unsigned long lastUpdateMs = 0;
static const unsigned long LCD_UPDATE_INTERVAL = 2000;
static bool lcdReady = false;

void lcd_begin() {
  // Aseguramos iniciar Wire (aunque bme280 u otros ya lo hagan)
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(" Aquaponic OS ");
  lcd.setCursor(0, 1);
  lcd.print(" Iniciando... ");
  
  lcdReady = true;
  Serial.println("[LCD] Pantalla I2C iniciada en 0x27 (SDA=21, SCL=22)");
}

static float lastTemp = NAN;
static int lastWaterPct = 0;

void lcd_update(bool wifiOk, bool mqttOk, float temp, int waterPercent) {
  if (!lcdReady) return;
  if (millis() - lastUpdateMs < LCD_UPDATE_INTERVAL) return;
  lastUpdateMs = millis();
  
  if (!isnan(temp)) lastTemp = temp;
  if (waterPercent >= 0) lastWaterPct = waterPercent;

  lcd.clear();

  // Fila 1: Temperatura y Nivel de Agua
  // Formato ej: "T:25.5C W:100%"
  lcd.setCursor(0, 0);
  lcd.print("T:");
  if (isnan(lastTemp)) {
    lcd.print("--.-");
  } else {
    lcd.print(lastTemp, 1);
  }
  lcd.print("C  W:");
  lcd.print(lastWaterPct);
  lcd.print("%");

  // Fila 2: Estado de conexión
  // Formato ej: "WiFi:OK MQTT:OK"
  lcd.setCursor(0, 1);
  lcd.print("WIFI:");
  lcd.print(wifiOk ? "OK" : "NO");
  lcd.print(" MQTT:");
  lcd.print(mqttOk ? "OK" : "NO");
}
