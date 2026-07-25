# Despliegue en producción: Render (backend) + Vercel (dashboard)

Guía paso a paso para poner Aquaponic OS en la nube con el broker MQTT que ya
tienes en **EMQX Cloud Serverless**.

```
ESP32  ──MQTT/TLS 8883──►  EMQX Cloud Serverless
                                  │
                                  │ mqtts:// (suscripción)
                                  ▼
                       Backend NestJS  (Render, Docker)
                       HTTP  https://<servicio>.onrender.com
                       WS    wss://<servicio>.onrender.com/ws
                                  │
                                  │ WebSocket JSON
                                  ▼
                       Dashboard React (Vercel, estático)
```

El ESP32 **no habla con Render**: publica al broker y el backend se suscribe.
Por eso no hay que abrir puertos ni tocar el firmware para pasar a la nube.

---

## 1. Backend en Render

### 1.1 Opción recomendada: Blueprint (`render.yaml`)

El repo ya incluye `render.yaml` en la raíz, apuntando a `backend/Dockerfile`.

1. Render Dashboard → **New → Blueprint**.
2. Conecta el repositorio y selecciona la rama.
3. Render lee `render.yaml` y te pide los valores de las variables marcadas
   como `sync: false` (las de EMQX, Mongo y alertas). Pégalos ahí.
4. **Apply** → primer build.

### 1.2 Opción manual (New → Web Service)

Si prefieres crearlo a mano, usa exactamente esta configuración:

| Campo | Valor |
| ----- | ----- |
| Type | **Web Service** |
| Language / Runtime | **Docker** |
| Repository | tu repo |
| Branch | `main` (o la que uses) |
| Root Directory | *(vacío)* |
| Dockerfile Path | `./backend/Dockerfile` |
| Docker Build Context Directory | `./backend` |
| Health Check Path | `/health` |
| Instance Type | Free (o Starter, ver aviso abajo) |

No hay que rellenar Build Command ni Start Command: el `Dockerfile` ya hace
`npm ci` + `nest build` en la etapa de compilación y arranca con
`node dist/main` como usuario `node`.

**Alternativa sin Docker** (Runtime = Node). Solo si no quieres Docker:

- Root Directory: `backend`
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm run start:prod`

El `--include=dev` es obligatorio: `nest build` vive en `devDependencies` y
Render define `NODE_ENV=production` por defecto.

### 1.3 Aviso sobre el plan Free

Un Web Service gratuito **se suspende tras ~15 min sin tráfico HTTP**. Al
suspenderse se corta la conexión MQTT y dejas de registrar telemetría hasta
que alguien vuelva a abrir el dashboard (con ~50 s de arranque en frío).

Para monitoreo 24/7 tienes tres caminos:

1. Plan **Starter** de Render (sin suspensión). Es la opción real para
   producción con hardware publicando cada 2 s.
2. Un ping externo a `/health` cada 10 min (UptimeRobot, cron-job.org). Mantiene
   el servicio vivo mientras el proveedor de ping no falle.
3. Aceptar la suspensión y activar en el dashboard el MQTT directo por WSS
   (`VITE_MQTT_ENABLED=true`), que sigue funcionando aunque Render duerma —
   pero entonces no hay persistencia ni alertas mientras esté dormido.

### 1.4 Variables de entorno del backend (Render)

Pégalas en **Environment → Environment Variables**. Bloque mínimo para
funcionar con tu EMQX y sin base de datos:

```bash
PORT=8080

MQTT_URL=mqtts://a91836cf.ala.us-east-1.emqxsl.com:8883
MQTT_USERNAME=esp32
MQTT_PASSWORD=<TU_CLAVE_MQTT>
MQTT_CLIENT_ID=aquaponic-backend-render
MQTT_RECONNECT_MS=3000
MQTT_TOPIC_PREFIX=aquaponic

MQTT_DEMO_ENABLED=false
MQTT_DEMO_INTERVAL_MS=5000

MONGODB_URI=
MONGODB_DB_NAME=aquaponic
READINGS_PERSIST_ENABLED=true

