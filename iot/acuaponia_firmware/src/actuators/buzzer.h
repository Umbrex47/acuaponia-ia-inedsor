#pragma once

// Buzzer pasivo de pre-aviso para el dispensador de comida.
//
// Secuencia (al disparar `buzzer_start_countdown`):
//   t=20s → beep corto (BUZZER_BEEP_SHORT_MS)
//   t=15s → beep corto
//   t=10s → beep corto
//   t=5s  → beep corto
//   t=0s  → beep largo (BUZZER_BEEP_LONG_MS)
//         → beep corto · pausa · beep corto
//
// El control del GPIO es HIGH/LOW (el buzzer pasivo oscila solo).
void buzzer_begin();

// Mantiene la máquina de estados viva. Llamar desde loop().
void buzzer_loop();

// Inicia la cuenta regresiva. Si ya hay una en curso, la reinicia.
void buzzer_start_countdown();

bool buzzer_is_active();