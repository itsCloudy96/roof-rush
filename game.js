/* Roof Rush Tycoon – UI layer. Engine lives in engine.js. A Cloudy game. MIT. */
(() => {
'use strict';
const E = window.RRE;
const $ = s => document.querySelector(s);
const KEY = 'roofrush.tycoon.v1';
const DAY_SEC = 2.0;                 // real seconds per game day at 1x
const fmt = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
const fmtS = n => { const a = Math.abs(n), sg = n < 0 ? '-' : ''; if (a >= 1e6) return sg + '$' + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'M'; if (a >= 1e5) return sg + '$' + Math.round(a / 1e3) + 'k'; return fmt(n); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- save / load ---------- */
let S = load() || E.newState();
let tab = 'leads', speed = S.speed == null ? 2 : S.speed, hidden = false, bid = null, offlineShown = false, lastSave = 0;
function load() {
  try { const o = JSON.parse(localStorage.getItem(KEY)); if (o && o.v === 2 && o.crews) { o.fx2 = []; return o; } } catch (e) {}
  return null;
}
function save() { try { S.saved = Date.now(); S.speed = speed; localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const wasNew = !load();

/* ---------- audio (off by default) ---------- */
let actx = null;
function tone(f, d, type, v, when) {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + (when || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(v || 0.06, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(actx.destination); o.start(t0); o.stop(t0 + d);
  } catch (e) {}
}
const snd = {
  cha: () => { [1318, 1760, 2093].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.08)); },
  win: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.07, i * 0.09)); },
  lose: () => { [330, 262].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.04, i * 0.14)); },
  tap: () => tone(700, 0.05, 'square', 0.03),
  buy: () => { tone(880, 0.1, 'triangle', 0.07); tone(1175, 0.16, 'triangle', 0.07, 0.09); },
  alert: () => { tone(300, 0.2, 'sawtooth', 0.05); tone(250, 0.3, 'sawtooth', 0.05, 0.18); },
};
const buzz = n => { try { navigator.vibrate && navigator.vibrate(n); } catch (e) {} };