ALERTS_ENABLED=true
ALERTS_COOLDOWN_MS=300000

DECISION_ENABLED=true
PUMP_ACTUATOR_ID=bomba_agua
PUMP_ON_LEVEL=24
PUMP_OFF_LEVEL=20
PUMP_MIN_STATE_MS=60000

REPORT_ENABLED=false
FISH_ASSESSMENT_ENABLED=false
PLANT_ASSESSMENT_ENABLED=false
```

Notas importantes:

- `MQTT_CLIENT_ID` **debe ser distinto** del que usa tu Nest local y del
  `MQTT_CLIENT_ID` del ESP32. Si dos clientes usan el mismo ID, el broker
  expulsa al anterior y verás una reconexión infinita en bucle.
- `MQTT_DEMO_ENABLED=false` es obligatorio con hardware real; si no, el
  simulador mezcla lecturas falsas con las del ESP32.
- `MQTT_URL` usa `mqtts://` (TCP con TLS), **no** el puerto WebSocket 8084.
  El cliente valida el certificado con los CA del sistema del contenedor
  Alpine; no hay que montar ningún `.pem`.
- Los bloques de correo (`MAIL_*`) y Telegram (`TELEGRAM_*`) son opcionales:
  si `MAIL_HOST` o `TELEGRAM_BOT_TOKEN` quedan vacíos, ese canal se apaga solo.
  Actívalos junto con `REPORT_ENABLED=true` cuando quieras los reportes.

Anota la URL pública que te asigna Render, algo como
`https://aquaponic-backend.onrender.com`. La necesitas en el paso siguiente.

---

## 2. Dashboard en Vercel

### 2.1 Configuración del proyecto

Vercel → **Add New → Project** → importa el repo:

| Campo | Valor |
| ----- | ----- |
| Framework Preset | **Vite** |
| Root Directory | **`frontend`** |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | 20.x o superior |

El archivo `frontend/vercel.json` ya fija estos valores, el *rewrite* de SPA y
las cabeceras de caché, así que basta con marcar el **Root Directory** en
`frontend` y Vercel hace el resto.

### 2.2 Variables de entorno del frontend (Vercel)

Vite **incrusta las `VITE_*` en el bundle durante el build**. No son secretos
de servidor: todo lo que pongas aquí es visible en el navegador, y hay que
**redesplegar** para que un cambio surta efecto.

Defínelas en Production (y Preview, si quieres previews funcionales):

```bash
VITE_API_URL=https://aquaponic-backend.onrender.com
VITE_WS_URL=wss://aquaponic-backend.onrender.com/ws
VITE_WS_ENABLED=true

VITE_DEMO_MODE=false

VITE_MQTT_ENABLED=false
VITE_MQTT_URL=
VITE_MQTT_USERNAME=
VITE_MQTT_PASSWORD=

VITE_MQTT_TOPIC_SENSORS=aquaponic/sensors/#
VITE_MQTT_TOPIC_FISH=aquaponic/fish/#
VITE_MQTT_TOPIC_PLANTS=aquaponic/plants/#
VITE_MQTT_TOPIC_CAMERAS=aquaponic/cameras/#

VITE_CAMERA_FISH_URL=
VITE_CAMERA_PLANTS_URL=
```

- **`https://` y `wss://` son obligatorios.** Vercel sirve por HTTPS y el
  navegador bloquea cualquier `http://` o `ws://` por contenido mixto.
- Sustituye `aquaponic-backend.onrender.com` por tu dominio real de Render.
- `VITE_MQTT_ENABLED=false` mantiene la ruta única: broker → backend → WS.

### 2.3 Opcional: MQTT directo desde el navegador

Si además quieres que el dashboard lea del broker sin pasar por Render (útil
mientras el plan Free duerme):

```bash
VITE_MQTT_ENABLED=true
VITE_MQTT_URL=wss://a91836cf.ala.us-east-1.emqxsl.com:8084/mqtt
VITE_MQTT_USERNAME=dashboard
VITE_MQTT_PASSWORD=<CLAVE_SOLO_LECTURA>
VITE_MQTT_CLIENT_ID=aquaponic-dashboard
```

