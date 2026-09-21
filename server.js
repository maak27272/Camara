require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 10000);
const dataDir = path.join(__dirname, 'data');
const hlsDir = path.join(dataDir, 'hls');
const recordingsDir = path.join(dataDir, 'recordings');
for (const dir of [dataDir, hlsDir, recordingsDir]) fs.mkdirSync(dir, { recursive: true });

app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const sessions = new Map();
const attempts = new Map();
let streamProcess = null;
let recordingProcess = null;

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')).filter(v => v.length === 2));
}
function session(req) {
  const token = cookies(req).micamara_session;
  const item = token && sessions.get(token);
  if (!item || item.expires < Date.now()) { if (token) sessions.delete(token); return null; }
  return item;
}
function auth(req, res, next) {
  if (session(req)) return next();
  res.status(401).json({ ok: false, message: 'Autenticacion requerida.' });
}
function configured() {
  return Boolean(process.env.CAMERA_RTSP_URL || process.env.CAMERA_HOST);
}
function cameraInfo() {
  return {
    name: process.env.CAMERA_NAME || 'Mi Camara',
    configured: configured(),
    host: process.env.CAMERA_HOST || null,
    port: Number(process.env.CAMERA_PORT || 80),
    rtspConfigured: Boolean(process.env.CAMERA_RTSP_URL),
    onvifConfigured: Boolean(process.env.CAMERA_ONVIF_URL),
    streamEnabled: process.env.ENABLE_STREAM === 'true',
    recordingEnabled: process.env.ENABLE_RECORDING === 'true'
  };
}
function stopProcess(proc) { if (proc && !proc.killed) proc.kill('SIGTERM'); }
function clearHls() { for (const f of fs.readdirSync(hlsDir)) fs.rmSync(path.join(hlsDir, f), { force: true }); }
function startStream() {
  if (streamProcess || process.env.ENABLE_STREAM !== 'true' || !process.env.CAMERA_RTSP_URL) return;
  clearHls();
  streamProcess = spawn(ffmpegPath, ['-rtsp_transport','tcp','-i',process.env.CAMERA_RTSP_URL,'-an','-c:v','libx264','-preset','veryfast','-tune','zerolatency','-f','hls','-hls_time','2','-hls_list_size','5','-hls_flags','delete_segments+append_list',path.join(hlsDir,'live.m3u8')], { stdio: 'ignore' });
  streamProcess.on('exit', () => { streamProcess = null; setTimeout(startStream, 5000); });
}
function startRecording() {
  if (recordingProcess || process.env.ENABLE_RECORDING !== 'true' || !process.env.CAMERA_RTSP_URL) return;
  const pattern = path.join(recordingsDir, '%Y-%m-%d_%H-%M-%S.mp4');
  recordingProcess = spawn(ffmpegPath, ['-rtsp_transport','tcp','-i',process.env.CAMERA_RTSP_URL,'-map','0:v:0','-an','-c:v','copy','-f','segment','-segment_time','300','-reset_timestamps','1','-strftime','1',pattern], { stdio: 'ignore' });
  recordingProcess.on('exit', () => { recordingProcess = null; setTimeout(startRecording, 5000); });
}
function cleanupRecordings() {
  const hours = Math.max(1, Number(process.env.RECORDING_RETENTION_HOURS || 24));
  const cutoff = Date.now() - hours * 3600000;
  for (const f of fs.readdirSync(recordingsDir)) {
    const p = path.join(recordingsDir, f);
    try { if (fs.statSync(p).mtimeMs < cutoff) fs.rmSync(p, { force: true }); } catch {}
  }
}
setInterval(cleanupRecordings, 3600000).unref();

app.get('/health', (_req, res) => res.json({ ok: true, service: 'micamara', stream: Boolean(streamProcess), recording: Boolean(recordingProcess) }));
app.get('/api/session', (req, res) => res.json({ authenticated: Boolean(session(req)) }));
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const state = attempts.get(ip) || { count: 0, until: 0 };
  if (state.until > Date.now()) return res.status(429).json({ ok:false, message:'Demasiados intentos. Espera unos minutos.' });
  const user = process.env.APP_USERNAME || 'admin';
  const pass = process.env.APP_PASSWORD || '';
  if (!pass) return res.status(503).json({ ok:false, message:'Configura APP_PASSWORD en Render.' });
  if (!safeEqual(req.body.username, user) || !safeEqual(req.body.password, pass)) {
    state.count++;
    if (state.count >= 5) { state.until = Date.now() + 15 * 60000; state.count = 0; }
    attempts.set(ip, state);
    return res.status(401).json({ ok:false, message:'Usuario o contraseña incorrectos.' });
  }
  attempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expires: Date.now() + 12 * 3600000 });
  const secureCookie = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', 'micamara_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200' + secureCookie);
  res.json({ ok:true });
});
app.post('/api/logout', (req, res) => {
  const token = cookies(req).micamara_session;
  if (token) sessions.delete(token);
  const secureCookie = req.secure ? '; Secure' : '';
  res.setHeader('Set-Cookie','micamara_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' + secureCookie);
  res.json({ ok:true });
});
app.get('/api/camera', auth, (_req,res) => res.json(cameraInfo()));
app.post('/api/camera/test', auth, (_req,res) => {
  if (!configured()) return res.status(400).json({ok:false,message:'Faltan los datos de la cámara.'});
  res.json({ok:true,message:'Configuración detectada. Activa RTSP cuando tengas la URL real de Yosse.'});
});
app.get('/api/recordings', auth, (_req,res) => {
  const files = fs.readdirSync(recordingsDir).filter(f=>f.endsWith('.mp4')).sort().reverse();
  res.json({ files });
});
app.get('/api/recordings/:name', auth, (req,res) => {
  const name = path.basename(req.params.name);
  if (!name.endsWith('.mp4')) return res.sendStatus(400);
  const file = path.join(recordingsDir,name);
  if (!fs.existsSync(file)) return res.sendStatus(404);
  res.sendFile(file);
});
app.delete('/api/recordings/:name', auth, (req,res) => {
  const name = path.basename(req.params.name);
  if (!name.endsWith('.mp4')) return res.sendStatus(400);
  fs.rmSync(path.join(recordingsDir,name),{force:true});
  res.json({ok:true});
});
app.use('/stream', auth, express.static(hlsDir, { etag:false, maxAge:0 }));
app.get('*', (_req,res) => res.sendFile(path.join(__dirname,'public','index.html')));

app.listen(port,'0.0.0.0',()=>{
  console.log('Mi Camara disponible en el puerto ' + port);
  startStream();
  startRecording();
  cleanupRecordings();
});
process.on('SIGTERM',()=>{ stopProcess(streamProcess); stopProcess(recordingProcess); process.exit(0); });