/* ---------- town canvas ---------- */
const cv = $('#town'), cx = cv.getContext('2d');
const TW = 390, RH = 75, MAXROWS = 4; let TH = 150, rowsShown = 2, canvasReady = false;
const LW0 = 0,  LW = (TW - 16) / 4;
let sx = 1, sy = 1, T = 0, floats = [], coins = [], flash = 0, hailFx = [], rainFx = [];
for (let i = 0; i < 90; i++) rainFx.push({ x: Math.random() * TW, y: Math.random() * TH, v: 380 + Math.random() * 260 });
function syncRows() {
  const n = Math.min(MAXROWS, S.ups.towns + 1);
  if (n === rowsShown && canvasReady) return;
  canvasReady = true; rowsShown = n; TH = n * RH; $('#townwrap').style.aspectRatio = TW + '/' + TH; resizeCanvas();
}
function resizeCanvas() {
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  sx = cv.width / TW; sy = cv.height / TH;
}
const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const WALLS = ['#f6e3b4', '#e9f1f7', '#f2c9c0', '#cfe8d2', '#e8dcf2', '#f7d99a'];
const NEWROOF = ['#3b4a63', '#a8412f', '#2f6f5a', '#5b4a8a', '#5a4636', '#2d5f8a'];
const lotXY = (t, l) => ({ x: 8 + l * LW, y: t * RH });
function rrect(x, y, w, h, r) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function drawHouse(x, y, o) {
  // sprite box: x..x+77, y..y+50
  const w = 77, h = 50, g = y + h, kind = o.kind, prog = o.prog || 0;
  if (kind === 'flat') {
    const bh = h * 0.62, top = g - bh;
    cx.fillStyle = o.wall; cx.fillRect(x + 2, top, w - 4, bh);
    cx.fillStyle = 'rgba(90,120,160,.8)'; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) cx.fillRect(x + 7 + c * 11, top + 6 + r * 11, 7, 7);
    cx.fillStyle = '#6a5a8a'; cx.fillRect(x + w / 2 - 5, g - 12, 10, 12);
    // roof deck
    cx.fillStyle = o.old; cx.fillRect(x, top - 8, w, 9);
    if (prog > 0) { cx.fillStyle = o.neu; cx.fillRect(x, top - 8, w * prog, 9); }
    cx.fillStyle = 'rgba(0,0,0,.25)'; cx.fillRect(x, top, w, 1.5);
    cx.fillStyle = '#9aa6b5'; cx.fillRect(x + w * 0.65, top - 14, 12, 6);
    return { rx: x, ry: top - 8, rw: w, rh: 9, flat: true };
  }
  const bodyH = h * 0.4, base = g - bodyH, apex = y + 2, x0 = x + 2, x1 = x + w - 2;
  cx.fillStyle = o.wall; cx.fillRect(x + 8, base, w - 16, bodyH);
  cx.fillStyle = 'rgba(0,0,0,.08)'; cx.fillRect(x + 8, g - 3, w - 16, 3);
  cx.fillStyle = '#9ad0ee'; cx.fillRect(x + 14, base + 6, 11, 10); cx.fillRect(x + w - 25, base + 6, 11, 10);
  cx.fillStyle = '#a5513f'; cx.fillRect(x + w / 2 - 5, g - 15, 10, 15);
  // roof polygon
  cx.save(); cx.beginPath(); cx.moveTo(x0, base + 3); cx.lineTo(x + w / 2, apex); cx.lineTo(x1, base + 3); cx.closePath();
  cx.fillStyle = o.old; cx.fill(); cx.clip();
  if (o.dents) { cx.fillStyle = 'rgba(30,20,10,.55)'; for (let i = 0; i < 9; i++) { cx.beginPath(); cx.arc(x + 14 + hash(o.seed + i) * 50, apex + 8 + hash(o.seed * 3 + i) * 22, 1.6, 0, 7); cx.fill(); } }
  if (prog > 0) {
    const yl = (base + 3) - prog * ((base + 3) - apex);
    cx.fillStyle = o.neu; cx.fillRect(x, yl, w, h);
    if (kind === 'metal') { cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 1; for (let i = x; i < x + w; i += 5) { cx.beginPath(); cx.moveTo(i, yl); cx.lineTo(i, base + 3); cx.stroke(); } }
    else { cx.strokeStyle = 'rgba(0,0,0,.2)'; cx.lineWidth = 1; for (let yy = base; yy > yl; yy -= 4) { cx.beginPath(); cx.moveTo(x, yy); cx.lineTo(x + w, yy); cx.stroke(); } }
    cx.fillStyle = 'rgba(255,255,255,.7)'; cx.fillRect(x, yl, w, 1.5);
  } else { cx.strokeStyle = 'rgba(0,0,0,.18)'; cx.lineWidth = 1; for (let yy = base; yy > apex; yy -= 5) { cx.beginPath(); cx.moveTo(x, yy); cx.lineTo(x + w, yy); cx.stroke(); } }
  cx.restore();
  cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x0, base + 3); cx.lineTo(x + w / 2, apex); cx.lineTo(x1, base + 3); cx.stroke();
  return { rx: x, ry: apex, rw: w, rh: base - apex, base, apex };
}
function drawTruck(x, y, t) {
  cx.fillStyle = 'rgba(0,0,0,.2)'; cx.beginPath(); cx.ellipse(x + 11, y + 11, 13, 3, 0, 0, 7); cx.fill();
  cx.fillStyle = '#ff8a3d'; rrect(x, y, 14, 9, 2); cx.fill(); cx.fillStyle = '#fff'; rrect(x + 12, y + 2, 9, 7, 2); cx.fill();
  cx.fillStyle = '#2a2f3a'; cx.beginPath(); cx.arc(x + 5, y + 10, 2.4, 0, 7); cx.arc(x + 17, y + 10, 2.4, 0, 7); cx.fill();
}
function drawWorker(x, y, t, phase) {
  const b = Math.sin(t * 9 + phase) * 1.2;
  cx.fillStyle = '#2f6fdb'; cx.fillRect(x - 2, y - 1 + b, 4, 6);
  cx.fillStyle = '#ffcfa0'; cx.beginPath(); cx.arc(x, y - 4 + b, 2.6, 0, 7); cx.fill();
  cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.arc(x, y - 5 + b, 2.8, Math.PI, 0); cx.fill();
  cx.strokeStyle = '#444'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x + 2, y + b); cx.lineTo(x + 6, y - 3 + Math.sin(t * 16 + phase) * 3); cx.stroke();
}
function jobAt(t, l) { return S.jobs.find(j => j.town === t && j.lot === l && j.status !== 'done'); }
function drawTown(dt) {
  T += dt;
  cx.setTransform(sx, 0, 0, sy, 0, 0);
  const rain = S.fx.rain > S.day, hail = S.fx.hail > S.day, stormy = rain || hail;
  const nt = S.ups.towns;
  for (let t = 0; t < rowsShown; t++) {
    const y = t * RH;
    cx.fillStyle = t % 2 ? '#74c862' : '#7ed36b'; cx.fillRect(0, y, TW, RH);
    cx.fillStyle = '#9aa0ab'; cx.fillRect(0, y + RH - 8, TW, 6); cx.fillStyle = '#e8d36a'; for (let i = 0; i < TW; i += 24) cx.fillRect(i + 4, y + RH - 6, 10, 1.5);
    for (let l = 0; l < 4; l++) {
      const p = lotXY(t, l), j = t < nt ? jobAt(t, l) : null;
      cx.fillStyle = 'rgba(255,255,255,.18)'; rrect(p.x + 3, y + 8, LW - 6, RH - 18, 6); cx.fill();
      const seed = t * 4 + l + 1;
      const hx = p.x + (LW - 77) / 2, hy = y + 11;
      if (t >= nt) { // locked row: ghosted houses
        cx.globalAlpha = 0.55; drawHouse(hx, hy, { kind: t === 3 ? 'flat' : 'house', wall: '#d8dde5', old: '#8b93a0', seed }); cx.globalAlpha = 1; continue;
      }
      if (!j) {
        const dents = hail && hash(seed) < 0.7;
        drawHouse(hx, hy, { kind: t === 3 ? 'flat' : 'house', wall: WALLS[(seed * 7) % WALLS.length], old: dents ? '#6d6258' : ['#8a7a6a', '#7d7268', '#93826f'][seed % 3], seed, dents });
        if (dents) { cx.fillStyle = '#ff5a36'; cx.beginPath(); cx.arc(hx + 66, hy + 4, 6, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '900 9px sans-serif'; cx.textAlign = 'center'; cx.fillText('!', hx + 66, hy + 7.4); }
        continue;
      }
      const K = E.KINDS[j.kind], prog = j.status === 'active' ? j.progress / j.work : 0;
      const o = { kind: j.kind, wall: WALLS[(seed * 7 + j.id) % WALLS.length], old: j.kind === 'storm' ? '#6d6258' : '#8a7a6a', neu: j.kind === 'metal' ? '#b9c7d8' : NEWROOF[j.id % NEWROOF.length], prog, seed: j.id, dents: j.kind === 'storm' && prog < 0.99 };
      const g = drawHouse(hx, hy, o);
      // progress bar
      const by = y + RH - 17, bw = LW - 14;
      cx.fillStyle = 'rgba(20,35,63,.75)'; rrect(p.x + 7, by, bw, 7, 3.5); cx.fill();
      const late = S.day > j.due;
      cx.fillStyle = j.status === 'sched' ? '#8d9db0' : late ? '#ff5a4d' : '#ffc22e'; if (prog > 0) { rrect(p.x + 7, by, Math.max(7, bw * prog), 7, 3.5); cx.fill(); }
      cx.fillStyle = '#fff'; cx.font = '800 6.5px sans-serif'; cx.textAlign = 'center';
      cx.fillText(j.status === 'sched' ? 'WAITING FOR CREW' : Math.floor(prog * 100) + '%', p.x + 7 + bw / 2, by + 5.6);
      if (j.status === 'active') {
        const crew = S.crews.find(c => c.id === j.crewId), working = crew && crew.outUntil <= S.day && !rain;
        drawTruck(p.x + 4, y + 47, T);
        if (crew) { const n = 1 + (crew.speed > 5) + (crew.speed > 8);
          for (let i = 0; i < n; i++) { const wx = g.rx + 14 + ((i * 23 + (working ? Math.sin(T * 0.8 + i) * 10 : 0)) % 48), wy = g.flat ? g.ry - 4 : g.base - 3 - (g.rh * 0.35) * (1 - Math.abs(0.5 - (wx - g.rx) / g.rw) * 2) - 2;
            if (working) drawWorker(wx, wy, T, i * 2); else { cx.fillStyle = 'rgba(255,255,255,.8)'; cx.font = '700 8px sans-serif'; cx.fillText('zz', wx, wy); } } }
      } else { cx.strokeStyle = '#fff'; cx.setLineDash([3, 3]); cx.lineWidth = 1.5; rrect(p.x + 4, y + 8, LW - 8, RH - 18, 6); cx.stroke(); cx.setLineDash([]); }
      if (S.day > j.due && j.status !== 'done') { cx.fillStyle = '#ff5a4d'; cx.beginPath(); cx.arc(p.x + LW - 10, y + 14, 6, 0, 7); cx.fill(); cx.fillStyle = '#fff'; cx.font = '900 9px sans-serif'; cx.textAlign = 'center'; cx.fillText('!', p.x + LW - 10, y + 17.2); }
    }
    // town label
    const tn = E.TOWNS[t].name;
    cx.font = '900 9px ui-rounded,sans-serif'; const tw = cx.measureText(tn).width + 10;
    cx.fillStyle = 'rgba(20,35,63,.82)'; rrect(6, y + 2, tw, 12, 6); cx.fill(); cx.fillStyle = '#fff'; cx.textAlign = 'left'; cx.fillText(tn, 11, y + 11);
    if (t >= nt) {
      cx.fillStyle = 'rgba(25,45,80,.62)'; cx.fillRect(0, y, TW, RH);
      cx.fillStyle = '#ffd23f'; rrect(TW / 2 - 8, y + 20, 16, 12, 3); cx.fill(); cx.strokeStyle = '#ffd23f'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(TW / 2, y + 20, 5, Math.PI, 0); cx.stroke();
      cx.fillStyle = '#fff'; cx.font = '900 11px ui-rounded,sans-serif'; cx.textAlign = 'center';
      const T_ = E.TOWNS[t]; cx.fillText(t === nt ? 'Unlock ' + T_.name + ': ' + fmtS(T_.cost) : 'Unlock previous town first', TW / 2, y + 47);
      if (t === nt) { cx.font = '700 9px ui-rounded,sans-serif'; cx.fillStyle = '#cfe0ff'; cx.fillText('needs ' + T_.rep + ' stars' + (T_.office ? ' + ' + E.UPS.office.names[T_.office] : ''), TW / 2, y + 60); }
    }
  }
  // weather
  if (stormy) { cx.fillStyle = hail ? 'rgba(40,50,90,.38)' : 'rgba(60,70,90,.28)'; cx.fillRect(0, 0, TW, TH); }
  if (rain) { cx.strokeStyle = 'rgba(200,220,255,.6)'; cx.lineWidth = 1; cx.beginPath(); for (const r of rainFx) { const yy = (r.y + T * r.v) % (TH + 20) - 10, xx = (r.x - yy * 0.2 + TW) % TW; cx.moveTo(xx, yy); cx.lineTo(xx - 2, yy + 8); } cx.stroke(); }
  if (hail) { cx.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { const r = rainFx[i], yy = (r.y + T * r.v * 1.1) % (TH + 20) - 10, xx = (r.x * 1.3 + yy * 0.1) % TW; cx.beginPath(); cx.arc(xx, yy, 2, 0, 7); cx.fill(); } }
  // coins + floats
  for (const c of coins) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 420 * dt; cx.globalAlpha = clamp(1.4 - c.t, 0, 1); cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.arc(c.x, c.y, 3.4, 0, 7); cx.fill(); cx.strokeStyle = '#b07e00'; cx.lineWidth = 1; cx.stroke(); }
  cx.globalAlpha = 1; coins = coins.filter(c => c.t < 1.4);
  for (const f of floats) { f.t += dt; cx.globalAlpha = clamp(1.6 - f.t, 0, 1); cx.font = '900 14px ui-rounded,sans-serif'; cx.textAlign = 'center'; cx.lineWidth = 3.5; cx.strokeStyle = '#14233f'; cx.strokeText(f.text, f.x, f.y - f.t * 26); cx.fillStyle = f.color; cx.fillText(f.text, f.x, f.y - f.t * 26); }
  cx.globalAlpha = 1; floats = floats.filter(f => f.t < 1.6);
  flash = Math.max(0, flash - dt * 2); if (flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + flash * 0.6 + ')'; cx.fillRect(0, 0, TW, TH); }
}
function burst(t, l, text, color, n) {
  const p = lotXY(t, l); const x = p.x + LW / 2, y = t * RH + 28;
  floats.push({ x, y, text, color: color || '#7dffa8', t: 0 });
  for (let i = 0; i < (n || 0); i++) coins.push({ x, y: y + 6, vx: (Math.random() - 0.5) * 130, vy: -120 - Math.random() * 90, t: 0 });
}
cv.addEventListener('pointerup', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * TW, y = (e.clientY - r.top) / r.height * TH;
  const t = clamp(Math.floor(y / RH), 0, rowsShown - 1), l = clamp(Math.floor((x - 8) / LW), 0, 3);
  if (modalOpen()) return;
  if (t >= S.ups.towns) { setTab('office'); return; }
  const j = jobAt(t, l);
  if (j) openJob(j.id); else setTab('leads');
});

