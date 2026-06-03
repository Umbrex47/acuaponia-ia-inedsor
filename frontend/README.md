# Aquaponic OS · Dashboard del Sistema Acuapónico

Aplicación web construida con **Vite + React + Tailwind CSS + GSAP** basada en los wireframes del sistema acuapónico.

## Características

- **5 pantallas navegables** con animaciones suaves entre ellas:
  1. **Dashboard** principal con 4 medidores circulares.
  2. **Ingresar parámetros** con 6 medidores y formulario.
  3. **Estado de sensores** con el ESP32 y los dispositivos.
  4. **Información de plantas** con cámara, especie, % de crecimiento y recomendaciones.
  5. **Información de peces** (Tilapia) con cámara, métricas y recomendaciones.
- **Animaciones GSAP** suaves en cada vista: gauges contadores, entradas en cascada, transiciones entre páginas, pulso del estado "Recibiendo datos", toast animado al guardar parámetros.
- **Estilo wireframe pulido**: dominio de blanco y negro, con acentos de color (azul, verde, rojo, ámbar) sólo para resaltar.
- **Diseño responsive** (móvil, tablet, desktop) gracias a Tailwind.

## Requisitos

- **Node.js 18+** (probado con Node 24).
- **npm** (incluido con Node).

## Comandos

Desde la carpeta `frontend/`:

```powershell
# Instalar dependencias (sólo la primera vez)
npm install

# Levantar el servidor de desarrollo (http://localhost:5173)
npm run dev

# Compilar para producción (genera ./dist)
npm run build

# Previsualizar el build
npm run preview
```

## Estructura

```
frontend/
├── index.html               # Entrada de Vite
├── package.json             # Dependencias y scripts
├── vite.config.js           # Configuración de Vite
├── tailwind.config.js       # Configuración de Tailwind
├── postcss.config.js        # PostCSS + autoprefixer
├── .env.example             # WebSocket y MQTT
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx             # Punto de entrada de React
    ├── App.jsx              # Router por estado + transiciones GSAP
    ├── index.css            # Estilos globales (Tailwind + componentes)
    ├── components/
    │   ├── Icon.jsx         # Iconos SVG inline (sin dependencias)
    │   ├── Window.jsx       # Marco "ventana" estilo wireframe
    │   └── CircleGauge.jsx  # Medidor circular animado con GSAP
    └── pages/
        ├── Dashboard.jsx
        ├── Parameters.jsx
        ├── Sensors.jsx
        ├── Plants.jsx
        └── Fish.jsx
```

## Stack

| Tecnología       | Uso                                          |
| ---------------- | -------------------------------------------- |
| Vite             | Servidor de desarrollo + bundler             |
| React 18         | UI declarativa                               |
| Tailwind CSS 3   | Estilos utilitarios                          |
| GSAP 3.12        | Animaciones suaves de entrada/salida y gauges |
| PostCSS          | Procesamiento de CSS                         |

## Paleta

- **Dominantes**: `#0A0A0A` (ink) y `#FAFAFA` (paper).
- **Acentos** (sólo para resaltar):
  - Azul `#2563EB` — botones primarios, estado de ánimo de peces.
  - Verde `#16A34A` — "Estable", "Saludables", "Recibiendo datos".
  - Rojo `#DC2626` — botones de acción crítica, indicador "Live".
  - Ámbar `#F59E0B` — advertencias en dispositivos.
