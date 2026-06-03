# ────────────────────────────────────────────────────────────────
#  Aquaponic OS · Habilitar Mosquitto para la red local (ESP32)
#
#  Qué hace:
#   1. Corrige mosquitto.conf (listener en 0.0.0.0 + allow_anonymous)
#   2. Configura el servicio para que cargue ese .conf (-c)
#   3. Abre el puerto 1883/TCP en el Firewall de Windows
#   4. Reinicia el servicio (revierte si falla)
#
#  Requiere ejecutarse como ADMINISTRADOR.
# ────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'

$mosqExe  = 'C:\Program Files\Mosquitto\mosquitto.exe'
$mosqConf = 'C:\Program Files\Mosquitto\mosquitto.conf'

Write-Host '=== 1/4 · Respaldo y corrección de mosquitto.conf ===' -ForegroundColor Cyan

if (-not (Test-Path $mosqConf)) { throw "No existe $mosqConf" }

$backup = "$mosqConf.bak"
if (-not (Test-Path $backup)) {
    Copy-Item $mosqConf $backup
    Write-Host "Respaldo creado: $backup"
} else {
    Write-Host "Respaldo ya existe: $backup"
}

$conf = Get-Content $mosqConf -Raw

# listener 1883  ->  listener 1883 0.0.0.0  (escucha en todas las interfaces)
$conf = $conf -replace '(?m)^\s*listener\s+1883\s*$', 'listener 1883 0.0.0.0'

# listener_allow_anonymous (sin valor)  ->  allow_anonymous true
$conf = $conf -replace '(?m)^\s*listener_allow_anonymous\s*$', 'allow_anonymous true'

# Si no quedó ningún allow_anonymous activo, lo añadimos.
if ($conf -notmatch '(?m)^\s*allow_anonymous\s+true\s*$') {
    $conf = $conf.TrimEnd() + "`r`nallow_anonymous true`r`n"
}

Set-Content -Path $mosqConf -Value $conf -Encoding ASCII
Write-Host 'mosquitto.conf actualizado.' -ForegroundColor Green

Write-Host ''
Write-Host '=== 2/4 · Configurar el servicio para cargar el .conf ===' -ForegroundColor Cyan

$svc = Get-CimInstance Win32_Service -Filter "Name='mosquitto'"
$originalPath = $svc.PathName
Write-Host "binPath actual: $originalPath"

$newPath = '"{0}" run -c "{1}"' -f $mosqExe, $mosqConf
# sc.exe requiere el espacio tras 'binPath='
& sc.exe config mosquitto binPath= $newPath | Out-Null
Write-Host "binPath nuevo:  $newPath" -ForegroundColor Green

Write-Host ''
Write-Host '=== 3/4 · Regla de Firewall para 1883/TCP ===' -ForegroundColor Cyan

$rule = Get-NetFirewallRule -DisplayName 'Mosquitto MQTT 1883' -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host 'La regla de Firewall ya existe.'
} else {
    New-NetFirewallRule -DisplayName 'Mosquitto MQTT 1883' `
        -Direction Inbound -Protocol TCP -LocalPort 1883 `
        -Action Allow -Profile Any | Out-Null
    Write-Host 'Regla de Firewall creada (1883/TCP entrante).' -ForegroundColor Green
}

Write-Host ''
Write-Host '=== 4/4 · Reiniciar Mosquitto ===' -ForegroundColor Cyan

try {
    Restart-Service mosquitto
    Start-Sleep -Seconds 2
    $status = (Get-Service mosquitto).Status
    if ($status -ne 'Running') { throw "El servicio quedó en estado $status" }
    Write-Host 'Servicio Mosquitto reiniciado correctamente.' -ForegroundColor Green
}
catch {
    Write-Warning "Falló el reinicio: $_"
    Write-Warning 'Revirtiendo binPath original...'
    & sc.exe config mosquitto binPath= $originalPath | Out-Null
    Restart-Service mosquitto -ErrorAction SilentlyContinue
    throw 'Se revirtió la configuración del servicio. Revisa mosquitto.conf.'
}

Write-Host ''
Write-Host '=== Verificación: ¿escucha en la red? ===' -ForegroundColor Cyan
netstat -ano | Select-String ':1883'

Write-Host ''
Write-Host 'Listo. Debe aparecer 0.0.0.0:1883 LISTENING.' -ForegroundColor Green
Write-Host 'Ahora reinicia el ESP32 y revisa el monitor serial.' -ForegroundColor Green
