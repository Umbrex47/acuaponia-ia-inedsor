#include "config_portal.h"
#include "config_store.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "../config.h"

#include <ArduinoJson.h>
#include <DNSServer.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_sleep.h>

static WebServer server(AP_HTTP_PORT);
static DNSServer dnsServer;
static bool rebootPending = false;
static bool sleepPending = false;
static unsigned long actionAtMs = 0;

// Página embebida (sin CDN: el SoftAP suele quedar sin Internet en el teléfono).
static const char INDEX_HTML[] PROGMEM = R"HTML(
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="color-scheme" content="dark"/>
<title>Aquaponic · Configuración</title>
<style>
:root{
  --depth:#071f1c;
  --tank:#0c332e;
  --glass:#143f39;
  --jade:#2ec4b6;
  --jade-dim:#1a8f84;
  --foam:#d7f3ee;
  --mist:rgba(215,243,238,.72);
  --warn:#e0a45a;
  --danger:#e07a6a;
  --line:rgba(46,196,182,.28);
  --field:rgba(7,31,28,.55);
  --ok:#6ddea8;
  --fail:#e07a6a;
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{
  font-family:"Trebuchet MS","Segoe UI",sans-serif;
  color:var(--foam);
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(46,196,182,.22), transparent 55%),
    linear-gradient(180deg, var(--tank) 0%, var(--depth) 55%, #041412 100%);
  background-attachment:fixed;
}
body::before{
  content:"";
  position:fixed;inset:0;pointer-events:none;opacity:.35;
  background-image:repeating-linear-gradient(
    -12deg, transparent 0 11px, rgba(46,196,182,.04) 11px 12px);
}
.wrap{position:relative;max-width:28rem;margin:0 auto;padding:1.5rem 1.25rem 3rem}
.brand{
  font-family:Georgia,"Palatino Linotype",serif;
  font-size:clamp(2.4rem,9vw,3.2rem);
  font-weight:400;letter-spacing:.02em;line-height:1;
  margin:0 0 .35rem;color:var(--foam);
}
.waterline{
  height:2px;width:100%;margin:0 0 1rem;border:0;
  background:linear-gradient(90deg, transparent, var(--jade), transparent);
  position:relative;overflow:hidden;
}
.waterline::after{
  content:"";position:absolute;inset:0;
  background:linear-gradient(90deg, transparent, rgba(215,243,238,.9), transparent);
  transform:translateX(-100%);
  animation:ripple 3.2s ease-in-out infinite;
}
@keyframes ripple{
  0%{transform:translateX(-100%)}
  55%{transform:translateX(100%)}
  100%{transform:translateX(100%)}
}
.lede{margin:0 0 1.4rem;color:var(--mist);font-size:1rem;line-height:1.45;max-width:22rem}
.status{
  display:grid;grid-template-columns:1fr 1fr;gap:.65rem;
  margin:0 0 1.6rem;padding:0;list-style:none;
}
.status li{
  padding:.55rem .7rem;
  border-left:2px solid var(--line);
  background:transparent;
}
.status .k{display:block;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--jade-dim)}
.status .v{display:block;margin-top:.2rem;font-size:.92rem}
.dot{display:inline-block;width:.55rem;height:.55rem;border-radius:50%;margin-right:.35rem;vertical-align:middle}
.dot.on{background:var(--ok);box-shadow:0 0 8px rgba(109,222,168,.5)}
.dot.off{background:var(--fail)}
h2{
  font-family:Georgia,"Palatino Linotype",serif;
  font-size:1.15rem;font-weight:400;margin:1.6rem 0 .75rem;color:var(--foam);
}
label{display:block;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--jade-dim);margin:0 0 .35rem}
.field{margin:0 0 .85rem}
input,select{
  width:100%;appearance:none;
  background:var(--field);
  border:1px solid var(--line);
  border-radius:0;color:var(--foam);
  padding:.7rem .75rem;font:inherit;font-size:1rem;
}
input:focus,select:focus{outline:2px solid var(--jade);outline-offset:1px}
.hint{margin:.3rem 0 0;font-size:.78rem;color:var(--mist)}
.toggle{display:grid;grid-template-columns:auto 1fr;gap:.5rem .6rem;align-items:center}
.toggle input{width:1.15rem;height:1.15rem;accent-color:var(--jade);padding:0}
.toggle label{margin:0;font-size:.85rem;letter-spacing:.04em;text-transform:none;color:var(--foam)}
.toggle .hint{grid-column:1 / -1;margin:0}
.row{display:grid;grid-template-columns:1fr auto;gap:.5rem;align-items:end}
.actions{display:flex;flex-direction:column;gap:.6rem;margin-top:1.5rem}
button{
  font:inherit;font-size:1rem;cursor:pointer;
  border:1px solid transparent;padding:.85rem 1rem;
  transition:background .2s,border-color .2s,transform .15s;
}
button:active{transform:scale(.99)}
.btn-primary{background:var(--jade);color:var(--depth);font-weight:700}
.btn-primary:hover{background:#3fd4c5}
.btn-ghost{background:transparent;border-color:var(--line);color:var(--foam)}
.btn-ghost:hover{border-color:var(--jade)}
.btn-warn{background:transparent;border-color:var(--warn);color:var(--warn)}
.btn-danger{background:transparent;border-color:var(--danger);color:var(--danger)}
.toast{
  position:fixed;left:50%;bottom:1.25rem;transform:translateX(-50%) translateY(120%);
  background:var(--glass);border:1px solid var(--jade);color:var(--foam);
  padding:.7rem 1rem;font-size:.9rem;max-width:min(92vw,24rem);
  transition:transform .35s ease;z-index:20;pointer-events:none;
}
.toast.show{transform:translateX(-50%) translateY(0)}
.scan-list{margin:.4rem 0 0;padding:0;list-style:none;max-height:9rem;overflow:auto}
.scan-list button{
  width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid var(--line);
  color:var(--foam);padding:.55rem 0;font-size:.9rem;
}
.scan-list button:hover{color:var(--jade)}
@media (prefers-reduced-motion:reduce){
  .waterline::after{animation:none}
}
</style>
</head>
<body>
<main class="wrap">
  <h1 class="brand">Aquaponic</h1>
  <div class="waterline" aria-hidden="true"></div>
  <p class="lede">Ajusta la red del módulo y el broker. Los cambios se guardan en la ESP32.</p>

  <ul class="status" id="status">
    <li><span class="k">SoftAP</span><span class="v" id="apInfo">—</span></li>
    <li><span class="k">WiFi hogar</span><span class="v" id="staInfo">—</span></li>
    <li><span class="k">MQTT</span><span class="v" id="mqttInfo">—</span></li>
    <li><span class="k">Uptime</span><span class="v" id="upInfo">—</span></li>
  </ul>

  <form id="cfgForm" autocomplete="off">
    <h2>Red WiFi</h2>
    <div class="field">
      <label for="wifiSsid">Nombre de la red (SSID)</label>
      <div class="row">
        <input id="wifiSsid" name="wifiSsid" maxlength="32" required/>
        <button type="button" class="btn-ghost" id="btnScan">Buscar</button>
      </div>
      <ul class="scan-list" id="scanList" hidden></ul>
    </div>
    <div class="field">
      <label for="wifiPassword">Clave WiFi</label>
      <input id="wifiPassword" name="wifiPassword" type="password" maxlength="64" placeholder="Sin cambio si lo dejas vacío"/>
      <p class="hint" id="wifiPassHint"></p>
    </div>

    <h2>Broker MQTT</h2>
    <div class="field">
      <label for="mqttHost">Host o IP</label>
      <input id="mqttHost" name="mqttHost" maxlength="79" required/>
    </div>
    <div class="field toggle">
      <input id="mqttTls" name="mqttTls" type="checkbox"/>
      <label for="mqttTls">Cifrar con TLS</label>
      <p class="hint">Actívalo para brokers en la nube (puerto 8883). Desactívalo para Mosquitto local (1883).</p>
    </div>
    <div class="field">
      <label for="mqttPort">Puerto</label>
      <input id="mqttPort" name="mqttPort" type="number" min="1" max="65535" required/>
    </div>
    <div class="field">
      <label for="mqttClientId">ID del dispositivo</label>
      <input id="mqttClientId" name="mqttClientId" maxlength="31" required/>
    </div>
    <div class="field">
      <label for="mqttUsername">Usuario (opcional)</label>
      <input id="mqttUsername" name="mqttUsername" maxlength="31"/>
    </div>
    <div class="field">
      <label for="mqttPassword">Clave MQTT</label>
      <input id="mqttPassword" name="mqttPassword" type="password" maxlength="63" placeholder="Sin cambio si lo dejas vacío"/>
      <p class="hint" id="mqttPassHint"></p>
    </div>

    <div class="actions">
      <button type="submit" class="btn-primary">Guardar y reiniciar</button>
      <button type="button" class="btn-warn" id="btnReboot">Reiniciar ahora</button>
      <button type="button" class="btn-danger" id="btnSleep">Apagar (deep sleep)</button>
    </div>
  </form>
</main>
<div class="toast" id="toast" role="status"></div>
<script>
const $ = (id) => document.getElementById(id);
function toast(msg){
  const t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3200);
}
function fmtUp(ms){
  const s=Math.floor(ms/1000); const m=Math.floor(s/60); const h=Math.floor(m/60);
  if(h) return h+'h '+(m%60)+'m';
  if(m) return m+'m '+(s%60)+'s';
  return s+'s';
}
async function loadStatus(){
  const r=await fetch('/api/status'); const j=await r.json();
  $('apInfo').textContent=j.apSsid+' · '+j.apIp;
  const sta=$('staInfo');
  sta.innerHTML='<span class="dot '+(j.staConnected?'on':'off')+'"></span>'+
    (j.staConnected?(j.staIp+' · '+j.rssi+' dBm'):'Sin conexión');
  $('mqttInfo').innerHTML='<span class="dot '+(j.mqttConnected?'on':'off')+'"></span>'+
    (j.mqttConnected?('Conectado'+(j.mqttTls?' · TLS':'')):'Desconectado');
  $('upInfo').textContent=fmtUp(j.uptimeMs);
}
async function loadConfig(){
  const r=await fetch('/api/config'); const j=await r.json();
  $('wifiSsid').value=j.wifiSsid||'';
  $('mqttHost').value=j.mqttHost||'';
  $('mqttPort').value=j.mqttPort||8883;
  $('mqttTls').checked=!!j.mqttTls;
  $('mqttClientId').value=j.mqttClientId||'';
  $('mqttUsername').value=j.mqttUsername||'';
  $('wifiPassHint').textContent=j.wifiPasswordSet?'Hay una clave guardada. Déjala vacía para no cambiarla.':'Sin clave guardada.';
  $('mqttPassHint').textContent=j.mqttPasswordSet?'Hay una clave guardada. Déjala vacía para no cambiarla.':'Sin clave (anónimo).';
}
$('cfgForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const body={
    wifiSsid:$('wifiSsid').value.trim(),
    wifiPassword:$('wifiPassword').value,
    mqttHost:$('mqttHost').value.trim(),
    mqttPort:Number($('mqttPort').value),
    mqttTls:$('mqttTls').checked,
    mqttClientId:$('mqttClientId').value.trim(),
    mqttUsername:$('mqttUsername').value.trim(),
    mqttPassword:$('mqttPassword').value
  };
  const r=await fetch('/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ toast(j.error||'No se pudo guardar'); return; }
  toast('Guardado. Reiniciando…');
});
$('btnReboot').addEventListener('click', async ()=>{
  if(!confirm('¿Reiniciar la ESP32?')) return;
  await fetch('/api/reboot',{method:'POST'});
  toast('Reiniciando…');
});
$('btnSleep').addEventListener('click', async ()=>{
  if(!confirm('La ESP32 entrará en deep sleep. Despierta con el botón EN/RESET.')) return;
  await fetch('/api/shutdown',{method:'POST'});
  toast('Entrando en deep sleep…');
});
$('btnScan').addEventListener('click', async ()=>{
  $('btnScan').disabled=true; $('btnScan').textContent='…';
  try{
    const r=await fetch('/api/scan'); const j=await r.json();
    const list=$('scanList'); list.innerHTML=''; list.hidden=false;
    (j.networks||[]).forEach(n=>{
      const li=document.createElement('li');
      const b=document.createElement('button'); b.type='button';
      b.textContent=n.ssid+'  ('+n.rssi+' dBm'+(n.open?', abierta':'')+')';
      b.addEventListener('click',()=>{ $('wifiSsid').value=n.ssid; list.hidden=true; });
      li.appendChild(b); list.appendChild(li);
    });
    if(!(j.networks||[]).length) toast('No se encontraron redes');
  }catch(err){ toast('Error al escanear'); }
  $('btnScan').disabled=false; $('btnScan').textContent='Buscar';
});
loadConfig(); loadStatus(); setInterval(loadStatus, 4000);
</script>
</body>
</html>
)HTML";

