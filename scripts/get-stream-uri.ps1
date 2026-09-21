[CmdletBinding()]
param(
  [string]$CameraHost = "192.168.100.100",
  [int]$OnvifPort = 5000,
  [ValidateSet("IPCProfilesToken0", "IPCProfilesToken1")]
  [string]$ProfileToken = "IPCProfilesToken0"
)

$ErrorActionPreference = "Stop"
$endpoint = "http://$($CameraHost):$OnvifPort/onvif/device_service"
$body = @"
<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
            xmlns:tt="http://www.onvif.org/ver10/schema">
  <s:Body>
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport>
          <tt:Protocol>RTSP</tt:Protocol>
        </tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>$ProfileToken</trt:ProfileToken>
    </trt:GetStreamUri>
  </s:Body>
</s:Envelope>
"@

Write-Host ""
Write-Host "Buscando la ruta RTSP de la camara..." -ForegroundColor Cyan
Write-Host "ONVIF: $endpoint"
Write-Host "Perfil: $ProfileToken"
Write-Host ""

try {
  $contentType = 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver10/media/wsdl/GetStreamUri"'
  $response = Invoke-WebRequest -Uri $endpoint -Method Post -ContentType $contentType -Body $body -TimeoutSec 15 -UseBasicParsing
  $content = $response.Content

  $match = [regex]::Match($content, '<(?:\w+:)?Uri>([^<]+)</(?:\w+:)?Uri>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
  if (-not $match.Success) {
    Write-Host "La camara respondio, pero no devolvio la URI RTSP." -ForegroundColor Yellow
    Write-Host "Respuesta recibida:"
    Write-Output $content
    exit 2
  }

  $streamUri = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
  Write-Host "RTSP encontrado:" -ForegroundColor Green
  Write-Output $streamUri
  Set-Clipboard -Value $streamUri
  Write-Host ""
  Write-Host "La direccion tambien quedo copiada al portapapeles." -ForegroundColor Green
  Write-Host "No publiques esta direccion si contiene usuario o contrasena." -ForegroundColor Yellow
} catch {
  Write-Host "No se pudo obtener la ruta RTSP." -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host ""
  Write-Host "Confirma que el PC siga conectado a la misma red de la camara." -ForegroundColor Yellow
  exit 1
}
