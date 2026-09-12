# AquaGia Mobile — App Móvil de Acuaponía

Aplicación móvil multiplataforma (iOS / Android / Web) desarrollada con **React Native** y **Expo** para:
1. **Muestreo y Monitoreo Manual**: Registro de variables críticas de calidad de agua (pH, nitratos, nitritos, amonio, oxígeno, temperatura, alcalinidad).
2. **Auditoría Integral**: Queda registrado el nombre del operador, cargo, fecha y hora exacta de cada toma de muestra.
3. **Seguimiento del Estado de los Peces**: Integración con visión artificial (YOLO + SORT), conteo de ejemplares, índice de bienestar/actividad y bitácora de inspección manual (mortalidad, alimentación, conducta).
4. **Sistema Robusto de Notificaciones**: Alertas inmediatas Push, WebSocket y bandeja de notificaciones filtrable por severidad con confirmación de lectura.
5. **Modo Sin Conexión (Offline-First)**: Permite registrar mediciones en invernadero o estanque sin cobertura Wi-Fi y sincronizar en un toque al recuperar señal.

---

## 📱 Pantallas Principales

1. **📊 Tablero (Dashboard)**: Resumen rápido de variables de agua, estado del estanque y alertas activas.
2. **🧪 Muestreo Manual (Manual Monitoring)**:
   - Formulario interactivo con evaluación instantánea de riesgo (verde: óptimo, amarillo: alerta, rojo: peligro/tóxico) mientras se teclean los valores.
   - Pestaña de historial y auditoría con detalle de quién y cuándo registró cada lote de datos.
3. **🐟 Peces (Fish Status)**:
   - Vista en vivo de telemetría de peces (conteo YOLO, score de bienestar, diagnóstico de IA).
   - Botón directo para registrar observaciones de campo y mortalidad observada.
4. **🔔 Alertas (Notifications Center)**:
   - Bandeja de notificaciones en tiempo real.
   - Filtros por severidad (🔴 Críticas, 🟡 Alertas, No leídas).
   - Botón para activar notificaciones Push en el dispositivo.
5. **⚙️ Ajustes (Settings)**:
   - Configuración de la IP o URL del backend NestJS principal.
   - Perfil predeterminado del operador.
   - Estado y sincronización manual de la cola offline.

---

## 🚀 Inicio Rápido

### Requisitos
- Node.js 18+
- Aplicación **Expo Go** instalada en tu teléfono móvil (disponible gratis en Google Play Store y Apple App Store), o un emulador de Android/iOS.

### Instalación y Ejecución

```bash
# Entrar a la carpeta mobile
cd mobile

# Instalar dependencias
npm install

# Iniciar el servidor Expo
npm start
```

Al ejecutar `npm start`, aparecerá un código QR en la terminal y en el navegador:
- Abre la app **Expo Go** en tu smartphone y escanea el código QR para abrir la app instantáneamente en tu teléfono.
- O presiona `w` para abrir la versión Web en tu navegador.
- O presiona `a` para abrir en el emulador Android.

### Conexión con el Backend NestJS
En la pantalla de **⚙️ Ajustes**, asegúrate de colocar la dirección IP de tu computadora en la red local (ejemplo: `http://192.168.1.50:8080`), para que el celular pueda comunicarse con el backend en tu PC.

---

## 📡 Capas de Fidelidad de Entrega (Estilo MQTT) y Modo Sin Conexión

La aplicación implementa un motor de cola de mensajería persistente en `AsyncStorage` (`deliveryQueue.js`) con tres niveles de calidad de servicio:

- **QoS 0 (At Most Once)**: Envío al vuelo sin reintento en caso de fallo transitorio. Ideal para telemetría no crítica.
- **QoS 1 (At Least Once)**: Garantiza la entrega mediante retransmisiones automáticas con retroceso exponencial (*exponential backoff*). Al recuperar conexión, la cola se drena en estricto orden FIFO.
- **QoS 2 (Exactly Once)**: Garantía de entrega única sin duplicados. Asigna un `messageId` único UUIDv4 transmitido en la cabecera `x-message-id`. El backend valida contra su motor de deduplicación e idempotencia (TTL 7 días), respondiendo con el ACK correspondiente y evitando doble inserción en la base de datos.

---

## 🛡️ Deduplicación e Idempotencia en el Backend

El backend NestJS cuenta con el módulo `DeduplicationModule` y la colección `IdempotencyKey`:
- Intercepta solicitudes con cabecera `x-message-id`.
- Si un paquete retransmitido por la app móvil ya fue procesado con éxito, retorna inmediatamente la respuesta original cacheada (`_deduplicated: true, _ack: 'EXACTLY_ONCE_ACK'`).
- Previene registros duplicados en `manual_readings`, `sensor_readings` y notificaciones derivadas ante inestabilidad de red.

---

## ⏰ Programación de Alertas y Recordatorios de Muestreo (Módulo Admin)

Los usuarios con rol Administrador pueden acceder a la pantalla de gestión de recordatorios (`AdminSettingsScreen.jsx`):
- **Recordatorios Recurrentes**: Configuración de intervalos (p. ej., cada 3 días a las 08:00 AM) para invitar a los técnicos a medir nitratos, nitritos, amonio y pH.
- **Recordatorios de Fecha Única**: Notificaciones programadas para calibración de sensores o desinfección de tanques.
- **Disparo Manual Inmediato**: Botón *"Disparar Alerta Ahora"* para probar y enviar recordatorios instantáneos a todos los dispositivos conectados por WebSocket y Push.
- **Scheduler Automático**: Cron job `@Cron('*/5 * * * *')` que evalúa fechas límite pendientes y emite avisos sin intervención manual.