static void sendJson(int code, const String& body) {
  server.send(code, "application/json", body);
}

static void handleRoot() {
  server.send_P(200, "text/html", INDEX_HTML);
}

static void handleStatus() {
  StaticJsonDocument<384> doc;
  doc["apSsid"] = wifi_ap_ssid();
  doc["apIp"] = wifi_ap_ip().toString();
  doc["staConnected"] = wifi_connected();
  doc["staIp"] = wifi_connected() ? wifi_sta_ip().toString() : "";
  doc["rssi"] = wifi_sta_rssi();
  doc["mqttConnected"] = mqtt_connected();
  doc["mqttTls"] = config_get().mqttTls;
  doc["uptimeMs"] = millis();
  doc["persisted"] = config_was_persisted();

  String out;
  serializeJson(doc, out);
  sendJson(200, out);
}

static void handleGetConfig() {
  const DeviceConfig& cfg = config_get();
  StaticJsonDocument<512> doc;
  doc["wifiSsid"] = cfg.wifiSsid;
  doc["wifiPasswordSet"] = cfg.wifiPassword[0] != '\0';
  doc["mqttHost"] = cfg.mqttHost;
  doc["mqttPort"] = cfg.mqttPort;
  doc["mqttTls"] = cfg.mqttTls;
  doc["mqttClientId"] = cfg.mqttClientId;
  doc["mqttUsername"] = cfg.mqttUsername;
  doc["mqttPasswordSet"] = cfg.mqttPassword[0] != '\0';

  String out;
  serializeJson(doc, out);
  sendJson(200, out);
}