/* ---------- HUD ---------- */
let dispCash = S.cash;
function updateHud(dt) {
  dispCash += (S.cash - dispCash) * Math.min(1, dt * 8); if (Math.abs(S.cash - dispCash) < 1) dispCash = S.cash;
  const c = $('#cash'); c.textContent = fmt(dispCash); c.classList.toggle('neg', S.cash < 0);
  $('#repfill').style.width = (S.rep / 5 * 100) + '%'; $('#repnum').textContent = S.rep.toFixed(1) + ' stars';
  const d = E.dateOf(S.day); $('#date').textContent = d.m + ' ' + d.d + ' · Year ' + d.y;
  const v = E.value(S), M = E.MILES; let nxt = M.findIndex(m => v < m); if (nxt < 0) nxt = M.length - 1;
  const prev = nxt ? M[nxt - 1] : 0, pct = clamp((v - prev) / (M[nxt] - prev), 0, 1);
  $('#vfill').style.width = (pct * 100) + '%'; $('#vtxt').textContent = 'Company ' + fmtS(v) + ' → goal ' + fmtS(M[nxt]);
  document.querySelectorAll('#speed button').forEach(b => b.classList.toggle('on', +b.dataset.sp === speed));
  const chips = [];
  if (S.fx.hail > S.day) chips.push(['storm', 'HAIL STORM ' + Math.ceil(S.fx.hail - S.day) + 'd']);
  if (S.fx.rain > S.day) chips.push(['storm', 'Rain delay ' + Math.ceil(S.fx.rain - S.day) + 'd']);
  if (S.fx.price > S.day) chips.push(['bad', 'Materials +25% ' + Math.ceil(S.fx.price - S.day) + 'd']);
  if (S.fx.viral > S.day) chips.push(['good', 'VIRAL x2 leads ' + Math.ceil(S.fx.viral - S.day) + 'd']);
  if (S.fx.undercut > S.day) chips.push(['bad', 'Price war ' + Math.ceil(S.fx.undercut - S.day) + 'd']);
  for (const id in S.camp) if (S.camp[id] > S.day) chips.push(['good', E.CAMPAIGNS[id].name + ' ' + Math.ceil(S.camp[id] - S.day) + 'd']);
  const html = chips.map(c => `<span class="chip ${c[0]}">${c[1]}</span>`).join('');
  if ($('#chips').dataset.h !== html) { $('#chips').dataset.h = html; $('#chips').innerHTML = html; }
}
function toast(text, cls) {
  const t = document.createElement('div'); t.className = 'toast ' + (cls || ''); t.textContent = text;
  const box = $('#toasts'); box.appendChild(t); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => t.remove(), 3000);
}
function pulseCash() { const c = $('#cash'); c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); }

