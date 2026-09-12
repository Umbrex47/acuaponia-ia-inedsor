# Despliegue de la simulación en Dokploy (laptop + Tailscale)

Guía para poner Aquaponic OS en modo **simulación** (sin ESP32) sobre una
laptop con Linux ligero, Tailscale y Dokploy. El backend publica telemetría
falsa (`MQTT_DEMO_ENABLED=true`) y el dashboard la muestra vía WebSocket.

```
Backend demo ──MQTT──► Mosquitto ──subscribe──► Backend ──WebSocket /ws──► Dashboard
   (docker-compose.dokploy.yml)                                      (Nginx)
```

No hace falta broker externo ni hardware: todo corre en la laptop.

---

## 1. Prerequisitos en la laptop

- Linux ligero (Debian/Ubuntu server o similar) con Docker + Docker Compose.
- Tailscale instalado y conectado: `tailscale up`. Apuntá el **nombre mágico**
  de la máquina (`tailscale status` → algo como `laptop.acuaponia.ts.net`).
- Dokploy: `curl -sSL https://dokploy.com/install.sh | sh`.

> El firewall de la laptop debe permitir los puertos que publiques
> (`8080`, `3000`) para quienes entren por Tailscale (la red de Tailscale ya
> está autorizada entre tus dispositivos).

---

## 2. Crear el proyecto en Dokploy

1. Dokploy → **New Project** → **Docker Compose**.
2. Conectá el repositorio (GitHub/GitLab) y la rama de despliegue
   (`deploy/dokploy-simulacion`).
3. En *Compose File Path* apuntá a: `docker-compose.dokploy.yml`.
4. En *Environment Variables* definí al menos:

   | Variable      | Valor                                              |
   | ------------- | -------------------------------------------------- |
   | `HOST_FQDN`   | `laptop.acuaponia.ts.net` (tu nombre de Tailscale) |

   El resto tiene defaults sensatos para la simulación:
   `MQTT_DEMO_ENABLED=true`, `APP_DEMO_MODE=true`, puertos `8080`/`3000`.

5. **Deploy**. Dokploy builda `backend` y `frontend` y levanta `mongo` +
   `mosquitto`.

---

## 3. Abrir el dashboard

Desde cualquier dispositivo en tu Tailscale:

```
http://laptop.acuaponia.ts.net:3000
```

El dashboard carga el modal de demostración y, tras aceptarlo, las tarjetas de
sensores se actualizan cada ~5 s con la telemetría simulada del backend.

---

## 4. Variables clave (en la UI de Dokploy)

| Variable            | Default                         | Para qué                  |
| ------------------- | ------------------------------- | ------------------------- |
| `HOST_FQDN`         | `localhost`                     | Nombre de Tailscale para armar las URLs del dashboard |
| `MQTT_DEMO_ENABLED` | `true`                          | Activa el simulador del backend |
| `MQTT_DEMO_INTERVAL_MS` | `5000`                     | Frecuencia de la telemetría simulada |
| `APP_API_URL`       | `http://<HOST_FQDN>:8080`       | URL HTTP del backend (desde el navegador) |
| `APP_WS_URL`        | `ws://<HOST_FQDN>:8080/ws`      | WebSocket del dashboard |
| `APP_DEMO_MODE`     | `true`                          | Muestra el modal de demo |
| `BACKEND_PORT`      | `8080`                          | Puerto publicado del backend |
| `FRONTEND_PORT`     | `3000`                          | Puerto publicado del dashboard |

> Si querés enrutar por el proxy de Dokploy en vez de puertos, quitá la
> sección `ports` de `docker-compose.dokploy.yml` y asigná dominios a
> `backend`/`frontend` en la UI; entonces `APP_API_URL`/`APP_WS_URL` deben
> apuntar a esos dominios.

---

## 5. Verificación rápida

- Health del backend: `http://<HOST_FQDN>:8080/health` →
  `{"status":"ok","mqtt":{"connected":true},"demo":{"enabled":true}}`.
- WebSocket: `wscat -c ws://<HOST_FQDN>:8080/ws` recibe `{"type":"welcome",…}`
  y luego telemetría.
- Dashboard: las tarjetas de sensores se mueven solas cada 5 s.

---

## 6. Notas de seguridad

- Es una simulación en tu red privada Tailscale: no expongas los puertos a
  Internet sin un proxy con TLS.
- `MAIL_*`/`TELEGRAM_*` van vacíos por defecto (alertas por correo/TG
  desactivadas). Si las querés, completálas en la UI de Dokploy.
- No hay secretos en el repo: `render.yaml` y `.env.example` usan `sync:false`
  o valores vacíos. Las claves se ponen solo en la UI de Dokploy.