static void copyField(char* dst, size_t dstLen, JsonVariantConst v) {
  if (v.isNull()) return;
  const char* s = v.as<const char*>();
  if (!s) return;
  strncpy(dst, s, dstLen - 1);
  dst[dstLen - 1] = '\0';
}

static void handlePostConfig() {
  if (!server.hasArg("plain")) {
    sendJson(400, "{\"error\":\"Cuerpo JSON requerido\"}");
    return;
  }

  StaticJsonDocument<768> doc;
  DeserializationError err = deserializeJson(doc, server.arg("plain"));
  if (err) {
    sendJson(400, "{\"error\":\"JSON inválido\"}");
    return;
  }

  DeviceConfig cfg = config_get();

  if (!doc["wifiSsid"].isNull()) {
    copyField(cfg.wifiSsid, sizeof(cfg.wifiSsid), doc["wifiSsid"]);
  }
  // Contraseña vacía = conservar la anterior
  if (!doc["wifiPassword"].isNull()) {
    const char* p = doc["wifiPassword"];
    if (p && p[0] != '\0') {
      copyField(cfg.wifiPassword, sizeof(cfg.wifiPassword), doc["wifiPassword"]);
    }
  }
  if (!doc["mqttHost"].isNull()) {
    copyField(cfg.mqttHost, sizeof(cfg.mqttHost), doc["mqttHost"]);
  }
  if (!doc["mqttPort"].isNull()) {
    cfg.mqttPort = doc["mqttPort"].as<uint16_t>();
  }
  if (!doc["mqttTls"].isNull()) {
    cfg.mqttTls = doc["mqttTls"].as<bool>();
  }
  if (!doc["mqttClientId"].isNull()) {
    copyField(cfg.mqttClientId, sizeof(cfg.mqttClientId), doc["mqttClientId"]);
  }
  if (!doc["mqttUsername"].isNull()) {
    copyField(cfg.mqttUsername, sizeof(cfg.mqttUsername), doc["mqttUsername"]);
  }
  if (!doc["mqttPassword"].isNull()) {
    const char* p = doc["mqttPassword"];
    if (p && p[0] != '\0') {
      copyField(cfg.mqttPassword, sizeof(cfg.mqttPassword), doc["mqttPassword"]);
    }
  }

  if (cfg.wifiSsid[0] == '\0' || cfg.mqttHost[0] == '\0' || cfg.mqttClientId[0] == '\0') {
    sendJson(400, "{\"error\":\"SSID, host MQTT e ID son obligatorios\"}");
    return;
  }
  if (cfg.mqttPort == 0) {
    sendJson(400, "{\"error\":\"Puerto MQTT inválido\"}");
    return;
  }

  if (!config_save(cfg)) {
    sendJson(500, "{\"error\":\"No se pudo escribir NVS\"}");
    return;
  }

  sendJson(200, "{\"ok\":true,\"rebooting\":true}");
  rebootPending = true;
  actionAtMs = millis() + 800;
}