/* ---------- panel rendering ---------- */
const panel = $('#panel');
let sig = '', scrollMem = {};
function setTab(t) { scrollMem[tab] = panel.scrollTop; tab = t; sig = ''; render(true); panel.scrollTop = scrollMem[t] || 0; tutAfterTab(); }
function curSig() {
  const aff = [];
  const push = c => aff.push(S.cash >= c ? 1 : 0);
  Object.values(E.UPS).forEach(u => u.costs.forEach(push)); Object.values(E.CAMPAIGNS).forEach(c => push(c.cost)); E.TOWNS.forEach(t => push(t.cost)); S.candidates.forEach(c => push(c.fee)); S.crews.forEach(c => push(c.wage * 3));
  return [tab, S.leads.map(l => l.id).join(), S.jobs.map(j => j.id + j.status + j.crewId).join(), S.crews.map(c => c.id + ':' + c.jobId + ':' + (c.outUntil > S.day ? 1 : 0)).join(), S.candidates.map(c => c.id).join(),
    JSON.stringify(S.ups), aff.join(''), E.claimable(S), S.auto, S.autoBid, S.sound, Object.keys(S.camp).filter(k => S.camp[k] > S.day).join(), S.log.length ? S.log[0].text : '', S.recent.length, S.tut, Math.floor(S.rep * 10), S.crews.length, S.won].join('|');
}
function winCls(p) { return p >= 0.6 ? 'hi' : p >= 0.3 ? 'mid' : 'lo'; }
function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function leadCard(L, i) {
  const K = E.KINDS[L.kind], T_ = E.TOWNS[L.town];
  const lockedRep = S.rep + 1e-9 < L.minRep, full = E.freeLots(S, L.town) <= 0;
  const sg = !lockedRep && !full ? E.suggestBid(S, L) : 0, p = sg ? E.winChance(S, L, sg) : 0;
  const tags = (L.hot ? '<span class="tag hot">HOT</span> ' : '') + (L.ins ? '<span class="tag ins">INSURANCE</span> ' : '') + (lockedRep ? `<span class="tag lock">NEEDS ${L.minRep.toFixed(1)} STARS</span>` : '');
  return `<div class="card ${lockedRep ? 'locked' : ''}" data-lead="${L.id}" ${i === 0 ? 'id="firstLead"' : ''}>
    <div class="t"><div class="ico" style="background:${K.color}">${{ repair: 'FIX', shingle: 'ROOF', storm: 'HAIL', metal: 'METAL', flat: 'FLAT' }[L.kind]}</div>
    <div class="grow">${K.label} · ${L.sq} sq ${tags}<div class="s">${esc(L.cust)} · ${T_.name}</div></div></div>
    <div class="s" style="margin-top:.4em">Market <b>${fmt(L.price)}</b> · ${L.comps.length} rival${L.comps.length > 1 ? 's' : ''} · <span data-lv="exp" data-id="${L.id}">${Math.max(0, L.exp - S.day)}d left</span></div>
    ${lockedRep ? '' : full ? '<div class="s neg">Town lots full. Finish a job first.</div>' : `<div class="row"><button class="btn grow" data-act="bid" data-id="${L.id}">Set bid</button><button class="btn pri grow" data-act="quick" data-id="${L.id}" data-bid="${sg}">Quick bid ${fmt(sg)}<small>${Math.round(p * 100)}% to win</small></button></div>`}</div>`;
}
let touching = false;
document.addEventListener('pointerdown', () => { touching = true; }, true);
const untouch = () => setTimeout(() => { touching = false; }, 120);
document.addEventListener('pointerup', untouch, true); document.addEventListener('pointercancel', untouch, true);
function render(force) {
  if (touching && !force) return;
  const s = curSig(); if (!force && s === sig) return; sig = s;
  const top = panel.scrollTop;
  panel.innerHTML = ({ leads: viewLeads, jobs: viewJobs, crews: viewCrews, office: viewOffice, goals: viewGoals })[tab]();
  panel.scrollTop = top;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const bl = $('#b-leads'), bj = $('#b-jobs'), bg = $('#b-goals'), bc = $('#b-crews'), bo = $('#b-office');
  const sched = S.jobs.filter(j => j.status === 'sched').length, idle = S.crews.filter(c => !c.jobId && c.outUntil <= S.day).length;
  const set = (el, n) => { el.textContent = n; el.classList.toggle('on', n > 0); };
  set(bl, S.leads.filter(l => S.rep >= l.minRep).length); set(bj, sched); set(bg, E.claimable(S)); set(bc, idle); set(bo, 0);
  tutGlow();
}
function viewLeads() {
  const open = S.leads.slice().sort((a, b) => (b.tut ? 1 : 0) - (a.tut ? 1 : 0) || a.exp - b.exp);
  const pend = S.jobs.filter(j => j.status !== 'done').length;
  let h = `<div class="h"><b>Job Leads</b><small>${open.length}/${E.boardCap(S)} on board · ${S.crews.length} crew${S.crews.length > 1 ? 's' : ''}</small></div>`;
  if (pend >= S.crews.length + 1) h += `<div class="hint">Heads up: you have ${pend} jobs lined up for ${S.crews.length} crew${S.crews.length > 1 ? 's' : ''}. Jobs that wait over 26 days get canceled.</div>`;
  if (!open.length) h += '<div class="empty">No leads right now. New ones arrive every few days. Run a marketing campaign in the Office to get more!</div>';
  return h + open.map(leadCard).join('');
}
function viewJobs() {
  const act = S.jobs.filter(j => j.status === 'active'), sch = S.jobs.filter(j => j.status === 'sched');
  let h = `<div class="switch"><span>Auto-assign crews</span><button class="btn sm ${S.auto ? 'grn' : ''}" data-act="auto">${S.auto ? 'ON' : 'OFF'}</button></div>`;
  if (S.ups.sales >= 2) h += `<div class="sec">Auto-Bid (your sales rep)</div><div class="seg">${['Off', 'Safe', 'Smart', 'Cheap'].map((n, i) => `<button class="${S.autoBid === i ? 'on' : ''}" data-act="autobid" data-v="${i}">${n}</button>`).join('')}</div>`;
  h += `<div class="sec">In progress (${act.length})</div>`;
  if (!act.length) h += '<div class="empty">No crews are working. Win a bid on the Leads tab!</div>';
  for (const j of act) h += jobCard(j);
  if (sch.length) h += `<div class="sec">Waiting for a crew (${sch.length})</div>` + sch.map(jobCard).join('');
  if (S.recent.length) h += `<div class="sec">Finished jobs</div>` + S.recent.map(r => `<div class="card"><div class="t"><div class="grow">${r.name} · ${esc(r.cust)}<div class="s"><span class="st" style="color:#f5b301">${stars(r.stars)}</span> ${r.late ? ' · late' : ''}</div></div><div style="text-align:right"><div class="${r.profit >= 0 ? 'pos' : 'neg'}">${r.profit >= 0 ? '+' : ''}${fmt(r.profit)}</div><div class="s">profit</div></div></div></div>`).join('');
  h += `<div class="sec">Company log</div><div class="log">${S.log.slice(0, 14).map(l => `<div class="${l.tone}">${esc(l.text)}</div>`).join('') || '<div>Nothing yet.</div>'}</div>`;
  return h;
}
function jobCard(j) {
  const K = E.KINDS[j.kind], crew = S.crews.find(c => c.id === j.crewId), prog = j.status === 'active' ? j.progress / j.work : 0;
  const eta = crew ? Math.max(0, Math.ceil((j.work - j.progress) / E.effSpeed(S, crew, j.kind))) : null;
  return `<div class="card" data-job="${j.id}"><div class="t"><div class="ico" style="background:${K.color}">${j.sq}<br>sq</div><div class="grow">${K.label} · ${esc(j.cust)}<div class="s">${fmt(j.price)} · ${E.TOWNS[j.town].name} · ${crew ? esc(crew.name) : 'no crew'}</div></div></div>
  <div class="bar" style="margin-top:.5em"><i data-lv="jp" data-id="${j.id}" style="width:${prog * 100}%"></i></div>
  <div class="s" style="margin-top:.3em"><span data-lv="jeta" data-id="${j.id}">${j.status === 'sched' ? (j.needCash ? '<b class="neg">Needs ' + fmt(j.needCash) + ' for materials</b> · ' : '') + 'Start within ' + Math.max(0, j.startBy - S.day) + 'd' : eta + 'd to finish'}</span> · due in <span class="${S.day > j.due ? 'neg' : ''}">${j.due - S.day}d</span></div>
  <div class="row"><button class="btn sm grow" data-act="assign" data-id="${j.id}">${j.status === 'sched' ? 'Assign crew' : 'Swap crew'}</button></div></div>`;
}
function crewCard(c) {
  const job = S.jobs.find(j => j.id === c.jobId), out = c.outUntil > S.day;
  const st = out ? `Recovering (${c.outUntil - S.day}d)` : job ? 'On job: ' + E.KINDS[job.kind].label : 'Idle';
  const mcls = c.morale > 60 ? 'g' : c.morale > 30 ? 'y' : 'r';
  return `<div class="card"><div class="t"><div class="ico" style="background:#ffc22e;color:#5a3a00">${{ repair: 'FIX', shingle: 'ROOF', metal: 'METAL', flat: 'FLAT' }[c.spec]}</div><div class="grow">${esc(c.name)}<div class="s">${E.SPECS[c.spec]} specialists · ${fmt(c.wage)}/day · ${st}</div></div></div>
  <div class="stat"><span>Speed</span><div class="bar b"><i style="width:${c.speed / 10 * 100}%"></i></div><span>${c.speed.toFixed(1)}</span></div>
  <div class="stat"><span>Quality</span><div class="bar g"><i style="width:${c.quality}%"></i></div><span>${c.quality}</span></div>
  <div class="stat"><span>Morale</span><div class="bar ${mcls}"><i data-lv="cm" data-id="${c.id}" style="width:${c.morale}%"></i></div><span data-lv="cmn" data-id="${c.id}">${Math.round(c.morale)}</span></div>
  <div class="row"><button class="btn sm grow" data-act="bonus" data-id="${c.id}" ${S.cash < c.wage * 3 ? 'disabled' : ''}>Bonus ${fmt(c.wage * 3)} <small>+25 morale</small></button>${S.crews.length > 1 ? `<button class="btn sm" data-act="fire" data-id="${c.id}">Let go</button>` : ''}</div></div>`;
}
function viewCrews() {
  const trucksFull = S.crews.length >= S.ups.trucks, nextTruck = E.UPS.trucks.costs[S.ups.trucks - 1];
  let h = `<div class="h"><b>Your Crews</b><small>${S.crews.length}/${S.ups.trucks} trucks · payroll ${fmt(S.crews.reduce((a, c) => a + c.wage, 0) * 7 + S.ups.sales * E.UPS.sales.salary * 7)}/week</small></div>`;
  h += S.crews.map(crewCard).join('');
  h += `<div class="sec">Hire a crew</div>`;
  if (trucksFull) h += nextTruck ? `<div class="card"><div class="t"><div class="grow">Every crew needs a truck<div class="s">All ${S.ups.trucks} truck${S.ups.trucks > 1 ? 's are' : ' is'} in use.</div></div><button class="btn pri sm" id="truckBtn" data-act="buy" data-id="trucks" ${S.cash < nextTruck ? 'disabled' : ''}>Buy truck ${fmt(nextTruck)}</button></div></div>` : '<div class="hint">Your fleet is maxed out at 8 trucks.</div>';
  h += S.candidates.map((c, i) => `<div class="card"><div class="t"><div class="ico" style="background:#6b7a95">${{ repair: 'FIX', shingle: 'ROOF', metal: 'METAL', flat: 'FLAT' }[c.spec]}</div><div class="grow">${esc(c.name)}<div class="s">${E.SPECS[c.spec]} · Speed ${c.speed.toFixed(1)} · Quality ${c.quality} · ${fmt(c.wage)}/day</div></div>
    <button class="btn grn sm" ${i === 0 ? 'id="firstHire"' : ''} data-act="hire" data-id="${c.id}" ${trucksFull || S.cash < c.fee ? 'disabled' : ''}>Hire<small>${fmt(c.fee)}</small></button></div></div>`).join('');
  h += `<div class="s" style="text-align:center;margin:.3em 0">New applicants show up every week. Specialists work 30% faster on their job type.</div>`;
  return h;
}
function upCard(id) {
  const u = E.UPS[id], lv = S.ups[id], have = id === 'trucks' ? lv - 1 : lv, max = u.costs.length;
  const pips = Array.from({ length: max }, (_, i) => `<i class="${i < have ? 'on' : ''}"></i>`).join('');
  const cost = u.costs[have];
  let btn, note = '';
  if (have >= max) btn = '<button class="btn sm" disabled>MAX</button>';
  else {
    const blockOffice = id === 'sales' && lv >= 2 * S.ups.office + 1;
    if (blockOffice) note = `<div class="s neg">Needs a bigger office for more sales levels.</div>`;
    btn = `<button class="btn pri sm" data-act="buy" data-id="${id}" ${S.cash < cost || blockOffice ? 'disabled' : ''}>${fmt(cost)}</button>`;
  }
  const now = id === 'office' ? E.UPS.office.names[lv] + (lv < 3 ? ' → ' + E.UPS.office.names[lv + 1] : '') : id === 'trucks' ? lv + ' truck' + (lv > 1 ? 's' : '') : 'Level ' + have + '/' + max;
  return `<div class="card"><div class="t"><div class="grow">${u.name}<span class="pips">${pips}</span><div class="s">${now}<br>${u.desc}</div>${note}</div>${btn}</div></div>`;
}
function viewOffice() {
  let h = `<div class="h"><b>Company</b><small>Value ${fmtS(E.value(S))}</small></div><div class="sec">Fleet & gear</div>` + ['trucks', 'tools', 'dump', 'safety', 'train'].map(upCard).join('');
  h += `<div class="sec">Sales & office</div>` + ['sales', 'office'].map(upCard).join('');
  h += `<div class="sec">Marketing campaigns</div>` + Object.entries(E.CAMPAIGNS).map(([id, c]) => {
    const on = S.camp[id] > S.day;
    return `<div class="card"><div class="t"><div class="grow">${c.name}<div class="s">${Math.round(c.boost * 100)}% more leads for ${c.days} days${c.rep ? ', +' + c.rep + ' stars' : ''}. Instant: 2 new leads.${on ? '<br><b>Running: ' + Math.ceil(S.camp[id] - S.day) + ' days left</b>' : ''}</div></div>
    <button class="btn sm ${on ? '' : 'pri'}" data-act="camp" data-id="${id}" ${on || S.cash < c.cost ? 'disabled' : ''}>${on ? 'Active' : fmt(c.cost)}</button></div></div>`;
  }).join('');
  h += `<div class="sec">Expand to new towns</div>` + E.TOWNS.slice(1).map((T_, k) => {
    const i = k + 1, open = S.ups.towns > i, chk = E.townCheck(S, i);
    const need = `${fmt(T_.cost)} · ${T_.rep} stars${T_.office ? ' · ' + E.UPS.office.names[T_.office] : ''}`;
    const why = chk === 'locked' ? 'Open the previous town first' : chk === 'rep' ? 'Needs ' + T_.rep + ' stars (you have ' + S.rep.toFixed(1) + ')' : chk === 'office' ? 'Needs ' + E.UPS.office.names[T_.office] : chk === 'cash' ? 'Save up ' + fmt(T_.cost) : '';
    return `<div class="card ${open ? '' : chk === 'locked' ? 'locked' : ''}"><div class="t"><div class="grow">${T_.name} ${open ? '<span class="tag ins">OPEN</span>' : ''}<div class="s">${i === 3 ? 'Big commercial flat-roof contracts.' : 'Pricier jobs, bigger roofs.'} Jobs pay ${Math.round(T_.mult * 100)}% of base.<br>${open ? 'You work here now.' : need}</div>${!open && why ? `<div class="s neg">${why}</div>` : ''}</div>
    ${open ? '' : `<button class="btn pri sm" data-act="town" data-id="${i}" ${chk ? 'disabled' : ''}>Open</button>`}</div></div>`;
  }).join('');
  return h;
}
function viewGoals() {
  const v = E.value(S);
  let h = `<div class="h"><b>Road to $1,000,000</b><small>${fmtS(v)}</small></div><div class="bar y" style="height:1em"><i style="width:${clamp(v / 1e6 * 100, 0, 100)}%"></i></div>
    <div class="s" style="margin:.3em 0 .6em">Company value = cash + 60% of what you invested in gear + about two months of profit.${S.won ? ' <b>You built a roofing empire!</b> Keep going for $10M.' : ''}</div><div class="ms">`;
  E.MILES.forEach((m, i) => { const st = S.miles[i]; h += st === 1 ? `<span class="rdy" data-act="claimm" data-id="${i}">${fmtS(m)} CLAIM +${fmt(E.milestoneReward(i))}</span>` : `<span class="${st === 2 ? 'ok' : ''}">${fmtS(m)}${st === 2 ? ' ✓' : ''}</span>`; });
  h += `</div><div class="sec">Goals</div>` + E.GOALS.map(g => {
    const st = S.goals[g.id];
    return `<div class="card ${st ? '' : 'locked'}"><div class="t"><div class="grow">${g.name}<div class="s">Reward ${fmt(g.reward)}</div></div>${st === 1 ? `<button class="btn gold sm" data-act="claimg" data-id="${g.id}">Claim ${fmt(g.reward)}</button>` : st === 2 ? '<span class="pos">Done ✓</span>' : '<span class="s">In progress</span>'}</div></div>`;
  }).join('');
  h += `<div class="sec">Stats & settings</div><div class="card"><div class="kv"><span>Jobs finished</span><span>${S.stats.jobsDone}</span><span>Bids won / placed</span><span>${S.stats.wins} / ${S.stats.bids}</span><span>Total earned</span><span>${fmt(S.stats.earned)}</span><span>Best job</span><span>${fmt(S.stats.bestJob)}</span><span>Storms survived</span><span>${S.stats.hails}</span></div></div>
   <div class="switch"><span>Sound</span><button class="btn sm ${S.sound ? 'grn' : ''}" data-act="sound">${S.sound ? 'ON' : 'OFF'}</button></div>
   <div class="switch"><span>Replay tutorial</span><button class="btn sm" data-act="retut">Replay</button></div>
   <div class="switch"><span>Start over</span><button class="btn sm" data-act="reset">Reset</button></div>
   <div class="s" style="text-align:center;margin-top:.6em">Roof Rush is a free game by <a href="https://itscloudy96.github.io/game-dev-kits/" target="_blank" rel="noopener">Cloudy</a>.</div>`;
  return h;
}
function updateLive() {
  document.querySelectorAll('[data-lv]').forEach(el => {
    const id = +el.dataset.id, k = el.dataset.lv;
    if (k === 'exp') { const L = S.leads.find(l => l.id === id); if (L) el.textContent = Math.max(0, L.exp - S.day) + 'd left'; }
    else if (k === 'jp' || k === 'jeta') {
      const j = S.jobs.find(j => j.id === id); if (!j) return;
      if (k === 'jp') el.style.width = (j.status === 'active' ? j.progress / j.work * 100 : 0) + '%';
      else { const c = S.crews.find(c => c.id === j.crewId); el.textContent = j.status === 'sched' ? 'Start within ' + Math.max(0, j.startBy - S.day) + 'd' : c ? Math.max(0, Math.ceil((j.work - j.progress) / E.effSpeed(S, c, j.kind))) + 'd to finish' : 'No crew'; }
    } else if (k === 'cm' || k === 'cmn') { const c = S.crews.find(c => c.id === id); if (c) { if (k === 'cm') el.style.width = c.morale + '%'; else el.textContent = Math.round(c.morale); } }
  });
}