La ruta `/mqtt` del puerto 8084 es la que expone EMQX para WebSocket seguro.
Crea en EMQX un usuario **distinto y de solo suscripción** para esto: la clave
viaja en el JavaScript del navegador y cualquiera puede leerla.

### 2.4 Sobre `config.js`

`frontend/index.html` carga `/config.js` antes del bundle. En Docker ese
archivo lo genera `docker-entrypoint.sh` desde las variables `APP_*`; en Vercel
se sirve el placeholder de `frontend/public/config.js`, que solo fija
`demoMode: 'false'`. El resto de claves quedan vacías y `src/config/api.js`
cae a los valores `VITE_*` del build. No hay que tocar nada.

Consecuencia práctica: en Vercel `VITE_DEMO_MODE` no puede reactivar el modal
de demostración, porque el valor de runtime tiene prioridad. Si algún día lo
necesitas, edita `public/config.js`.

---

## 3. CORS y WebSocket

- **CORS ya está resuelto**: `backend/src/main.ts` llama a
  `app.enableCors({ origin: true, credentials: true })`, que refleja el origen
  de quien pregunte. El dominio de Vercel funciona sin configurar nada.
  Si más adelante quieres restringirlo, cambia `origin: true` por la lista de
  dominios permitidos.
- **El WebSocket vive en `/ws`** (`@WebSocketGateway({ path: '/ws' })` con
  `WsAdapter`), en el **mismo puerto HTTP** que la API. Render soporta
  WebSockets sobre HTTPS sin configuración extra: `wss://…/ws` funciona directo.
- El handshake WS no pasa por CORS, así que no hay nada que ajustar ahí.
- Si el dashboard se queda en "reconectando", casi siempre es (a) `ws://` en
  vez de `wss://`, (b) falta el sufijo `/ws`, o (c) el servicio Free de Render
  está dormido y aún no completó el arranque en frío.

---

## 4. ESP32: no hay que cambiar nada

El firmware ya publica contra EMQX y el backend en la nube lee del mismo
broker. Deja `arduino_secrets.h` (o lo guardado en NVS por el portal SoftAP)
exactamente así:

```c
#define MQTT_HOST       "a91836cf.ala.us-east-1.emqxsl.com"
#define MQTT_PORT       8883
#define MQTT_TLS        1
#define MQTT_CLIENT_ID  "esp32-acuaponia-01"
#define MQTT_USERNAME   "esp32"
#define MQTT_PASSWORD   "<TU_CLAVE_MQTT>"
```

Recordatorios del firmware:

- Con `MQTT_TLS 1` el ESP32 valida el CA de `src/net/ca_certs.h` y sincroniza
  la hora por NTP antes del handshake (el certificado tiene fecha de validez).
  Sin NTP el TLS falla.
- El portal SoftAP (`Aquaponic-Setup` → `192.168.4.1`) sigue siendo la vía para
  cambiar WiFi y broker en campo; lo guardado en NVS pisa a `arduino_secrets.h`.
- Los topics están fijos en firmware (`aquaponic/sensors/telemetry` y
  `aquaponic/sensors/status`) y coinciden con `MQTT_TOPIC_PREFIX=aquaponic`
  del backend. No los cambies en un solo lado.
- `arduino_secrets.h` está en `.gitignore`: nunca se sube.

---

## 5. MongoDB (opcional, para el histórico)

Render no ofrece MongoDB gestionado. Si quieres persistir lecturas:

1. Crea un cluster **M0 (gratis)** en MongoDB Atlas, en una región cercana a
   la de tu servicio de Render (p. ej. `us-west-2` para `oregon`).
2. Crea un usuario de base de datos con permisos solo sobre `aquaponic`.
3. Network Access → permite `0.0.0.0/0`. Las IP de salida de Render en plan
   Free/Starter son dinámicas; la protección real es la contraseña.
4. En Render añade:

