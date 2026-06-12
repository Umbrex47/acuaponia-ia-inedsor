// Placeholder de configuración en runtime.
//
// En producción, el contenedor del frontend (docker-entrypoint) sobrescribe
// este archivo con los valores de las variables de entorno APP_*.
// En desarrollo se deja vacío y la app usa import.meta.env (frontend/.env).
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