/* ---------- modals ---------- */
const modal = $('#modal');
const modalOpen = () => !modal.classList.contains('hidden');
function openModal(html, center) { modal.className = center ? 'center' : ''; modal.innerHTML = `<div class="sheet">${html}</div>`; modal.classList.remove('hidden'); tutGlow(); }
function closeModal() { modal.classList.add('hidden'); modal.innerHTML = ''; bid = null; sig = ''; render(true); tutAfterModal(); }
function openBid(id) {
  const L = S.leads.find(l => l.id === id); if (!L) return;
  if (S.tut === 1) tutSet(2);
  const sg = E.suggestBid(S, L); bid = { id, ratio: Math.round(sg / L.price * 100), sg };
  const K = E.KINDS[L.kind], ce = E.costEstimate(S, L);
  openModal(`<h2>${K.label} · ${L.sq} sq</h2><div class="s" style="margin-top:-.2em">${esc(L.cust)} · ${E.TOWNS[L.town].name} · ${K.matName}</div>
  <div class="kv"><span>Market price</span><span>${fmt(L.price)}</span><span>Your cost (materials + crew time)</span><span>~${fmt(ce.total)}</span><span>Best crew</span><span>${ce.crew ? esc(ce.crew.name) + ' · ~' + Math.ceil(ce.days) + ' days' : 'none'}</span></div>
  <div class="rivals">Rivals: ${L.comps.map(c => esc(c.n) + ' (~' + fmt(c.mu * L.price) + ')').join(', ')}. Customer walks away over ${fmt(L.price * 1.28)}.</div>
  <div class="bidnum" id="bidnum"></div><input type="range" class="slider" id="bidslider" min="55" max="150" step="1" value="${bid.ratio}">
  <div style="display:flex;justify-content:space-between;font-size:.72em;font-weight:800;color:#6a7b9c"><span>cheap = wins more</span><span>pricey = more profit</span></div>
  <div class="kv"><span>Chance to win</span><span id="bidp"></span></div><div class="meter"><i id="bidmeter"></i></div>
  <div class="kv"><span>Profit if you win</span><span id="bidprofit"></span></div>
  ${S.tut === 2 ? '<div class="hint" style="margin-top:.5em">' + TUT[2].hint + '</div>' : ''}
  <div class="btns"><button class="btn gold" id="btnSuggest" data-act="suggest">Suggest a smart price</button><button class="btn pri" id="btnSubmit" data-act="submit">Submit bid</button><button class="btn" data-act="close">Cancel</button></div>`);
  updateBid();
}
function updateBid() {
  const L = S.leads.find(l => l.id === bid.id); if (!L) return;
  const price = Math.round(L.price * bid.ratio / 100 / 10) * 10, p = E.winChance(S, L, price), cost = E.costEstimate(S, L).total, profit = price - cost;
  $('#bidnum').textContent = fmt(price) + ' (' + bid.ratio + '%)';
  const pe = $('#bidp'); pe.textContent = Math.round(p * 100) + '%'; pe.className = 'win ' + winCls(p);
  const m = $('#bidmeter'); m.style.width = (p * 100) + '%'; m.style.background = p >= 0.6 ? '#2fbf71' : p >= 0.3 ? '#ffc22e' : '#ff5a4d';
  const pr = $('#bidprofit'); pr.textContent = (profit >= 0 ? '+' : '') + fmt(profit) + (profit < 0 ? ' (LOSS!)' : ''); pr.className = profit >= 0 ? 'pos' : 'neg';
  bid.price = price;
}
function submitBidUI(id, price) {
  const L = S.leads.find(l => l.id === id); if (!L) { closeModal(); return; }
  openModal(`<div class="result"><div class="big dots">Customer is reviewing bids</div><div class="s">${esc(L.cust)} is comparing ${L.comps.length + 1} quotes</div></div>`, true);
  setTimeout(() => {
    const r = E.submitBid(S, id, price);
    if (r.err) { openModal(`<h2 class="bad">Can't bid</h2><p>${r.err === 'lots' ? 'All the lots in that town are busy.' : r.err === 'rep' ? 'You need a higher reputation for that job.' : 'That lead is gone.'}</p><div class="btns"><button class="btn" data-act="close">OK</button></div>`, true); return; }
    if (r.win) {
      snd.win(); buzz(30);
      openModal(`<div class="result"><h2 class="good">YOU WON THE BID!</h2><div class="big pos">${fmt(r.bid)}</div><p>${esc(r.lead.cust)} chose you${r.p < 0.5 ? ' against the odds' : ''}. Deposit received: <b class="pos">+${fmt(r.deposit)}</b>. ${S.auto ? 'A crew will start right away.' : 'Assign a crew in the Jobs tab.'}</p><div class="btns"><button class="btn pri" data-act="close">Let\'s roof it!</button></div></div>`, true);
    } else {
      snd.lose();
      openModal(`<div class="result"><h2 class="bad">Lost the bid</h2><p>${esc(r.winner)} won it at ${fmt(r.winPrice)}. You bid ${fmt(r.bid)}.<br>${r.bid > r.winPrice ? 'Try pricing a bit lower next time.' : 'They just got lucky. Plenty more leads!'}</p><div class="btns"><button class="btn" data-act="close">Next lead</button></div></div>`, true);
    }
  }, 1100);
}
function openJob(id) {
  const j = S.jobs.find(j => j.id === id); if (!j) return;
  const K = E.KINDS[j.kind], crew = S.crews.find(c => c.id === j.crewId), prog = j.status === 'active' ? j.progress / j.work : 0;
  const est = j.price - Math.round(j.matBase * E.matMult(S)) - (crew ? j.work / E.effSpeed(S, crew, j.kind) * crew.wage : 0);
  openModal(`<h2>${K.label} · ${j.sq} sq</h2><div class="s">${esc(j.cust)} · ${E.TOWNS[j.town].name}</div><div class="bar" style="margin:.6em 0"><i style="width:${prog * 100}%"></i></div>
  <div class="kv"><span>Price</span><span>${fmt(j.price)}</span><span>Crew</span><span>${crew ? esc(crew.name) : 'none yet'}</span><span>Due in</span><span class="${S.day > j.due ? 'neg' : ''}">${j.due - S.day} days</span><span>Est. profit</span><span class="${est >= 0 ? 'pos' : 'neg'}">${fmt(est)}</span></div>
  <div class="btns"><button class="btn pri" data-act="assign" data-id="${j.id}">${j.status === 'sched' ? 'Assign a crew' : 'Swap crew'}</button><button class="btn" data-act="close">Close</button></div>`);
}
function openAssign(id) {
  const j = S.jobs.find(j => j.id === id); if (!j) return;
  const crews = S.crews.filter(c => !c.jobId && c.outUntil <= S.day);
  openModal(`<h2>Pick a crew</h2><div class="s">${E.KINDS[j.kind].label} · ${j.sq} sq. Specialists work 30% faster.</div>` + (crews.length ? crews.map(c => {
    const sp = E.effSpeed(S, c, j.kind), d = Math.ceil((j.work - j.progress) / sp);
    return `<div class="card"><div class="t"><div class="grow">${esc(c.name)}<div class="s">${E.SPECS[c.spec]}${c.spec === E.KINDS[j.kind].spec ? ' (match!)' : ''} · morale ${Math.round(c.morale)} · ~${d} days</div></div><button class="btn pri sm" data-act="doassign" data-id="${j.id}" data-crew="${c.id}">Send</button></div></div>`;
  }).join('') : '<div class="empty">No idle crews. Finish a job or hire another crew.</div>') + `<div class="btns"><button class="btn" data-act="close">Cancel</button></div>`);
}
function openEvent() {
  const ev = S.pending[0]; if (!ev) return;
  const v = E.eventView(S, ev); snd.alert(); buzz([40, 40, 40]);
  openModal(`<h2 class="${v.tone}">${esc(v.title)}</h2><p>${esc(v.text)}</p><div class="btns">${v.choices.map((c, i) => `<button class="btn ${i === 0 ? 'pri' : ''}" data-act="evchoice" data-i="${i}">${esc(c.label)}${c.sub ? '<small>' + esc(c.sub) + '</small>' : ''}</button>`).join('')}</div>`, true);
}