static void handleScan() {
  // softAP + scan puede devolver listas cortas; es suficiente para elegir SSID.
  int n = WiFi.scanNetworks(/*async=*/false, /*hidden=*/false);
  StaticJsonDocument<3072> doc;
  JsonArray arr = doc.createNestedArray("networks");
  for (int i = 0; i < n && i < 20; i++) {
    JsonObject o = arr.createNestedObject();
    o["ssid"] = WiFi.SSID(i);
    o["rssi"] = WiFi.RSSI(i);
    o["open"] = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN);
  }
  WiFi.scanDelete();
  String out;
  serializeJson(doc, out);
  sendJson(200, out);
}

static void handleReboot() {
  sendJson(200, "{\"ok\":true,\"rebooting\":true}");
  rebootPending = true;
  actionAtMs = millis() + 500;
}

static void handleShutdown() {
  sendJson(200, "{\"ok\":true,\"sleeping\":true}");
  sleepPending = true;
  actionAtMs = millis() + 500;
}

// Captive portal: cualquier host desconocido → portal.
static void handleCaptive() {
  server.sendHeader("Location", String("http://") + wifi_ap_ip().toString() + "/", true);
  server.send(302, "text/plain", "");
}

static void handleNotFound() {
  if (!wifi_connected() || server.hostHeader() != wifi_ap_ip().toString()) {
    handleCaptive();
    return;
  }
  server.send(404, "text/plain", "Not found");
}

