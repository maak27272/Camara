# Mi Cámara

Panel privado para una cámara IP/Yosse.

## Funciones
- Inicio de sesión con cookie HttpOnly.
- Protección básica contra intentos repetidos de acceso.
- Configuración de cámara por variables de entorno.
- Preparado para RTSP y ONVIF.
- Conversión RTSP a HLS mediante FFmpeg para reproducir en navegador.
- Reconexión automática del proceso de vídeo.
- Grabación MP4 en segmentos de 5 minutos.
- Historial y eliminación de grabaciones.
- Retención automática configurable.
- Health check y despliegue en Render.

## Variables necesarias
APP_USERNAME, APP_PASSWORD, CAMERA_NAME, CAMERA_HOST, CAMERA_PORT, CAMERA_USERNAME, CAMERA_PASSWORD, CAMERA_RTSP_URL y CAMERA_ONVIF_URL.

ENABLE_STREAM y ENABLE_RECORDING deben permanecer en false hasta conocer la URL RTSP real de la cámara.

## Importante
No guardes credenciales reales en GitHub. Configúralas como variables privadas en Render.

El almacenamiento local de Render Free no debe considerarse almacenamiento permanente. Para conservar grabaciones a largo plazo habrá que conectar almacenamiento de objetos.