/* ---------- tutorial ---------- */
const coach = $('#coach');
const TUT = [
  { txt: '<b>Welcome to Roof Rush!</b> You run a tiny roofing company. <b>Win bids</b> from customers, let your <b>crews</b> do the work, get paid, and grow your empire to <b>$1,000,000</b>.', btn: "Let's go" },
  { txt: 'Time is paused while you learn. Tap the <b>glowing lead</b> to see the job and your rivals.', glow: '#firstLead' },
  { txt: '', hint: '<b>Set your price.</b> Cheap wins more often but earns less. Expensive earns more but loses the bid. Tap <b>Suggest</b>, then <b>Submit bid</b>.', glow: '#btnSuggest' },
  { txt: 'You won! Your crew starts automatically. Watch the <b>progress bar</b> fill on the town map above. Time is running now.', btn: 'Got it', run: true },
  { txt: '', wait: true, run: true },
  { txt: '<b>Cha-ching!</b> That is how every job works. Now grow: open the <b>Crews</b> tab to hire more help.', glow: '[data-tab=crews]' },
  { txt: 'Each crew needs a <b>truck</b>. Buy one, then <b>hire an applicant</b>. Pick specialists for the jobs you want.', glow: '#truckBtn,#firstHire' },
  { txt: 'You are in business! Watch for <b>storms and surprises</b>, spend profits in the <b>Office</b>, and claim rewards in <b>Goals</b>. Reach <b>$1M company value</b>!', btn: 'Start my empire', run: true },
];
function tutShow() {
  const t = TUT[S.tut]; if (!t || S.tut >= TUT.length || S.tutDone) { coach.classList.add('hidden'); panel.classList.remove('pad'); return; }
  panel.classList.toggle('pad', !!t.txt);
  if (!t.txt) { coach.classList.add('hidden'); return; }
  coach.className = '';
  coach.innerHTML = `<p>${t.txt}</p><div class="row">${t.btn ? `<button class="btn pri sm" data-act="tutnext">${t.btn}</button>` : '<span></span>'}<a href="#" data-act="tutskip">Skip tutorial</a></div>`;
}
function tutGlow() {
  document.querySelectorAll('.tut-glow').forEach(e => e.classList.remove('tut-glow'));
  if (S.tutDone) return; const t = TUT[S.tut]; if (!t || !t.glow) return;
  const el = (modalOpen() ? modal : document).querySelector(t.glow) || document.querySelector(t.glow); if (el) el.classList.add('tut-glow');
}
function tutSet(n) { if (S.tutDone) return; S.tut = n; tutShow(); tutGlow(); }
function tutAfterTab() { if (S.tut === 5 && tab === 'crews') tutSet(6); tutGlow(); }
function tutAfterModal() { if (S.tut === 2 && !modalOpen() && S.stats.wins >= 1) tutSet(3); }
function tutPaused() { if (S.tutDone) return false; const t = TUT[S.tut]; return !!t && !t.run; }
function tutEnd() { S.tutDone = true; S.tut = TUT.length; tutShow(); tutGlow(); save(); }