```bash
MONGODB_URI=mongodb+srv://<usuario>:<clave>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=aquaponic
READINGS_PERSIST_ENABLED=true
```

Con `MONGODB_URI` vacío el backend arranca igual y simplemente no guarda nada
(`ReadingsModule.forRoot()` decide en tiempo de import). Los reportes por
correo con ventana de 24 h sí dependen del histórico.

---

## 6. Seguridad

- **Nada de secretos en Git.** `.env`, `backend/.env` y `arduino_secrets.h` ya
  están en `.gitignore`; `render.yaml` usa `sync: false` para todo lo sensible.
  Verifica antes de cada commit con `git status`.
- **Rota lo que se haya expuesto.** Si la clave MQTT o el App Secret de la API
  de EMQX han circulado en texto plano (chats, capturas, correos), cámbialos en
  la consola de EMQX y actualiza Render y `arduino_secrets.h`. El App ID /
  App Secret son para la **API de gestión** de EMQX: no hacen falta para
  publicar ni suscribirse, así que no los pongas en Render ni en Vercel.
- **Un usuario MQTT por cliente.** En EMQX crea credenciales separadas y
  aplica ACL por topic:
  - `esp32` → publica en `aquaponic/sensors/#`, se suscribe a `aquaponic/commands/#`
  - `backend` → se suscribe a `aquaponic/#`, publica en `aquaponic/commands/#`
  - `dashboard` (solo si activas MQTT en el navegador) → suscripción de solo lectura
  Así, si filtras la clave del navegador, nadie puede encender la bomba.
- **La API del backend no tiene autenticación.** `POST /api/mqtt/publish`,
  `POST /decision/pump/mode` y `POST /alerts/manual` quedan públicos en la URL
  de Render: cualquiera con la URL puede publicar en el broker o forzar el modo
  de la bomba. Mientras sea un prototipo puede pasar, pero no difundas la URL;
  para producción real añade una API key o un guard de Nest.
- Las claves de un build de Vercel son públicas por definición. Nunca pongas
  ahí `MQTT_PASSWORD` del backend, tokens de Telegram ni credenciales de correo.

---

## 7. Checklist de verificación

Backend (Render):

- [ ] El build termina en verde y el servicio queda **Live**.
- [ ] Los logs muestran `Conectando a MQTT: mqtts://…` seguido de `MQTT conectado`.
- [ ] Aparecen las líneas `Suscrito: aquaponic/…` para cada topic.
- [ ] `curl https://<servicio>.onrender.com/health` responde
      `{"status":"ok","mqtt":{"connected":true,"error":null},"demo":{"enabled":false}}`.
- [ ] `curl https://<servicio>.onrender.com/` devuelve el JSON con `"websocket":"/ws"`.
- [ ] La consola de EMQX muestra el cliente `aquaponic-backend-render` conectado.
- [ ] Con el ESP32 encendido, los logs del backend registran telemetría entrante.

WebSocket:

- [ ] `npx wscat -c wss://<servicio>.onrender.com/ws` recibe el mensaje
      `{"type":"welcome",…}` y luego telemetría.

Frontend (Vercel):

- [ ] El deploy termina en **Ready** y la página carga sin pantalla en blanco.
- [ ] DevTools → Network → WS: hay una conexión a `wss://…/ws` en estado 101.
- [ ] La consola del navegador no muestra errores de *mixed content* ni de CORS.
- [ ] Las tarjetas de sensores se actualizan al ritmo de publicación del ESP32
      (≈2 s con `PUBLISH_INTERVAL_MS 2000`).
- [ ] Al reiniciar el ESP32, el dashboard refleja el corte y la reconexión.

Extremo a extremo:

- [ ] Desconecta el ESP32 → el dashboard deja de recibir; reconéctalo → vuelve.
- [ ] Si activaste Mongo: `curl https://<servicio>.onrender.com/readings/latest`
      devuelve la última lectura guardada, y `/readings` el histórico.
- [ ] Si activaste alertas: fuerza un valor fuera de umbral y confirma que
      llega el correo o el mensaje de Telegram.
