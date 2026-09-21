[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectDir = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "MiCamara"
$zipPath = Join-Path $env:TEMP "micamara-main.zip"
$extractDir = Join-Path $env:TEMP "micamara-main-extract"

function Stop-WithMessage([string]$Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Read-Host "Pulsa Enter para cerrar"
  exit 1
}

Write-Host ""
Write-Host "Configurando Mi Camara..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage "Node.js no esta instalado. Instala Node.js 20 LTS y vuelve a ejecutar este comando."
}

if (-not (Test-Path (Join-Path $projectDir "package.json"))) {
  Write-Host "Descargando el proyecto..." -ForegroundColor Cyan
  if (Test-Path $extractDir) {
    Remove-Item $extractDir -Recurse -Force
  }

  Invoke-WebRequest -Uri "https://github.com/maak27272/Camara/archive/refs/heads/main.zip" -OutFile $zipPath -UseBasicParsing
  Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
  $downloadedDir = Join-Path $extractDir "Camara-main"

  if (-not (Test-Path (Join-Path $downloadedDir "package.json"))) {
    Stop-WithMessage "No se pudo preparar el proyecto descargado."
  }

  New-Item -ItemType Directory -Path $projectDir -Force | Out-Null
  Get-ChildItem -Path $downloadedDir -Force | ForEach-Object {
    Copy-Item $_.FullName -Destination $projectDir -Recurse -Force
  }
}

$passwordSecure = Read-Host "Crea una contrasena privada para entrar a tu camara" -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecure)

try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

if ([string]::IsNullOrWhiteSpace($password) -or $password.Length -lt 8) {
  Stop-WithMessage "La contrasena debe tener al menos 8 caracteres."
}

$envFile = @"
PORT=10000
NODE_ENV=development
APP_USERNAME=admin
APP_PASSWORD=$password
CAMERA_NAME=Mi Camara
CAMERA_HOST=192.168.100.100
CAMERA_PORT=5000
CAMERA_USERNAME=
CAMERA_PASSWORD=
CAMERA_RTSP_URL=rtsp://192.168.100.100:554/onvif1
CAMERA_ONVIF_URL=http://192.168.100.100:5000/onvif/device_service
ENABLE_STREAM=true
ENABLE_RECORDING=false
RECORDING_RETENTION_HOURS=24
"@

Set-Content -Path (Join-Path $projectDir ".env") -Value $envFile -Encoding UTF8

Write-Host "Instalando componentes..." -ForegroundColor Cyan
Push-Location $projectDir
try {
  & npm install
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage "npm install fallo. Enviame una foto del error."
  }
} finally {
  Pop-Location
}

$escapedProjectDir = $projectDir.Replace("'", "''")
Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$escapedProjectDir'; npm start"
)

Start-Sleep -Seconds 5
Start-Process "http://localhost:10000"

Write-Host ""
Write-Host "Mi Camara esta iniciando." -ForegroundColor Green
Write-Host "Usuario: admin"
Write-Host "Direccion local: http://localhost:10000"
Write-Host "No cierres la nueva ventana de PowerShell mientras uses la camara." -ForegroundColor Yellow