/* ---------- actions ---------- */
function afterAction() { sig = ''; render(true); save(); }
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-tab],[data-sp],[data-lead]'); if (!el) return;
  if (el.dataset.tab) { snd.tap(); setTab(el.dataset.tab); return; }
  if (el.dataset.sp != null) { speed = +el.dataset.sp; snd.tap(); return; }
  const a = el.dataset.act, id = +el.dataset.id;
  if (!a) { if (el.dataset.lead && !e.target.closest('button')) { /* card tap => bid */ openBid(+el.dataset.lead); } return; }
  e.preventDefault();
  switch (a) {
    case 'bid': snd.tap(); openBid(id); break;
    case 'quick': { snd.tap(); const price = +el.dataset.bid; if (S.tut === 1) tutSet(2); submitBidUI(id, price); break; }
    case 'suggest': { const L = S.leads.find(l => l.id === bid.id); bid.ratio = Math.round(bid.sg / L.price * 100); $('#bidslider').value = bid.ratio; updateBid(); const sb = $('#btnSubmit'); if (S.tut === 2) { sb.classList.add('tut-glow'); $('#btnSuggest').classList.remove('tut-glow'); } break; }
    case 'submit': { const p = bid.price, bi = bid.id; submitBidUI(bi, p); break; }
    case 'close': closeModal(); break;
    case 'auto': S.auto = !S.auto; if (S.auto) E.autoAssign(S); afterAction(); break;
    case 'autobid': S.autoBid = +el.dataset.v; afterAction(); break;
    case 'assign': openAssign(id); break;
    case 'doassign': if (E.assign(S, id, +el.dataset.crew)) { snd.buy(); closeModal(); afterAction(); } else { toast('Not enough cash for materials yet', 'bad'); } break;
    case 'hire': { const r = E.hire(S, id); if (r.ok) { snd.cha(); pulseCash(); buzz(20); toast('Crew hired!', 'good'); afterAction(); if (S.tut === 6) tutSet(7); } break; }
    case 'fire': if (confirm('Let this crew go? Their signing fee is not refunded.')) { E.fireCrew(S, id); afterAction(); } break;
    case 'bonus': if (E.bonusCrew(S, id)) { snd.buy(); toast('Bonus paid. Morale up!', 'good'); afterAction(); } break;
    case 'buy': { const r = E.buy(S, el.dataset.id); if (r.ok) { snd.buy(); buzz(20); toast('Upgrade bought!', 'good'); afterAction(); } break; }
    case 'town': { const r = E.buyTown(S, id); if (r.ok) { snd.cha(); buzz([30, 30, 60]); toast('New town opened! Fresh leads are waiting.', 'gold'); afterAction(); } break; }
    case 'camp': { const r = E.runCampaign(S, el.dataset.id); if (r.ok) { snd.buy(); toast('Campaign launched! 2 new leads.', 'good'); afterAction(); } break; }
    case 'claimg': { const n = E.claimGoal(S, el.dataset.id); if (n) { snd.cha(); pulseCash(); buzz(30); toast('+' + fmt(n) + ' goal bonus!', 'gold'); coinsBurst(); afterAction(); } break; }
    case 'claimm': { const n = E.claimMile(S, id); if (n) { snd.cha(); pulseCash(); buzz(30); toast('Milestone bonus +' + fmt(n) + '!', 'gold'); coinsBurst(); afterAction(); } break; }
    case 'sound': S.sound = !S.sound; if (S.sound) snd.buy(); afterAction(); break;
    case 'reset': if (confirm('Erase your whole company and start over?')) { localStorage.removeItem(KEY); S = E.newState(); S.speed = 2; location.reload(); } break;
    case 'retut': S.tutDone = false; S.tut = 0; tutShow(); setTab('leads'); break;
    case 'evchoice': { const i = +el.dataset.i; E.resolveEvent(S, i); closeModal(); afterAction(); if (S.pending.length) setTimeout(openEvent, 250); break; }
    case 'tutnext': snd.tap(); if (S.tut === 0) { tutSet(1); setTab('leads'); } else if (S.tut === 3) tutSet(4); else if (S.tut === 7) tutEnd(); break;
    case 'tutskip': tutEnd(); break;
    case 'offok': { const n = +el.dataset.id; S.cash += n; S.stats.earned += n; snd.cha(); pulseCash(); closeModal(); afterAction(); break; }
    case 'empireok': closeModal(); break;
  }
});
modal.addEventListener('input', e => { if (e.target.id === 'bidslider' && bid) { bid.ratio = +e.target.value; updateBid(); } });
function coinsBurst() { for (let i = 0; i < 18; i++) coins.push({ x: 195 + (Math.random() - 0.5) * 120, y: 60, vx: (Math.random() - 0.5) * 160, vy: -140 - Math.random() * 100, t: 0 }); }

