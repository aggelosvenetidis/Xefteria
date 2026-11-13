(() => {
'use strict';
/* ====== Ρυθμίσεις ====== */
const ART_URL = 'https://claude.ai/artifact/R2ypBZiz4jHcZppaUnb2Yv';            // σύνδεσμος της σελίδας όταν τρέχει μέσα στο Claude
const LEN = { s: [4, 4, 3, 4], n: [5, 6, 4, 5], l: [7, 8, 6, 7] };
const LEN_NAME = { s: 'Γρήγορο · 15', n: 'Κανονικό · 20', l: 'Μαραθώνιος · 28' };
const ROUNDS = [
  { n: 'Ζέσταμα', e: '🔥', pts: 100, bon: 50, t: 15, d: 'Εύκολες ερωτήσεις. 100 πόντοι + έως 50 για ταχύτητα.' },
  { n: 'Η έδρα μου', e: '🎯', pts: 150, bon: 50, t: 15, d: 'Ο καθένας διαλέγει μια κατηγορία. Παίζετε και οι δύο και στις δύο.' },
  { n: 'Ρίσκο', e: '🎲', t: 18, d: 'Βλέπεις την κατηγορία και ποντάρεις. Σωστό: κερδίζεις. Λάθος: χάνεις το ποντάρισμα.' },
  { n: 'Τελική ευθεία', e: '🏁', pts: 200, bon: 100, t: 12, d: 'Δύσκολες ερωτήσεις, λίγος χρόνος. 200 πόντοι + έως 100 για ταχύτητα.' }
];
const BETS = [50, 150, 300];
const ABORT = { abort: true };

/* ====== Βοηθητικά ====== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sum = a => a.reduce((x, y) => x + y, 0);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};

/* ====== Ερωτήσεις ====== */
const CATS = window.QCATS || [];
const Q = {};
(window.QRAW || []).forEach((blk, c) => blk.trim().split('\n').forEach((ln, i) => {
  const p = ln.split('|');
  if (p.length === 6) Q[c * 100 + i] = { id: c * 100 + i, c, d: +p[0], q: p[1], o: p.slice(2) };
}));
const ALL = Object.values(Q);
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/* «Έχω δει»: λίστα με σειρά (οι παλιότερες πρώτες) ώστε να ανακυκλώνονται οι πιο παλιές */
let seen = LS.get('xf_seen', []);
if (!Array.isArray(seen)) seen = [];
seen = seen.filter(id => Q[id]);
function markSeen(id) {
  const i = seen.indexOf(id); if (i >= 0) seen.splice(i, 1);
  seen.push(id);
  if (seen.length > ALL.length - 90) seen.splice(0, 100);
  LS.set('xf_seen', seen);
}
function encSeen() {
  const b = new Array(Math.ceil(CATS.length * 100 / 6)).fill(0);
  seen.forEach(id => { b[id / 6 | 0] |= 1 << (id % 6); });
  return b.map(x => B64[x]).join('').replace(/A+$/, '');
}
function decSeen(s) {
  const set = new Set(); if (typeof s !== 'string') return set;
  for (let i = 0; i < Math.min(s.length, 400); i++) { const v = B64.indexOf(s[i]); if (v > 0) for (let j = 0; j < 6; j++) if (v >> j & 1) set.add(i * 6 + j); }
  return set;
}

/* Επιλογή ερωτήσεων: πρώτα όσες δεν έχει δει κανείς, και με διασπορά στις κατηγορίες */
function buildGame(len, avoid) {
  const [n1, n2, n3, n4] = LEN[len]; const used = new Set();
  const pick = (n, filters, spread) => {
    const out = [], cc = {};
    for (const allowSeen of [false, true]) for (const f of filters) {
      const pool = shuffle(ALL.filter(q => f(q) && !used.has(q.id) && (allowSeen || !avoid.has(q.id))));
      for (let cap = spread ? 1 : n; cap <= n && out.length < n; cap++) for (const q of pool) {
        if (out.length >= n) break;
        if (used.has(q.id) || (cc[q.c] || 0) >= cap) continue;
        out.push(q.id); used.add(q.id); cc[q.c] = (cc[q.c] || 0) + 1;
      }
      if (out.length >= n) return out;
    }
    return out;
  };
  const r4 = pick(n4, [q => q.d === 3, q => q.d >= 2], true);
  const cats = shuffle(CATS.map((_, i) => i)).slice(0, 6);
  const pq = cats.map(c => pick(n2 / 2, [q => q.c === c && q.d === 2, q => q.c === c], false));
  const r3 = pick(n3, [q => q.d >= 2], true);
  const r1 = pick(n1, [q => q.d === 1, q => q.d <= 2], true);
  return { k: 1 + (Math.random() * 1e9 | 0), L: len, r1, oc: [cats.slice(0, 3), cats.slice(3)], pq, r3, r4 };
}
function validCfg(c) {
  try {
    const ids = a => Array.isArray(a) && a.length > 0 && a.length <= 12 && a.every(id => Q[id]);
    return c && Number.isInteger(c.k) && LEN[c.L] && ids(c.r1) && ids(c.r3) && ids(c.r4) &&
      Array.isArray(c.oc) && c.oc.length === 2 && c.oc.every(o => Array.isArray(o) && o.length === 3 && o.every(x => CATS[x])) &&
      Array.isArray(c.pq) && c.pq.length === 6 && c.pq.every(ids) && c.pq.every(a => a.length === c.pq[0].length);
  } catch (e) { return false; }
}

/* ====== Δίκτυο: κάθε παίκτης δημοσιεύει τη δική του κατάσταση, όλοι βλέπουν όλων ====== */
const NET = {
  kind: null, room: null, dead: false, code: null, my: {}, id: Math.random().toString(36).slice(2, 10), list: [], es: null, timer: null,
  online() { return this.kind === 'sse' || (this.kind === 'room' && !this.dead); },
  others() {
    if (!this.code) return [];
    if (this.kind === 'room') {
      let ps = []; try { ps = this.room.peers(); } catch (e) { }
      return ps.filter(p => p.kind === 'viewer' && !(p.isMe && p.sameTab) && p.presence && p.presence.c === this.code).map(p => ({ id: p.peer, s: p.presence }));
    }
    return this.list.filter(p => p.id !== this.id && p.s);
  },
  set(patch) {
    for (const k in patch) { if (patch[k] === null) delete this.my[k]; else this.my[k] = patch[k]; }
    if (this.kind === 'room') { try { this.room.presence(patch).catch(() => { }); } catch (e) { } }
    else if (this.kind === 'sse' && this.code) { clearTimeout(this.timer); this.timer = setTimeout(() => this.post(), 40); }
  },
  post() {
    if (!this.code) return;
    fetch('api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.code, id: this.id, s: this.my }) }).catch(() => { });
  },
  enter(code) {
    this.code = code;
    if (this.kind === 'sse') {
      this.es = new EventSource('api/events?room=' + code + '&id=' + this.id);
      this.es.onmessage = e => { try { this.list = JSON.parse(e.data); } catch (x) { } onNet(); };
      this.es.onopen = () => this.post();
    }
  },
  leave() {
    if (this.kind === 'sse' && this.code) {
      clearTimeout(this.timer); if (this.es) this.es.close(); this.es = null; this.list = [];
      fetch('api/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.code, id: this.id }) }).catch(() => { });
    }
    this.set({ c: null, r: null, g: null, a: null, p: null, k: null, L: null });
    this.code = null;
  }
};
async function initNet() {
  renderNet();
  if (window.claude && typeof window.claude.use === 'function') {
    let room = null;
    try { room = await Promise.race([window.claude.use('room'), sleep(11000).then(() => null)]); } catch (e) { }
    if (room) {
      NET.kind = 'room'; NET.room = room;
      const die = () => { NET.dead = true; renderNet(); onNet(); };
      try { room.onPeers(() => onNet(), die); if (room.onConnection) room.onConnection(() => renderNet(), () => { }); } catch (e) { die(); }
    }
  } else {
    try { const j = await (await fetch('api/ping')).json(); if (j && j.ok) NET.kind = 'sse'; } catch (e) { }
  }
  NET.ready = true; renderNet();
  if (view === 'home') renderHome();
}
function renderNet() {
  const el = $('#net'); if (!el) return;
  let t = 'Σύνδεση…', c = 'wait';
  if (NET.ready || NET.kind) {
    if (NET.kind === 'sse') { t = 'Online'; c = 'on'; }
    else if (NET.kind === 'room' && !NET.dead) { let ok = false; try { ok = NET.room.connected(); } catch (e) { } t = ok ? 'Online' : 'Σύνδεση…'; c = ok ? 'on' : 'wait'; }
    else { t = 'Μόνο προπόνηση'; c = 'off'; }
  }
  el.textContent = t; el.className = 'chip ' + c;
}

/* ====== Κατάσταση εφαρμογής ====== */
let view = 'home';
let ME = { name: LS.get('xf_name', ''), role: null };
let len = LEN[LS.get('xf_len', 'n')] ? LS.get('xf_len', 'n') : 'n';
let G = null;            // τρέχον παιχνίδι
let curK = 0;            // αναγνωριστικό τελευταίου παιχνιδιού που ξεκίνησα
let oppCache = null, oppAt = 0, oppName = 'Αντίπαλος';
let homeMsg = '';

function opp() {
  if (!ME.role) return null;
  const want = ME.role === 'h' ? 'g' : 'h';
  const o = NET.others().filter(p => p.s.r === want).sort((a, b) => a.id < b.id ? -1 : 1)[0];
  if (o) { oppCache = o.s; oppAt = Date.now(); if (typeof o.s.n === 'string' && o.s.n.trim()) oppName = o.s.n.trim().slice(0, 14); }
  return o ? o.s : null;
}
function oppAns() {
  if (!G || G.solo) return [];
  const o = opp() || oppCache;
  if (!o || o.k !== G.cfg.k || !Array.isArray(o.a)) return [];
  return o.a.filter(x => Array.isArray(x) && Number.isFinite(x[1]));
}
function onNet() {
  if (view === 'lobby') renderLobby();
  if (view === 'end') renderEndActions();
  if (view === 'game') updHud();
  if (ME.role === 'g' && (view === 'lobby' || view === 'end')) {
    const h = opp();
    if (h && h.g && h.g.k !== curK && (!Array.isArray(h.a) || h.a.length === 0) && h.k === h.g.k && validCfg(h.g)) begin(h.g, false);
  }
}
setInterval(() => { if (view !== 'home') onNet(); }, 1000);

function stage(html) { const s = $('#stage'); s.innerHTML = html; s.classList.remove('in'); void s.offsetWidth; s.classList.add('in'); }
function lenCtl() {
  return `<div class="seg" id="lenseg">${Object.keys(LEN).map(k => `<button data-len="${k}" class="${k === len ? 'act' : ''}">${LEN_NAME[k]}</button>`).join('')}</div>`;
}
function bindLen(after) {
  const el = $('#lenseg'); if (!el) return;
  el.onclick = e => { const b = e.target.closest('button'); if (!b) return; len = b.dataset.len; LS.set('xf_len', len); if (ME.role === 'h' && view === 'lobby') NET.set({ L: len }); after(); };
}

/* ====== Αρχική ====== */
function renderHome() {
  view = 'home'; $('#hud').hidden = true;
  const pre = roomFromUrl();
  const mp = NET.online();
  stage(`
    <div class="hero"><h1>Ποιος ξέρει<br><em>περισσότερα;</em></h1>
      <p>Μονομαχία γνώσεων για δύο · 4 γύροι · ${ALL.length} ερωτήσεις σε ${CATS.length} κατηγορίες</p></div>
    <label class="fld"><span>Το όνομά σου</span><input id="nm" maxlength="14" autocomplete="off" placeholder="π.χ. Άγγελος" value="${esc(ME.name)}"></label>
    <div class="fld"><span>Διάρκεια</span>${lenCtl()}</div>
    <div id="msg" class="msg">${esc(homeMsg)}</div>
    <button class="btn pri" id="mk" ${mp ? '' : 'disabled'}>⚔️ Δημιούργησε δωμάτιο</button>
    <div class="join"><input id="code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ΚΩΔΙΚΟΣ" value="${esc(pre)}"><button class="btn" id="jn" ${mp ? '' : 'disabled'}>Μπες</button></div>
    <button class="btn ghost" id="solo">🧠 Προπόνηση (μόνος)</button>
    ${NET.ready && !mp ? '<p class="hint">Η μονομαχία δεν είναι διαθέσιμη σε αυτή την προβολή — μπορείς να παίξεις προπόνηση.</p>' : ''}
    <div class="how"><b>Πώς παίζεται</b>
      ${ROUNDS.map((r, i) => `<div><i>${r.e}</i><span><b>${i + 1}. ${r.n}</b> — ${r.d}</span></div>`).join('')}
      <div><i>🛟</i><span><b>Βοήθειες</b> — μία φορά το 50:50 και μία φορά το ×2. Τρία σωστά στη σειρά δίνουν +50.</span></div>
      <div><i>♻️</i><span><b>Χωρίς επαναλήψεις</b> — το παιχνίδι θυμάται τι έχετε δει και οι δύο και διαλέγει πρώτα καινούριες ερωτήσεις.</span></div>
    </div>`);
  homeMsg = '';
  bindLen(() => { saveName(); renderHome(); });
  $('#mk').onclick = () => { if (needName()) createRoom(); };
  $('#jn').onclick = () => { if (needName()) joinRoom($('#code').value); };
  $('#code').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); };
  $('#solo').onclick = () => { saveName(); ME.role = null; begin(buildGame(len, new Set(seen)), true); };
}
function saveName() { const el = $('#nm'); if (el) { ME.name = el.value.trim().slice(0, 14); LS.set('xf_name', ME.name); } }
function needName() { saveName(); if (!ME.name) { $('#msg').textContent = 'Γράψε πρώτα ένα όνομα.'; $('#nm').focus(); return false; } return true; }
function roomFromUrl() {
  let m = null;
  try { m = /[?&]room=([A-Za-z]{4})/.exec(location.search) || /^#room-([A-Za-z]{4})$/.exec(location.hash); } catch (e) { }
  return m ? m[1].toUpperCase() : '';
}
function inviteLink(code) {
  if (NET.kind === 'sse') return location.origin + location.pathname + '?room=' + code;
  if (ART_URL.indexOf('http') === 0) return ART_URL + '#room-' + code;
  return '';
}

/* ====== Δωμάτιο ====== */
function createRoom() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let code = '';
  for (let i = 0; i < 4; i++) code += A[Math.random() * A.length | 0];
  ME.role = 'h'; oppCache = null; oppName = 'Αντίπαλος'; curK = 0;
  NET.enter(code);
  NET.set({ c: code, n: ME.name, r: 'h', L: len, sn: encSeen(), k: 0, a: [], p: null, g: null });
  view = 'lobby'; renderLobby();
}
async function joinRoom(raw) {
  const code = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { $('#msg').textContent = 'Ο κωδικός έχει 4 γράμματα.'; return; }
  $('#msg').textContent = 'Αναζήτηση δωματίου…';
  ME.role = 'g'; oppCache = null; oppName = 'Αντίπαλος'; curK = 0;
  NET.enter(code);
  NET.set({ c: code, n: ME.name, r: 'g', sn: encSeen(), k: 0, a: [], p: null, g: null });
  view = 'joining';
  const t0 = Date.now(); let host = null;
  while (Date.now() - t0 < 6000 && !(host = opp())) await sleep(200);
  if (view !== 'joining') return;
  const full = NET.others().some(p => p.s.r === 'g');
  if (!host || full) {
    NET.leave(); ME.role = null;
    homeMsg = full ? 'Το δωμάτιο είναι ήδη γεμάτο.' : 'Δεν βρέθηκε δωμάτιο με αυτόν τον κωδικό. Πρέπει ο δημιουργός να το έχει ανοιχτό.';
    renderHome(); return;
  }
  view = 'lobby'; renderLobby(); onNet();
}
function leaveRoom() {
  G = null; NET.leave(); ME.role = null; oppCache = null; renderHome();
}
function renderLobby() {
  $('#hud').hidden = true;
  const o = opp(); const code = NET.code; const link = inviteLink(code);
  const host = ME.role === 'h';
  const busy = !host && o && Array.isArray(o.a) && o.a.length > 0;
  const L = host ? len : (o && LEN[o.L] ? o.L : 'n');
  const key = [host, !!o, oppName, L, busy].join('|');
  if ($('#lobby') && $('#lobby').dataset.key === key) return;
  stage(`<div id="lobby" data-key="${esc(key)}">
    <p class="eyebrow">Δωμάτιο</p>
    <div class="code">${esc(code)}</div>
    ${host ? `<div class="row">
        ${link ? '<button class="btn" id="cpl">🔗 Αντιγραφή συνδέσμου</button>' : ''}
        <button class="btn" id="cpc">📋 Αντιγραφή κωδικού</button></div>
      <input id="cpy" class="cpy" readonly hidden>` : ''}
    <div class="vs">
      <div class="who me"><b>${esc(ME.name)}</b><small>εσύ</small></div><span>VS</span>
      <div class="who op ${o ? '' : 'empty'}"><b>${o ? esc(oppName) : '…'}</b><small>${o ? 'έτοιμος/η' : 'αναμονή'}</small></div>
    </div>
    ${host ? `<div class="fld"><span>Διάρκεια</span>${lenCtl()}</div>
      <button class="btn pri" id="go" ${o ? '' : 'disabled'}>${o ? 'Ξεκινάμε!' : 'Περιμένουμε αντίπαλο…'}</button>`
      : `<p class="hint">${busy ? 'Παίζεται ήδη αγώνας — θα μπεις στην επόμενη ρεβάνς.' : `Διάρκεια: <b>${LEN_NAME[L]}</b>. Ο/Η ${esc(oppName)} θα ξεκινήσει το παιχνίδι.`}</p>`}
    <button class="btn ghost" id="lv">Έξοδος</button></div>`);
  $('#lv').onclick = leaveRoom;
  if (host) {
    bindLen(renderLobby);
    $('#go').onclick = hostStart;
    $('#cpc').onclick = e => copy(code, e.currentTarget);
    if (link) $('#cpl').onclick = e => copy(link, e.currentTarget);
  }
}
async function copy(text, btn) {
  const old = btn.textContent;
  try { await navigator.clipboard.writeText(text); btn.textContent = 'Αντιγράφηκε ✓'; setTimeout(() => { btn.textContent = old; }, 1500); }
  catch (e) { const c = $('#cpy'); if (c) { c.hidden = false; c.value = text; c.focus(); c.select(); } }
}
function hostStart() {
  const o = opp(); if (!o) return;
  const avoid = new Set(seen); decSeen(o.sn).forEach(id => avoid.add(id));
  const cfg = buildGame(len, avoid);
  NET.set({ g: cfg, k: cfg.k, a: [], p: null, L: len });
  begin(cfg, false);
}

/* ====== Παιχνίδι ====== */
function begin(cfg, solo) {
  curK = cfg.k;
  G = { tok: {}, cfg, solo: !!solo, ans: [], streak: 0, half: true, dbl: true, cont: false, r2: [], rd: 0 };
  G.sizes = [cfg.r1.length, cfg.pq[0].length * 2, cfg.r3.length, cfg.r4.length];
  G.total = sum(G.sizes);
  if (!solo) NET.set({ k: cfg.k, a: [], p: null });
  view = 'game';
  play(G.tok).catch(e => { if (e !== ABORT) { console.error(e); } });
}
const duel = () => G && !G.solo && !G.cont;
function myScore() { return G ? sum(G.ans.map(a => a[1])) : 0; }
function oppScore() { const a = oppAns(); return sum(a.slice(0, G.ans.length).map(x => x[1])); }
function updHud() {
  if (!G) return; const h = $('#hud'); h.hidden = false;
  const oa = oppAns(); const ahead = !G.solo && oa.length > G.ans.length;
  const gone = !G.solo && !opp() && Date.now() - oppAt > 6000;
  h.innerHTML = `<div class="pl me"><span class="nm">${esc(ME.name || 'Εσύ')}</span><span class="sc">${myScore()}</span></div>
    <div class="mid"><small>${ROUNDS[G.rd].e} Γύρος ${G.rd + 1}/4</small><b>${Math.min(G.ans.length + 1, G.total)}<i>/${G.total}</i></b></div>
    ${G.solo ? '<div class="pl op solo"><span class="nm">Προπόνηση</span><span class="sc">—</span></div>'
      : `<div class="pl op"><span class="nm">${esc(oppName)}${gone ? ' ⚠️' : ahead ? ' ✓' : ''}</span><span class="sc">${oppScore()}</span></div>`}`;
}

async function play(tok) {
  const chk = () => { if (!G || G.tok !== tok) throw ABORT; };
  const W = async ms => { await sleep(ms); chk(); };
  const cfg = G.cfg; let i = 0;
  for (let rd = 0; rd < 4; rd++) {
    G.rd = rd; updHud();
    const R = ROUNDS[rd];
    stage(`<div class="intro"><div class="big">${R.e}</div><p class="eyebrow">Γύρος ${rd + 1} από 4</p><h2>${R.n}</h2><p>${R.d}</p></div>`);
    await W(3400);
    if (rd === 1) await pickPhase(tok, W);
    const ids = rd === 0 ? cfg.r1 : rd === 1 ? G.r2 : rd === 2 ? cfg.r3 : cfg.r4;
    for (const id of ids) {
      let bet = 0;
      if (rd === 2) bet = await betPhase(id, tok);
      const res = await ask(id, rd, bet, tok);
      G.ans.push([res.c, res.pts]);
      if (!G.solo) NET.set({ a: G.ans.slice() });
      if (duel() && oppAns().length <= i) {
        $('#note').innerHTML = `<span class="wait">Περιμένουμε τον/την ${esc(oppName)}…</span>`;
        await waitOpp(() => oppAns().length > i, tok);
      }
      reveal(res, i); updHud();
      await W(res.ok ? 2300 : 3000);
      i++;
    }
  }
  finish();
}
async function waitOpp(cond, tok) {
  const t0 = Date.now();
  for (;;) {
    if (!G || G.tok !== tok) throw ABORT;
    if (cond() || G.cont) return;
    const gone = !opp() && Date.now() - oppAt > 6000;
    if ((gone || Date.now() - t0 > 40000) && !$('#cont')) {
      const n = $('#note') || $('#stage');
      n.insertAdjacentHTML('beforeend', `<div class="gone">${gone ? 'Ο αντίπαλος αποσυνδέθηκε.' : 'Ο αντίπαλος αργεί πολύ.'} <button class="btn sm" id="cont">Συνέχισε μόνος</button></div>`);
      $('#cont').onclick = () => { G.cont = true; };
    }
    await sleep(150);
  }
}
function timed(ms, tok, onTick, onEnd) {
  const t0 = performance.now();
  const iv = setInterval(() => {
    if (!G || G.tok !== tok) { clearInterval(iv); onEnd(true); return; }
    const f = Math.max(0, 1 - (performance.now() - t0) / ms);
    onTick(f); if (f <= 0) { clearInterval(iv); onEnd(false); }
  }, 100);
  return { stop: () => clearInterval(iv), frac: () => Math.max(0, 1 - (performance.now() - t0) / ms) };
}
const bar = f => { const b = $('#tb'); if (b) { b.style.transform = 'scaleX(' + f + ')'; b.classList.toggle('low', f < 0.3); } };

function pickPhase(tok, W) {
  return new Promise((resolve, reject) => {
    const cfg = G.cfg; const side = (G.solo || ME.role === 'h') ? 0 : 1; const mine = cfg.oc[side];
    stage(`<p class="eyebrow">Διάλεξε την έδρα σου</p><div class="tbar"><i id="tb"></i></div>
      <div class="cats">${mine.map((c, j) => `<button class="cat-b" data-j="${j}"><i>${CATS[c].e}</i><b>${CATS[c].n}</b></button>`).join('')}</div>
      <p class="hint">${cfg.pq[0].length} ερωτήσεις από τη δική σου κατηγορία και ${cfg.pq[0].length} από του αντιπάλου.</p><div id="note" class="note"></div>`);
    let done = false;
    const tm = timed(12000, tok, bar, ab => { if (ab) reject(ABORT); else choose(Math.random() * 3 | 0); });
    $('#stage').querySelectorAll('.cat-b').forEach(b => b.onclick = () => choose(+b.dataset.j));
    async function choose(my) {
      if (done) return; done = true; tm.stop();
      try {
        $('#stage').querySelectorAll('.cat-b').forEach(b => { b.disabled = true; if (+b.dataset.j === my) b.classList.add('sel'); });
        if (!G.solo) NET.set({ p: my });
        const got = () => { const o = opp() || oppCache; return o && o.k === cfg.k && [0, 1, 2].includes(o.p) ? o.p : -1; };
        if (duel() && got() < 0) {
          $('#note').innerHTML = `<span class="wait">Ο/Η ${esc(oppName)} διαλέγει…</span>`;
          await waitOpp(() => got() >= 0, tok);
        }
        let other = duel() ? got() : -1; if (other < 0) other = Math.random() * 3 | 0;
        const ph = side === 0 ? my : other, pg = side === 0 ? other : my;
        G.r2 = cfg.pq[ph].concat(cfg.pq[3 + pg]);
        const cm = cfg.oc[side][my], co = cfg.oc[1 - side][other];
        stage(`<div class="intro"><p class="eyebrow">Οι έδρες</p>
          <div class="picks"><div class="me"><i>${CATS[cm].e}</i><b>${CATS[cm].n}</b><small>${esc(ME.name || 'Εσύ')}</small></div>
          <div class="op"><i>${CATS[co].e}</i><b>${CATS[co].n}</b><small>${G.solo ? 'Έκπληξη' : esc(oppName)}</small></div></div></div>`);
        await W(2600); resolve();
      } catch (e) { reject(e); }
    }
  });
}
function betPhase(id, tok) {
  return new Promise((resolve, reject) => {
    const q = Q[id];
    stage(`<p class="eyebrow">Ρίσκο · η επόμενη ερώτηση είναι από</p><div class="betcat"><i>${CATS[q.c].e}</i><b>${CATS[q.c].n}</b></div>
      <div class="tbar"><i id="tb"></i></div><p class="hint">Πόσα ποντάρεις; Σωστό = κερδίζεις, λάθος = χάνεις.</p>
      <div class="bets">${BETS.map(b => `<button class="bet" data-b="${b}">${b}</button>`).join('')}</div>`);
    let done = false;
    const end = b => { if (done) return; done = true; tm.stop(); resolve(b); };
    const tm = timed(9000, tok, bar, ab => { if (ab) reject(ABORT); else end(BETS[0]); });
    $('#stage').querySelectorAll('.bet').forEach(b => b.onclick = () => end(+b.dataset.b));
  });
}
function ask(id, rd, bet, tok) {
  return new Promise((resolve, reject) => {
    const q = Q[id], R = ROUNDS[rd]; markSeen(id);
    const order = shuffle([0, 1, 2, 3]);
    stage(`<div class="qmeta"><span class="cat">${CATS[q.c].e} ${CATS[q.c].n}</span><span class="val" id="val">${rd === 2 ? 'Ποντάρισμα ' + bet : R.pts + ' π.'}</span></div>
      <div class="tbar"><i id="tb"></i></div>
      <h2 class="q">${esc(q.q)}</h2>
      <div class="opts">${order.map((o, j) => `<button class="opt" data-o="${o}"><b>${'ΑΒΓΔ'[j]}</b><span>${esc(q.o[o])}</span></button>`).join('')}</div>
      <div class="ll"><button id="half" ${G.half ? '' : 'disabled'}>50:50</button>${rd === 2 ? '' : `<button id="dbl" ${G.dbl ? '' : 'disabled'}>×2 πόντοι</button>`}
        <span class="streak">${G.streak > 0 ? '🔥 σερί ' + G.streak : ''}</span></div>
      <div id="note" class="note"></div>`);
    let done = false, dbl = false;
    const btns = [...$('#stage').querySelectorAll('.opt')];
    const fin = (c, frac) => {
      if (done) return; done = true; tm.stop();
      const ok = c === 0; let pts;
      if (rd === 2) pts = ok ? bet : -bet;
      else { pts = ok ? R.pts + Math.round(R.bon * frac / 5) * 5 : 0; if (dbl) pts *= 2; }
      let sb = 0; if (ok) { G.streak++; if (G.streak % 3 === 0) { sb = 50; pts += 50; } } else G.streak = 0;
      btns.forEach(b => { b.disabled = true; if (+b.dataset.o === c) b.classList.add('sel'); });
      const h = $('#half'), d = $('#dbl'); if (h) h.disabled = true; if (d) d.disabled = true;
      resolve({ c, pts, ok, sb });
    };
    const tm = timed(R.t * 1000, tok, bar, ab => { if (ab) reject(ABORT); else fin(-1, 0); });
    btns.forEach(b => b.onclick = () => fin(+b.dataset.o, tm.frac()));
    $('#half').onclick = e => {
      if (!G.half || done) return; G.half = false; e.currentTarget.disabled = true;
      shuffle([1, 2, 3]).slice(0, 2).forEach(o => { const b = btns.find(x => +x.dataset.o === o); b.disabled = true; b.classList.add('gone'); });
    };
    const d = $('#dbl');
    if (d) d.onclick = e => { if (!G.dbl || done) return; G.dbl = false; dbl = true; e.currentTarget.disabled = true; e.currentTarget.classList.add('on'); $('#val').textContent = (R.pts * 2) + ' π. ×2'; };
  });
}
function reveal(res, i) {
  const btns = [...$('#stage').querySelectorAll('.opt')];
  const oa = duel() || (G && !G.solo) ? oppAns()[i] : null;
  btns.forEach(b => {
    const o = +b.dataset.o;
    if (o === 0) b.classList.add('ok'); else if (o === res.c) b.classList.add('bad');
    if (oa && oa[0] === o) b.insertAdjacentHTML('beforeend', `<em class="tag">${esc(oppName.slice(0, 1).toUpperCase())}</em>`);
  });
  const fmt = p => (p > 0 ? '+' : '') + p;
  let t = res.c < 0 ? '⏱️ Τέλος χρόνου' : res.ok ? '✅ Σωστό' : '❌ Λάθος';
  t += ` <b class="${res.pts > 0 ? 'pos' : res.pts < 0 ? 'neg' : ''}">${fmt(res.pts)}</b>${res.sb ? ' <small>(σερί +50)</small>' : ''}`;
  if (oa) t += `<span class="sep">·</span>${esc(oppName)} <b class="${oa[1] > 0 ? 'pos' : oa[1] < 0 ? 'neg' : ''}">${fmt(oa[1])}</b>`;
  $('#note').innerHTML = t;
}

/* ====== Τέλος ====== */
function finish() {
  view = 'end';
  if (!G.solo) NET.set({ sn: encSeen() });
  const my = G.ans.map(a => a[1]), oa = oppAns().map(a => a[1]);
  const cut = (arr) => { const out = []; let p = 0; G.sizes.forEach(n => { out.push(sum(arr.slice(p, p + n))); p += n; }); return out; };
  const mr = cut(my), or = cut(oa), ms = sum(my), os = sum(oa);
  const right = G.ans.filter(a => a[0] === 0).length;
  let head, cls;
  if (G.solo) { head = 'Τέλος προπόνησης'; cls = 'draw'; }
  else if (ms > os) { head = '🏆 Νίκη!'; cls = 'win'; }
  else if (ms < os) { head = 'Ήττα… ζήτα ρεβάνς'; cls = 'lose'; }
  else { head = 'Ισοπαλία!'; cls = 'draw'; }
  $('#hud').hidden = true;
  stage(`<div class="end ${cls}"><h2>${head}</h2>
    <div class="final"><div class="me"><small>${esc(ME.name || 'Εσύ')}</small><b>${ms}</b></div>
      ${G.solo ? '' : `<span>–</span><div class="op"><small>${esc(oppName)}</small><b>${os}</b></div>`}</div>
    <table class="tbl"><tr><th>Γύρος</th><th>${esc(ME.name || 'Εσύ')}</th>${G.solo ? '' : `<th>${esc(oppName)}</th>`}</tr>
      ${ROUNDS.map((r, j) => `<tr><td>${r.e} ${r.n}</td><td class="${!G.solo && mr[j] > or[j] ? 'best' : ''}">${mr[j]}</td>${G.solo ? '' : `<td class="${or[j] > mr[j] ? 'best' : ''}">${or[j]}</td>`}</tr>`).join('')}</table>
    <p class="hint">Σωστές απαντήσεις: <b>${right}/${G.ans.length}</b>${G.cont ? ' · ο αντίπαλος δεν ολοκλήρωσε' : ''}</p>
    <div id="endact"></div></div>`);
  renderEndActions(true);
}
function renderEndActions(force) {
  const el = $('#endact'); if (!el || !G) return;
  const o = G.solo ? null : opp();
  const key = [G.solo, ME.role, !!o, len].join('|');
  if (!force && el.dataset.key === key) return;
  el.dataset.key = key;
  if (G.solo) {
    el.innerHTML = `<div class="fld"><span>Διάρκεια</span>${lenCtl()}</div><button class="btn pri" id="again">Παίξε ξανά</button><button class="btn ghost" id="home">Αρχική</button>`;
    bindLen(() => renderEndActions(true));
    $('#again').onclick = () => begin(buildGame(len, new Set(seen)), true);
    $('#home').onclick = () => { G = null; renderHome(); };
  } else if (ME.role === 'h') {
    el.innerHTML = `<div class="fld"><span>Διάρκεια ρεβάνς</span>${lenCtl()}</div>
      <button class="btn pri" id="again" ${o ? '' : 'disabled'}>${o ? '🔁 Ρεβάνς με νέες ερωτήσεις' : 'Ο αντίπαλος έφυγε'}</button><button class="btn ghost" id="home">Έξοδος</button>`;
    bindLen(() => renderEndActions(true));
    $('#again').onclick = hostStart; $('#home').onclick = leaveRoom;
  } else {
    el.innerHTML = `<p class="hint">${o ? `Ο/Η ${esc(oppName)} μπορεί να ξεκινήσει ρεβάνς — θα μπεις αυτόματα.` : 'Ο αντίπαλος έφυγε από το δωμάτιο.'}</p><button class="btn ghost" id="home">Έξοδος</button>`;
    $('#home').onclick = leaveRoom;
  }
}

/* ====== Εκκίνηση ====== */
renderHome();
initNet();
})();