void config_portal_begin() {
  dnsServer.start(53, "*", WiFi.softAPIP());

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/config", HTTP_GET, handleGetConfig);
  server.on("/api/config", HTTP_POST, handlePostConfig);
  server.on("/api/scan", HTTP_GET, handleScan);
  server.on("/api/reboot", HTTP_POST, handleReboot);
  server.on("/api/shutdown", HTTP_POST, handleShutdown);

  // Endpoints típicos de captive portal (Android / iOS / Windows).
  server.on("/generate_204", HTTP_GET, handleCaptive);
  server.on("/gen_204", HTTP_GET, handleCaptive);
  server.on("/hotspot-detect.html", HTTP_GET, handleRoot);
  server.on("/canonical.html", HTTP_GET, handleRoot);
  server.on("/ncsi.txt", HTTP_GET, handleCaptive);
  server.on("/connecttest.txt", HTTP_GET, handleCaptive);
  server.on("/redirect", HTTP_GET, handleCaptive);
  server.onNotFound(handleNotFound);

  server.begin();
  Serial.printf("[Portal] http://%s/  · SoftAP %s / %s\n",
                WiFi.softAPIP().toString().c_str(), AP_SSID, AP_PASSWORD);
}

void config_portal_loop() {
  dnsServer.processNextRequest();
  server.handleClient();

  if ((rebootPending || sleepPending) && millis() >= actionAtMs) {
    if (sleepPending) {
      Serial.println("[Portal] Deep sleep · despierta con EN/RESET");
      delay(100);
      esp_deep_sleep_start();
    }
    Serial.println("[Portal] Reiniciando…");
    delay(100);
    ESP.restart();
  }
}