/* ---------- engine events -> feedback ---------- */
function handleFx() {
  const q = S.fx2; if (!q || !q.length) return; S.fx2 = [];
  for (const f of q) {
    if (f.type === 'win') { const j = S.jobs.find(j => j.id === f.job); if (j) burst(j.town, j.lot, '+' + fmt(f.amt) + ' deposit', '#7dffa8', 6); pulseCash(); }
    else if (f.type === 'done') { burst(f.town, f.lot, '+' + fmt(f.amt), '#ffe066', 18); pulseCash(); snd.cha(); buzz(25); toast('Job paid ' + fmt(f.amt) + ' (' + (f.profit >= 0 ? '+' : '') + fmt(f.profit) + ' profit)', 'gold'); if (S.tut === 4) { tutSet(5); } }
    else if (f.type === 'payday') toast('Payday! Crews paid ' + fmt(f.amt), 'bad');
    else if (f.type === 'month') toast(f.month + ' report: ' + (f.net >= 0 ? '+' : '') + fmt(f.net) + ' profit', f.net >= 0 ? 'good' : 'bad');
    else if (f.type === 'hail') { flash = 1; buzz([60, 40, 60]); toast('Hail storm! Storm leads incoming', 'bad'); }
    else if (f.type === 'rain') toast('Rain delay: crews wait it out', 'bad');
    else if (f.type === 'viral') { toast('Your review went viral!', 'gold'); coinsBurst(); }
    else if (f.type === 'cancel') toast('A customer canceled: crews took too long', 'bad');
    else if (f.type === 'empire') setTimeout(() => openModal(`<div class="result"><h2 class="good">ROOFING EMPIRE!</h2><div class="big pos">$1,000,000</div><p>You grew a tiny crew into a million-dollar roofing company. Amazing! Keep going: new goals unlock up to $10M.</p><div class="btns"><button class="btn pri" data-act="empireok">Keep building</button></div></div>`, true), 600);
  }
}

/* ---------- offline earnings ---------- */
function maybeOffline() {
  if (offlineShown || wasNew || !S.saved) return;
  const away = (Date.now() - S.saved) / 1000; offlineShown = true;
  const n = E.offlineEarn(S, away); if (n <= 0 || away < 120) return;
  const hrs = Math.min(6, away / 3600);
  openModal(`<div class="result"><h2 class="good">Welcome back!</h2><p>You were away about ${hrs < 1 ? Math.round(hrs * 60) + ' minutes' : hrs.toFixed(1) + ' hours'}. Happy customers kept calling, and your crews picked up repeat work.</p><div class="big pos">+${fmt(n)}</div><div class="btns"><button class="btn gold" data-act="offok" data-id="${n}">Collect</button></div></div>`, true);
}

/* ---------- main loop ---------- */
let last = 0, uiT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  if (S.pending.length && !modalOpen() && !hidden) openEvent();
  if (!modalOpen() && !hidden && !tutPaused() && speed > 0 && !S.pending.length) {
    E.advance(S, dt * speed / DAY_SEC);
    if (S.pending.length && !modalOpen()) openEvent();
  }
  handleFx();
  syncRows(); drawTown(dt); updateHud(dt);
  uiT += dt;
  if (uiT > 0.25) { uiT = 0; render(false); updateLive(); }
  if (now - lastSave > 5000) { lastSave = now; save(); }
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (hidden) { save(); } else { offlineShown = false; maybeOffline(); last = 0; } });
window.addEventListener('pagehide', save);
window.addEventListener('resize', resizeCanvas);

/* ---------- boot ---------- */
if (wasNew && !S.tutDone) { S.tut = 0; speed = 2; }
syncRows(); setTab('leads'); tutShow(); tutGlow(); maybeOffline();
requestAnimationFrame(frame);
window.RR = {
  get S() { return S; }, E, get tab() { return tab; },
  forceEvent(id) { E.forceEvent(S, id, S.crews[0]); },
  skip(days) { let n = days; while (n > 0) { E.advance(S, Math.min(1, n)); n -= 1; while (S.pending.length) E.resolveEvent(S, 0); } sig = ''; },
  setSpeed(v) { speed = v; }, openEvent,
};
})();
