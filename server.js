// Ξεφτέρια — μικρός server χωρίς εξαρτήσεις (μόνο Node). Εκκίνηση: node server.js
// Σερβίρει τα αρχεία και μεταφέρει την κατάσταση κάθε παίκτη στους υπόλοιπους του δωματίου (SSE).
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const FILES = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/questions.js': ['questions.js', 'text/javascript'], '/game.js': ['game.js', 'text/javascript'] };
const rooms = new Map(); // κωδικός -> Map(id -> {s, res, t})
const okRoom = r => /^[A-Z]{4}$/.test(r || ''), okId = i => /^[a-z0-9]{4,16}$/.test(i || '');

function cast(code) {
  const r = rooms.get(code); if (!r) return;
  const data = 'data: ' + JSON.stringify([...r].filter(([, c]) => c.s).map(([id, c]) => ({ id, s: c.s }))) + '\n\n';
  for (const c of r.values()) if (c.res) c.res.write(data);
}
function client(code, id) {
  if (!rooms.has(code)) rooms.set(code, new Map());
  const r = rooms.get(code);
  if (!r.has(id)) { if (r.size >= 6) return null; r.set(id, { s: null, res: null, t: null }); }
  return r.get(id);
}
function drop(code, id) {
  const r = rooms.get(code); if (!r) return;
  r.delete(id); if (r.size === 0) rooms.delete(code); else cast(code);
}
function body(req, cb) {
  let d = ''; req.on('data', c => { d += c; if (d.length > 16384) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(d)); } catch (e) { cb(null); } });
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' && FILES[u.pathname]) {
    const [f, type] = FILES[u.pathname];
    return fs.readFile(path.join(__dirname, f), (e, buf) => {
      if (e) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-cache' }); res.end(buf);
    });
  }
  if (u.pathname === '/api/ping') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
  if (u.pathname === '/api/events') {
    const code = u.searchParams.get('room'), id = u.searchParams.get('id');
    const c = okRoom(code) && okId(id) && rooms.size < 2000 ? client(code, id) : null;
    if (!c) { res.writeHead(400); return res.end(); }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    if (c.res) c.res.end(); clearTimeout(c.t); c.res = res; cast(code);
    const hb = setInterval(() => res.write(': hb\n\n'), 20000);
    req.on('close', () => {
      clearInterval(hb); if (c.res !== res) return;
      c.res = null; c.t = setTimeout(() => { if (!c.res) drop(code, id); }, 8000);
    });
    return;
  }
  if (req.method === 'POST' && (u.pathname === '/api/state' || u.pathname === '/api/leave')) {
    return body(req, j => {
      if (!j || !okRoom(j.room) || !okId(j.id)) { res.writeHead(400); return res.end(); }
      if (u.pathname === '/api/leave') { const r = rooms.get(j.room), c = r && r.get(j.id); if (c && c.res) c.res.end(); drop(j.room, j.id); }
      else { const c = rooms.get(j.room) && rooms.get(j.room).get(j.id); if (c && j.s && typeof j.s === 'object') { c.s = j.s; cast(j.room); } }
      res.writeHead(204); res.end();
    });
  }
  res.writeHead(404); res.end('not found');
}).listen(PORT, () => console.log('Ξεφτέρια στο http://localhost:' + PORT));
