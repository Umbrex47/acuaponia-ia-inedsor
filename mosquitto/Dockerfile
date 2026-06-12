FROM eclipse-mosquitto:2

# Config horneada en la imagen para evitar bind mounts relativos,
# que Coolify no resuelve de forma fiable al desplegar.
COPY config/mosquitto.conf /mosquitto/config/mosquitto.conf
