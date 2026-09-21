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

## Ver la cámara desde cualquier lugar

La cámara usa una IP privada de la red local, por lo que Render no puede conectarse directamente a ella. Para la vista remota, este proyecto debe ejecutarse en un PC de la misma red y publicarse mediante un túnel HTTPS.

### 1. Obtener la URL RTSP real

Abre PowerShell y ejecuta:

`irm https://raw.githubusercontent.com/maak27272/Camara/main/scripts/get-stream-uri.ps1 | iex`

El script consulta ONVIF en `192.168.100.100:5000`, usa el perfil principal `IPCProfilesToken0` y copia la URL RTSP al portapapeles.

### 2. Configuración local

Copia `.env.example` como `.env`. Configura `APP_PASSWORD`, pega la dirección obtenida en `CAMERA_RTSP_URL` y cambia `ENABLE_STREAM=true`.

### 3. Ejecutar el puente

Ejecuta `npm install` y después `npm start`. El PC debe permanecer encendido y conectado a la red de la cámara.

### 4. Acceso remoto

Instala y autentica el agente de ngrok. Publica el puerto local con `ngrok http 10000`. Visita únicamente la dirección HTTPS asignada a tu cuenta.

No abras el puerto RTSP 554 en el router y no publiques credenciales de la cámara en GitHub.
