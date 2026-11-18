/* Roof Rush – a Cloudy game. Single-file canvas game, no dependencies. MIT licensed. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const stage = $('#stage'), canvas = $('#c'), ctx = canvas.getContext('2d');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

/* ---------- data ---------- */
const LEVELS = [
  { name: 'Garden Shed',    cols: 3, rows: 4, pay: 60,  time: 45,  tough: [0, 0],     speed: 1.0,  shingle: '#44546a', wall: '#f2c46d' },
  { name: 'Cozy Cottage',   cols: 4, rows: 5, pay: 110, time: 50,  tough: [0.12, 0],  speed: 1.12, shingle: '#b5483a', wall: '#fff0c9' },
  { name: 'Corner Ranch',   cols: 5, rows: 6, pay: 180, time: 58,  tough: [0.25, 0],  speed: 1.25, shingle: '#3b7d6b', wall: '#cfe8f7' },
  { name: 'Townhouse',      cols: 6, rows: 7, pay: 270, time: 64,  tough: [0.3, 0.1], speed: 1.4,  shingle: '#6b4f9e', wall: '#f7d0d0' },
  { name: 'Old Farmhouse',  cols: 6, rows: 8, pay: 380, time: 70,  tough: [0.3, 0.2], speed: 1.55, shingle: '#8a5a3c', wall: '#e9e3d0' },
  { name: 'Grand Mansion',  cols: 7, rows: 9, pay: 520, time: 78, tough: [0.3, 0.25],speed: 1.7,  shingle: '#2f3e46', wall: '#e5d5f2' },
];
const UPG = [
  { id: 'tool', name: 'Tear-off Tool', names: ['Hand Pry Bar', 'Roofing Shovel', 'Power Stripper', 'Mega Stripper'], costs: [40, 120, 300],
    desc: 'Wider swipe and stronger hits when ripping shingles.' },
  { id: 'nail', name: 'Nail Gun', names: ['Claw Hammer', 'Nail Gun', 'Pro Nailer', 'Auto Nailer'], costs: [50, 150, 350],
    desc: 'Slower shingle slider and a bigger perfect zone.' },
  { id: 'crew', name: 'Crew Helper', names: ['Just you', '1 helper', '2 helpers', '3 helpers'], costs: [80, 200, 450],
    desc: 'Helpers tear off and roll out underlayment for you.' },
  { id: 'radio', name: 'Weather Radio', names: ['No radio', 'Basic radio', 'Pro radio'], costs: [30, 90],
    desc: 'Early storm warnings: +8 seconds per level.' },
];
const SAVE_KEY = 'roofrush.v1';
let save = loadSave();
function defaultSave() { return { money: 0, up: { tool: 0, nail: 0, crew: 0, radio: 0 }, unlocked: 1, stars: [], best: [], sound: false }; }
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.up) return Object.assign(defaultSave(), s, { up: Object.assign(defaultSave().up, s.up) }); } catch (e) {}
  return defaultSave();
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

/* ---------- audio (off by default) ---------- */
let actx = null;
function beep(f, d = 0.08, type = 'square', vol = 0.05, slide = 0) {
  if (!save.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f; if (slide) o.frequency.linearRampToValueAtTime(f + slide, actx.currentTime + d);
    g.gain.value = vol; g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + d);
    o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + d);
  } catch (e) {}
}
const sfx = {
  rip: () => beep(rnd(120, 200), 0.07, 'sawtooth', 0.05, -60),
  roll: () => beep(rnd(300, 360), 0.05, 'triangle', 0.04),
  nail: q => beep(q > 0.9 ? 880 : q > 0.5 ? 620 : 240, 0.12, 'square', 0.06),
  phase: () => { beep(520, 0.1, 'triangle', 0.07); setTimeout(() => beep(780, 0.15, 'triangle', 0.07), 90); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'triangle', 0.07), i * 120)),
  lose: () => [330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sawtooth', 0.06), i * 160)),
  buy: () => beep(980, 0.15, 'triangle', 0.07),
};

/* ---------- layout ---------- */
let W = 400, H = 860, sx = 1, sy = 1;
const L = {};
function resize() {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = 400; H = clamp(Math.round(400 * r.height / Math.max(1, r.width)), 560, 1000);
  canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  sx = canvas.width / W; sy = canvas.height / H;
  if (G) layoutFor(G.def); else layoutFor(MENU_DEF);
}
function layoutFor(def) {
  L.cols = def.cols; L.rows = def.rows;
  L.eave = H - 215;
  L.roofW = clamp(def.cols * 68, 240, 340);
  const avail = L.eave - 138;
  L.rowH = Math.min(58, avail / def.rows);
  L.roofH = L.rowH * def.rows;
  L.roofX = (W - L.roofW) / 2;
  L.roofTop = L.eave - L.roofH;
  L.cellW = L.roofW / def.cols;
}
const rowY = r => L.eave - (r + 1) * L.rowH;

/* ---------- game state ---------- */
const MENU_DEF = LEVELS[1];
let G = null;           // active job
let MENU = null;        // decorative preview
let mode = 'menu';      // menu | play | paused | result
let ptr = { down: false, x: 0, y: 0 };
let clouds = [], rain = [], flash = 0;
for (let i = 0; i < 7; i++) clouds.push({ x: rnd(0, 400), y: rnd(120, 330), s: rnd(0.6, 1.3), v: rnd(3, 9) });
for (let i = 0; i < 160; i++) rain.push({ x: rnd(0, 400), y: rnd(0, 900), v: rnd(520, 760) });

function upLvl(id) { return save.up[id] || 0; }
function newGame(lv, preview) {
  const def = LEVELS[lv];
  const cells = [];
  let totalHp = 0;
  for (let i = 0; i < def.cols * def.rows; i++) {
    const q = Math.random();
    const hp = q < def.tough[1] ? 3 : q < def.tough[1] + def.tough[0] ? 2 : 1;
    cells.push({ hp, max: hp, under: false, last: -1, seed: Math.random() });
    totalHp += hp;
  }
  const g = {
    lv, def, cells, totalHp, remHp: totalHp, remUnder: cells.length,
    phase: preview ? 'tear' : 'ready', ready: 1.4, t: 0,
    limit: def.time + 8 * upLvl('radio'), left: def.time + 8 * upLvl('radio'),
    rowsDone: 0, rows: [], stripT: 0, stripDir: 1, cool: 0,
    score: 0, combo: 0, perfects: 0, popups: [], parts: [], workers: [], banner: null, shake: 0, doneT: 0,
  };
  const crew = upLvl('crew');
  for (let i = 0; i < crew; i++) g.workers.push({ x: 40 + i * 30, y: L.eave + 50, tgt: -1, work: 0, bob: rnd(0, 6) });
  return g;
}
function startJob(lv) {
  if (lv >= save.unlocked || lv < 0) return;
  G = newGame(lv, false); layoutFor(G.def);
  G.workers.forEach((w, i) => { w.x = L.roofX + 20 + i * 30; w.y = L.eave + 45; });
  banner('Phase 1: Tear Off!', 'Swipe over the old shingles', 1.4);
  setMode('play');
}
function setMode(m) {
  mode = m;
  for (const id of ['title', 'howto', 'board', 'result', 'pause']) $('#' + id).classList.add('hidden');
  if (m === 'menu') $('#title').classList.remove('hidden');
  else if (m === 'board') $('#board').classList.remove('hidden');
  else if (m === 'result') $('#result').classList.remove('hidden');
  else if (m === 'paused') $('#pause').classList.remove('hidden');
  if (m === 'menu' || m === 'board') { G = null; layoutFor(MENU_DEF); }
}
function banner(t, sub, d) { if (G) G.banner = { t, sub, d, age: 0 }; }

/* ---------- gameplay ---------- */
const TOOL_R = [14, 24, 36, 50], TOOL_DMG = [1, 1, 2, 2], ROLL_R = [18, 26, 36, 46];
function cellsNear(x, y, r) {
  const out = [];
  const c0 = Math.floor((x - r - L.roofX) / L.cellW), c1 = Math.floor((x + r - L.roofX) / L.cellW);
  const baseY = L.eave;
  const r0 = Math.floor((baseY - (y + r)) / L.rowH), r1 = Math.floor((baseY - (y - r)) / L.rowH);
  for (let rr = Math.max(0, r0); rr <= Math.min(L.rows - 1, r1); rr++)
    for (let cc = Math.max(0, c0); cc <= Math.min(L.cols - 1, c1); cc++) {
      const rx = L.roofX + cc * L.cellW, ry = rowY(rr);
      const dx = Math.max(rx - x, 0, x - (rx + L.cellW)), dy = Math.max(ry - y, 0, y - (ry + L.rowH));
      if (dx * dx + dy * dy <= r * r) out.push(rr * L.cols + cc);
    }
  return out;
}
const cellC = i => ({ x: L.roofX + (i % L.cols + 0.5) * L.cellW, y: rowY(Math.floor(i / L.cols)) + L.rowH / 2 });
function popup(x, y, text, color = '#fff') { G.popups.push({ x, y, text, color, t: 0 }); }
function chips(x, y, col, n = 6) { for (let i = 0; i < n; i++) G.parts.push({ x, y, vx: rnd(-90, 90), vy: rnd(-170, -30), life: rnd(0.4, 0.8), t: 0, col, s: rnd(3, 6) }); }

function hitTear(i, dmg, quiet) {
  const c = G.cells[i]; if (c.hp <= 0) return;
  const dealt = Math.min(dmg, c.hp); c.hp -= dealt; G.remHp -= dealt; c.last = G.t;
  const p = cellC(i);
  chips(p.x, p.y, ['#8d6e63', '#a1887f', '#6d4c41'][(Math.random() * 3) | 0], c.hp ? 3 : 8);
  if (!quiet) sfx.rip();
  if (c.hp <= 0) { G.score += 5; if (G.remHp <= 0) nextPhase(); }
}
function hitUnder(i, quiet) {
  const c = G.cells[i]; if (c.hp > 0 || c.under) return;
  c.under = true; G.remUnder--; G.score += 3;
  const p = cellC(i); chips(p.x, p.y, '#9fb3d9', 3);
  if (!quiet) sfx.roll();
  if (G.remUnder <= 0) nextPhase();
}
function nextPhase() {
  sfx.phase();
  if (G.phase === 'tear') { G.phase = 'under'; banner('Phase 2: Underlayment', 'Swipe to roll out the felt', 1.4); }
  else if (G.phase === 'under') {
    G.phase = 'shingle'; G.stripT = 0; G.cool = 0.5;
    banner('Phase 3: Shingles!', 'Tap when it lines up with the chalk line', 1.8);
  }
}
function brush(dt) {
  if (!ptr.down || !G) return;
  if (G.phase === 'tear') {
    const r = TOOL_R[upLvl('tool')], dmg = TOOL_DMG[upLvl('tool')];
    for (const i of cellsNear(ptr.x, ptr.y, r)) if (G.cells[i].hp > 0 && G.t - G.cells[i].last >= 0.1) hitTear(i, dmg);
  } else if (G.phase === 'under') {
    for (const i of cellsNear(ptr.x, ptr.y, ROLL_R[upLvl('tool')])) hitUnder(i);
  }
}
function stripParams() {
  const lv = G.lv, nail = upLvl('nail'), crew = upLvl('crew');
  return {
    amp: 105 + 8 * lv,
    omega: Math.max(0.85, 1.05 * G.def.speed - 0.1 * nail),
    perfect: 9 + 3 * nail + 2 * crew - lv * 0.5,
  };
}
function stripOffset() {
  const p = stripParams();
  return p.amp * Math.cos(p.omega * G.stripT) * G.stripDir;
}
function place() {
  if (!G || G.phase !== 'shingle' || G.cool > 0) return;
  const p = stripParams(), off = stripOffset(), err = Math.abs(off);
  const acc = err <= p.perfect ? 1 : clamp(1 - (err - p.perfect) / 65, 0, 1);
  const row = G.rowsDone;
  G.rows.push({ off, acc });
  G.rowsDone++;
  let label, col;
  if (acc >= 1) { label = 'PERFECT!'; col = '#7dffa8'; G.combo++; G.perfects++; G.score += 100 + 25 * (G.combo - 1); }
  else if (err <= p.perfect + 16) { label = 'Good'; col = '#fff176'; G.combo = 0; G.score += Math.round(acc * 100); }
  else if (err <= 45) { label = 'Sloppy'; col = '#ffb74d'; G.combo = 0; G.score += Math.round(acc * 100); G.shake = 0.15; }
  else { label = 'Way off!'; col = '#ff8a80'; G.combo = 0; G.shake = 0.25; }
  popup(W / 2, rowY(row) + L.rowH / 2, label + (G.combo > 1 ? ' x' + G.combo : ''), col);
  const nx = L.roofX + (row % 2 ? 20 : L.roofW - 20);
  chips(nx, rowY(row) + L.rowH / 2, acc >= 1 ? '#fff59d' : '#cfd8dc', 8);
  sfx.nail(acc);
  G.stripT = 0; G.stripDir = row % 2 ? 1 : -1; G.cool = 0.18;
  if (G.rowsDone >= L.rows) finish(true);
}
function progress() {
  if (!G) return 0;
  const t = 1 - G.remHp / G.totalHp, u = 1 - G.remUnder / G.cells.length, s = G.rowsDone / L.rows;
  return { t, u, s };
}
function finish(win) {
  const lv = G.lv, def = G.def;
  G.phase = win ? 'done' : 'failed'; G.doneT = 0;
  G.win = win;
  if (win) { sfx.win(); banner('JOB DONE!', 'Nice work, boss', 1.6); }
  else { sfx.lose(); banner('STORM HIT!', 'The tarp is on. Try again!', 1.6); }
}
function showResult() {
  const g = G, def = g.def, lv = g.lv;
  const acc = g.rows.length ? g.rows.reduce((a, r) => a + r.acc, 0) / g.rows.length : 0;
  const frac = Math.max(0, g.left) / g.limit;
  let stars = 0, pay, tip = 0, bonus = 0;
  if (g.win) {
    stars = 1 + (acc >= 0.55) + (acc >= 0.8) + (frac >= 0.2) + (frac >= 0.4);
    tip = g.perfects * (2 + lv);
    pay = Math.round(def.pay * (0.6 + 0.2 * stars));
    bonus = Math.round(g.left) * 20;
    g.score += bonus;
  } else {
    const p = progress(); pay = Math.round(def.pay * 0.15 * (p.t + p.u + p.s) / 3);
  }
  const total = pay + tip;
  save.money += total;
  if (g.win) {
    save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, lv + 2));
    save.stars[lv] = Math.max(save.stars[lv] || 0, stars);
    save.best[lv] = Math.max(save.best[lv] || 0, g.score);
  }
  persist();
  $('#resTitle').textContent = g.win ? 'Job Complete!' : 'Storm Hit!';
  $('#resStars').innerHTML = g.win ? starHtml(stars, 5, true) : '<span class="off">★</span>';
  const msgs = g.win
    ? ['Rough, but it keeps the rain out.', 'Solid work. The customer is happy.', 'Great job! Customer left a review.', 'Fast and tidy. Very nice!', 'FIVE STARS! The neighbors want you next.'][stars - 1]
    : 'The storm rolled in before the roof was done. You still get a little for the cleanup.';
  const rows = g.win ? [
    ['Accuracy', Math.round(acc * 100) + '%'], ['Perfect rows', g.perfects + ' / ' + L.rows],
    ['Time left', Math.max(0, g.left).toFixed(1) + 's'], ['Score', g.score.toLocaleString()],
    ['Job pay', '$' + pay], ['Tips', '$' + tip],
  ] : [['Roof finished', Math.round((progress().t + progress().u + progress().s) / 3 * 100) + '%'], ['Cleanup pay', '$' + pay]];
  $('#resMsg').textContent = msgs;
  $('#resTable').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('') + `<tr class="tot"><td>Earned</td><td>+$${total}</td></tr>`;
  const last = lv >= LEVELS.length - 1;
  $('#btnNext').style.display = g.win && !last ? '' : 'none';
  $('#btnRetry').textContent = g.win ? 'Replay for more stars' : 'Retry';
  if (g.win && last) $('#resMsg').textContent += ' You have roofed every house in town!';
  lastLv = lv;
  setMode('result');
}
let lastLv = 0;
const starHtml = (n, max, anim) => Array.from({ length: max }, (_, i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');

function updateWorkers(dt) {
  const g = G;
  for (const w of g.workers) {
    w.bob += dt * 8;
    let tx = w.hx, ty = w.hy, working = false;
    if (g.phase === 'tear' || g.phase === 'under') {
      const need = i => g.phase === 'tear' ? g.cells[i].hp > 0 : g.cells[i].hp <= 0 && !g.cells[i].under;
      if (w.tgt < 0 || !need(w.tgt)) {
        const cand = [];
        for (let i = 0; i < g.cells.length; i++) if (need(i) && !g.workers.some(o => o !== w && o.tgt === i)) cand.push(i);
        w.tgt = cand.length ? cand[(Math.random() * cand.length) | 0] : -1; w.work = 0;
      }
      if (w.tgt >= 0) {
        const c = cellC(w.tgt), dx = c.x - w.x, dy = c.y - w.y, d = Math.hypot(dx, dy);
        if (d > 8) { const v = 110 * dt / d; w.x += dx * v; w.y += dy * v; }
        else { working = true; w.work += dt; if (w.work >= 0.55) { w.work = 0; if (g.phase === 'tear') hitTear(w.tgt, 1, true); else hitUnder(w.tgt, true); } }
        w.swing = working;
      }
    } else {
      const idx = g.workers.indexOf(w);
      const hx = L.roofX + 24 + idx * 34, hy = L.eave + 46;
      const dx = hx - w.x, dy = hy - w.y, d = Math.hypot(dx, dy);
      if (d > 4) { const v = 140 * dt / d; w.x += dx * v; w.y += dy * v; }
      w.swing = g.phase === 'shingle';
    }
  }
}
function update(dt) {
  if (!G || mode !== 'play') return;
  const g = G;
  g.t += dt;
  if (g.banner) { g.banner.age += dt; if (g.banner.age > g.banner.d) g.banner = null; }
  g.shake = Math.max(0, g.shake - dt);
  if (g.phase === 'ready') { g.ready -= dt; if (g.ready <= 0) g.phase = 'tear'; }
  else if (g.phase === 'tear' || g.phase === 'under' || g.phase === 'shingle') {
    g.left -= dt;
    if (g.left <= 0) { g.left = 0; finish(false); }
    brush(dt);
    updateWorkers(dt);
    if (g.phase === 'shingle') { g.stripT += dt; g.cool = Math.max(0, g.cool - dt); }
  } else if (g.phase === 'done' || g.phase === 'failed') {
    g.doneT += dt; if (g.doneT > 1.7) showResult();
  }
  for (const p of g.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; }
  g.parts = g.parts.filter(p => p.t < p.life);
  for (const p of g.popups) p.t += dt;
  g.popups = g.popups.filter(p => p.t < 1);
}

/* ---------- drawing ---------- */
const hx = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function cloud(x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.arc(x, y, 22 * s, 0, 7); ctx.arc(x + 24 * s, y - 10 * s, 28 * s, 0, 7); ctx.arc(x + 52 * s, y, 22 * s, 0, 7); ctx.rect(x, y, 52 * s, 22 * s);
  ctx.fill();
}
function storm() { return G && G.phase !== 'ready' ? clamp(1 - G.left / G.limit, 0, 1) : (G ? 0 : 0.05); }
let T = 0;
function drawBg(s) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#4aaef0', '#2b3340', s)); g.addColorStop(0.7, mix('#d6f0ff', '#6c7788', s));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (s < 0.8) { ctx.globalAlpha = 1 - s * 1.25; ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(70, 165, 34, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,160,.35)'; ctx.beginPath(); ctx.arc(70, 165, 52, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  for (const c of clouds) {
    const x = ((c.x + T * c.v * (1 + s * 2)) % 520) - 100;
    cloud(x, c.y - s * 30, c.s * (1 + s * 0.5), mix('#ffffff', '#4e5766', clamp(s * 1.3, 0, 1)));
  }
  if (s > 0.3) { // storm bank rolling in
    const a = (s - 0.3) / 0.7;
    const gg = ctx.createLinearGradient(0, 0, 0, 80 + a * 260);
    gg.addColorStop(0, `rgba(25,30,42,${0.55 + a * 0.4})`); gg.addColorStop(1, 'rgba(25,30,42,0)');
    ctx.fillStyle = gg; ctx.fillRect(0, 0, W, 80 + a * 260);
  }
  // hills + ground
  ctx.fillStyle = mix('#7ed36b', '#2e5a38', s); ctx.beginPath(); ctx.ellipse(70, H - 150, 230, 90, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = mix('#5fbf5a', '#25492f', s); ctx.beginPath(); ctx.ellipse(340, H - 140, 220, 70, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = mix('#58b552', '#20402a', s); ctx.fillRect(0, L.eave + 78, W, H);
  ctx.fillStyle = mix('#b79f78', '#4c4538', s); ctx.fillRect(0, L.eave + 78, W, 10);
}
function tree(x, s) {
  ctx.fillStyle = mix('#6d4c41', '#2f2420', s); ctx.fillRect(x - 5, L.eave + 40, 10, 40);
  ctx.fillStyle = mix('#3fa65a', '#1d4026', s); ctx.beginPath(); ctx.arc(x, L.eave + 28, 26, 0, 7); ctx.arc(x - 14, L.eave + 44, 18, 0, 7); ctx.arc(x + 14, L.eave + 44, 18, 0, 7); ctx.fill();
}
function drawHouse(def, s) {
  tree(26, s); tree(W - 26, s);
  const wx = L.roofX + 8, ww = L.roofW - 16, wy = L.eave + 6;
  ctx.fillStyle = mix(def.wall, '#59606e', s * 0.7); ctx.fillRect(wx, wy, ww, 74);
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; for (let y = wy + 9; y < wy + 74; y += 9) { ctx.beginPath(); ctx.moveTo(wx, y); ctx.lineTo(wx + ww, y); ctx.stroke(); }
  const lit = s > 0.5;
  ctx.fillStyle = lit ? '#ffe08a' : '#8fd0f5'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  for (const fx of [wx + ww * 0.15, wx + ww * 0.65]) { ctx.fillRect(fx, wy + 14, ww * 0.2, 28); ctx.strokeRect(fx, wy + 14, ww * 0.2, 28); }
  ctx.fillStyle = '#b5483a'; rr(wx + ww * 0.42, wy + 22, ww * 0.16, 52, 5); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(wx + ww * 0.55, wy + 50, 2.5, 0, 7); ctx.fill();
}
function drawOldCell(c, x, y, w, h) {
  const pal = ['#8d6e63', '#7d6b60', '#6f5f55', '#9a8374'];
  ctx.fillStyle = pal[(c.seed * 4) | 0]; ctx.fillRect(x, y, w, h);
  const dmg = c.hp < c.max;
  ctx.strokeStyle = 'rgba(40,25,15,.35)'; ctx.lineWidth = 1.5;
  const half = h / 2;
  for (let k = 0; k < 2; k++) {
    const yy = y + k * half, off = k ? w / 4 : 0;
    ctx.beginPath(); ctx.moveTo(x, yy + half); ctx.lineTo(x + w, yy + half); ctx.stroke();
    for (let xx = x + off; xx < x + w; xx += w / 2) { ctx.beginPath(); ctx.moveTo(xx, yy + half * 0.45); ctx.lineTo(xx, yy + half); ctx.stroke(); }
  }
  if (c.max > 1) { ctx.fillStyle = 'rgba(76,140,60,.55)'; ctx.beginPath(); ctx.arc(x + w * 0.3, y + h * 0.35, Math.min(w, h) * 0.2, 0, 7); ctx.arc(x + w * 0.7, y + h * 0.62, Math.min(w, h) * 0.16, 0, 7); ctx.fill(); }
  if (dmg) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h * 0.2); ctx.lineTo(x + w * 0.45, y + h * 0.5); ctx.lineTo(x + w * 0.38, y + h * 0.8); ctx.stroke(); }
  if (c.max > 1) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3b2a20'; ctx.lineWidth = 1;
    for (let i = 0; i < c.hp; i++) { ctx.beginPath(); ctx.arc(x + w / 2 + (i - (c.hp - 1) / 2) * 9, y + h - 8, 3.2, 0, 7); ctx.fill(); ctx.stroke(); } }
}
function drawStrip(x, y, w, h, col, rowIdx, shadow) {
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 4, y + 6, w, h); }
  ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.5, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(255,255,255,.18)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
  const stag = (rowIdx % 2) * L.cellW / 2;
  for (let xx = x + stag; xx < x + w + 1; xx += L.cellW) { ctx.beginPath(); ctx.moveTo(xx, y + h * 0.5); ctx.lineTo(xx, y + h); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeRect(x, y, w, h);
}
function drawRoof(g, s) {
  const def = g.def;
  // chimney
  ctx.fillStyle = '#a5503f'; ctx.fillRect(L.roofX + L.roofW * 0.68, L.roofTop - 34, 34, 70);
  ctx.fillStyle = '#7d3a2d'; ctx.fillRect(L.roofX + L.roofW * 0.68 - 4, L.roofTop - 42, 42, 10);
  // plane base
  ctx.fillStyle = '#d9b382'; ctx.fillRect(L.roofX, L.roofTop, L.roofW, L.roofH);
  for (let i = 0; i < g.cells.length; i++) {
    const c = g.cells[i], x = L.roofX + (i % L.cols) * L.cellW, y = rowY(Math.floor(i / L.cols));
    if (c.hp > 0) drawOldCell(c, x, y, L.cellW, L.rowH);
    else if (c.under) {
      ctx.fillStyle = '#3b4560'; ctx.fillRect(x, y, L.cellW, L.rowH);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(x, y + L.rowH); ctx.lineTo(x + L.cellW * 0.5, y); ctx.lineTo(x + L.cellW * 0.8, y); ctx.lineTo(x + L.cellW * 0.3, y + L.rowH); ctx.fill();
      ctx.fillStyle = '#e8edf8'; for (const [a, b] of [[4, 4], [L.cellW - 4, 4], [4, L.rowH - 4], [L.cellW - 4, L.rowH - 4]]) { ctx.beginPath(); ctx.arc(x + a, y + b, 1.6, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = (Math.floor(i / L.cols) + i) % 2 ? '#d9b382' : '#cfa874'; ctx.fillRect(x, y, L.cellW, L.rowH);
      ctx.strokeStyle = 'rgba(120,80,40,.25)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + L.rowH / 2); ctx.lineTo(x + L.cellW, y + L.rowH / 2); ctx.stroke();
      ctx.fillStyle = '#8a6a44'; ctx.beginPath(); ctx.arc(x + L.cellW * 0.25, y + L.rowH * 0.3, 1.5, 0, 7); ctx.arc(x + L.cellW * 0.75, y + L.rowH * 0.7, 1.5, 0, 7); ctx.fill();
    }
  }
  // chalk guide + placed rows (clipped to roof)
  ctx.save(); ctx.beginPath(); ctx.rect(L.roofX, L.roofTop, L.roofW, L.roofH); ctx.clip();
  g.rows.forEach((r, i) => {
    const y = rowY(i);
    drawStrip(L.roofX + r.off, y, L.roofW, L.rowH + 3, def.shingle, i, false);
    if (Math.abs(r.off) > 6) { // exposed gap warning
      ctx.fillStyle = 'rgba(255,60,60,.28)';
      if (r.off > 0) ctx.fillRect(L.roofX, y, r.off, L.rowH + 3); else ctx.fillRect(L.roofX + L.roofW + r.off, y, -r.off, L.rowH + 3);
    }
  });
  ctx.restore();
  // ridge + eave + rakes
  ctx.fillStyle = '#2d3550'; rr(L.roofX - 6, L.roofTop - 12, L.roofW + 12, 14, 6); ctx.fill();
  ctx.fillStyle = '#f1f1f1'; ctx.fillRect(L.roofX - 8, L.eave, L.roofW + 16, 7);
  ctx.fillStyle = '#e0e0e0'; ctx.fillRect(L.roofX - 5, L.roofTop - 2, 5, L.roofH + 2); ctx.fillRect(L.roofX + L.roofW, L.roofTop - 2, 5, L.roofH + 2);
  // shingle slider
  if (g.phase === 'shingle' && g.rowsDone < L.rows) {
    const y = rowY(g.rowsDone);
    const pulse = 0.5 + 0.5 * Math.sin(T * 6);
    ctx.save(); ctx.setLineDash([9, 6]); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.7 + 0.3 * pulse})`;
    ctx.strokeRect(L.roofX, y, L.roofW, L.rowH); ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(L.roofX, y, L.roofW, L.rowH);
    const off = stripOffset();
    drawStrip(L.roofX + off, y - 3, L.roofW, L.rowH, def.shingle, g.rowsDone, true);
    // offset hint
    const p = stripParams();
    if (Math.abs(off) <= p.perfect) { ctx.strokeStyle = '#7dffa8'; ctx.lineWidth = 4; ctx.strokeRect(L.roofX + off, y - 3, L.roofW, L.rowH); }
  }
}
function drawWorker(w, g) {
  const x = w.x, y = w.y + Math.sin(w.bob) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 9, 3, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#2f6fdb'; rr(x - 6, y - 2, 12, 14, 4); ctx.fill();
  ctx.fillStyle = '#ffcfa0'; ctx.beginPath(); ctx.arc(x, y - 7, 6, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x, y - 9, 6.5, Math.PI, 0); ctx.fill(); ctx.fillRect(x - 8, y - 9, 16, 2.5);
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.5; ctx.beginPath();
  const sw = w.swing ? Math.sin(T * 18 + w.bob) * 6 : 0;
  ctx.moveTo(x + 5, y + 2); ctx.lineTo(x + 12, y - 4 + sw); ctx.stroke();
  ctx.fillStyle = '#888'; ctx.fillRect(x + 10, y - 7 + sw, 6, 3);
}
function drawWeather(s) {
  if (s > 0.55) {
    const a = clamp((s - 0.55) / 0.45, 0, 1);
    ctx.strokeStyle = `rgba(190,215,255,${0.25 + 0.4 * a})`; ctx.lineWidth = 1.5; ctx.beginPath();
    const n = Math.floor(rain.length * a);
    for (let i = 0; i < n; i++) { const r = rain[i]; const y = (r.y + T * r.v) % (H + 40) - 20; const x = (r.x - y * 0.18 + 400) % 400; ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); }
    ctx.stroke();
  }
  if (s > 0.85 && G && (G.phase !== 'done')) { if (Math.random() < 0.012) flash = 0.7; }
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (s > 0.2) { ctx.fillStyle = `rgba(10,15,30,${(s - 0.2) * 0.28})`; ctx.fillRect(0, 0, W, H); }
}
const HINT = { tear: 'Swipe or tap the old shingles to rip them off!', under: 'Swipe over the bare deck to roll out the felt', shingle: 'TAP when the shingles line up with the chalk line!' };
function drawHud(g) {
  // top bar
  ctx.fillStyle = 'rgba(20,28,48,.72)'; ctx.fillRect(0, 0, W, 104);
  ctx.fillStyle = '#fff'; ctx.font = '800 17px ui-rounded,"Trebuchet MS",system-ui,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  ctx.fillText(g.def.name, 14, 20);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23f'; ctx.fillText('Score ' + g.score, W / 2 + 20, 20);
  // pause button
  ctx.fillStyle = '#fff'; rr(W - 44, 7, 32, 28, 8); ctx.fill(); ctx.fillStyle = '#1d2a44'; ctx.fillRect(W - 35, 14, 5, 14); ctx.fillRect(W - 26, 14, 5, 14);
  // timer bar
  const frac = clamp(g.left / g.limit, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(14, 44, W - 28, 18, 9); ctx.fill();
  ctx.fillStyle = frac > 0.4 ? '#4cd964' : frac > 0.2 ? '#ffb02e' : '#ff4d4d';
  if (frac > 0.01) { rr(14, 44, Math.max(18, (W - 28) * frac), 18, 9); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = '800 12px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(frac > 0.2 ? 'Storm in ' + Math.ceil(g.left) + 's' : 'STORM COMING! ' + Math.ceil(g.left) + 's', W / 2, 53.5);
  // phase chips
  const pr = progress(), names = ['1 Tear Off', '2 Underlay', '3 Shingles'], vals = [pr.t, pr.u, pr.s], keys = ['tear', 'under', 'shingle'];
  const cw = (W - 28 - 12) / 3;
  for (let i = 0; i < 3; i++) {
    const x = 14 + i * (cw + 6), cur = g.phase === keys[i], done = vals[i] >= 1;
    ctx.fillStyle = cur ? 'rgba(255,138,61,.35)' : 'rgba(255,255,255,.14)'; rr(x, 70, cw, 24, 8); ctx.fill();
    if (vals[i] > 0) { ctx.fillStyle = done ? '#4cd964' : '#ff8a3d'; rr(x, 70, Math.max(12, cw * vals[i]), 24, 8); ctx.fill(); }
    ctx.strokeStyle = cur ? '#fff' : 'rgba(255,255,255,.3)'; ctx.lineWidth = cur ? 2 : 1; rr(x, 70, cw, 24, 8); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 12px ui-rounded,system-ui,sans-serif'; ctx.fillText((done ? '✓ ' : '') + names[i], x + cw / 2, 82.5);
  }
  // bottom hint
  const hint = HINT[g.phase];
  if (hint) {
    ctx.fillStyle = 'rgba(20,28,48,.72)'; rr(14, H - 64, W - 28, 44, 14); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '800 14px ui-rounded,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(hint, W / 2, H - 42);
  }
  if (g.combo > 1 && g.phase === 'shingle') { ctx.fillStyle = '#7dffa8'; ctx.font = '900 16px ui-rounded,system-ui,sans-serif'; ctx.fillText('Combo x' + g.combo, W / 2, 118); }
  // banner
  if (g.banner) {
    const b = g.banner, a = clamp(Math.min(b.age / 0.2, (b.d - b.age) / 0.25), 0, 1);
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(20,28,48,.85)'; rr(20, H / 2 - 52, W - 40, 100, 20); ctx.fill();
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 4; rr(20, H / 2 - 52, W - 40, 100, 20); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '900 26px ui-rounded,"Trebuchet MS",system-ui,sans-serif'; ctx.fillText(b.t, W / 2, H / 2 - 14);
    ctx.fillStyle = '#ffe08a'; ctx.font = '700 15px ui-rounded,system-ui,sans-serif'; ctx.fillText(b.sub, W / 2, H / 2 + 22);
    ctx.globalAlpha = 1;
  }
}
function drawBrush() {
  if (!ptr.down || !G) return;
  if (G.phase === 'tear') { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, TOOL_R[upLvl('tool')], 0, 7); ctx.stroke();
    ctx.fillStyle = '#c9ced6'; ctx.save(); ctx.translate(ptr.x, ptr.y); ctx.rotate(-0.6); ctx.fillRect(-3, -34, 6, 34); ctx.fillStyle = '#e53935'; ctx.fillRect(-3, -34, 6, 10); ctx.restore(); }
  else if (G.phase === 'under') { ctx.strokeStyle = 'rgba(160,190,255,.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, ROLL_R[upLvl('tool')], 0, 7); ctx.stroke(); }
}
function render(dt) {
  T += dt; flash = Math.max(0, flash - dt * 2.5);
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  const g = G || MENU;
  const s = G ? storm() : 0.05;
  ctx.save();
  if (G && G.shake > 0) ctx.translate(rnd(-4, 4), rnd(-4, 4));
  drawBg(s);
  drawHouse(g.def, s);
  drawRoof(g, s);
  if (G) for (const w of G.workers) drawWorker(w, G);
  if (G) {
    for (const p of G.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.s, p.s); }
    ctx.globalAlpha = 1;
    drawBrush();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const p of G.popups) { ctx.globalAlpha = 1 - p.t; ctx.font = '900 24px ui-rounded,"Trebuchet MS",system-ui,sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = '#1d2a44'; ctx.strokeText(p.text, p.x, p.y - p.t * 40); ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y - p.t * 40); }
    ctx.globalAlpha = 1;
  }
  drawWeather(s);
  ctx.restore();
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  if (G && (mode === 'play' || mode === 'paused' || mode === 'result')) drawHud(G);
}

/* ---------- input ---------- */
function toLogical(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = toLogical(e); ptr.x = p.x; ptr.y = p.y;
  if (mode !== 'play' || !G) return;
  if (p.y < 44 && p.x > W - 56) { pauseGame(); return; }
  ptr.down = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  if (G.phase === 'shingle') place(); else brush(0);
});
canvas.addEventListener('pointermove', e => { const p = toLogical(e); ptr.x = p.x; ptr.y = p.y; if (ptr.down) e.preventDefault(); });
const up = () => { ptr.down = false; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
window.addEventListener('keydown', e => { if ((e.code === 'Space' || e.code === 'Enter') && mode === 'play' && G && G.phase === 'shingle') { e.preventDefault(); place(); } else if (e.code === 'Escape' && mode === 'play') pauseGame(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play' && G && ['tear', 'under', 'shingle'].includes(G.phase)) pauseGame(); });
function pauseGame() { ptr.down = false; setMode('paused'); }

/* ---------- menus ---------- */
function refreshSound() { const t = 'Sound: ' + (save.sound ? 'On' : 'Off'); $('#btnSound').textContent = t; $('#btnSound2').textContent = t; }
function toggleSound() { save.sound = !save.sound; persist(); refreshSound(); sfx.buy(); }
function renderBoard() {
  $('#boardMoney').textContent = '$' + save.money;
  $('#jobs').innerHTML = LEVELS.map((d, i) => {
    const lock = i >= save.unlocked, st = save.stars[i] || 0;
    return `<div class="card ${lock ? 'locked' : ''}"><div class="num">${i + 1}</div><div class="info"><b>${d.name}</b>
      <small>${d.cols}×${d.rows} roof · storm in ${d.time + 8 * upLvl('radio')}s · $${d.pay}+</small><br>
      <span class="st">${lock ? '<small>Locked: beat job ${i}</small>' : starHtml(st, 5)}</span></div>
      <button class="btn" data-job="${i}" ${lock ? 'disabled' : ''}>${st ? 'Replay' : 'Start'}</button></div>`;
  }).join('');
  $('#garage').innerHTML = UPG.map(u => {
    const lv = upLvl(u.id), max = u.costs.length, cost = u.costs[lv];
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
    const btn = lv >= max ? '<button class="btn" disabled>MAX</button>' : `<button class="btn" data-buy="${u.id}" ${save.money < cost ? 'disabled' : ''}>$${cost}</button>`;
    return `<div class="card"><div class="info"><b>${u.name}<span class="pips">${pips}</span></b><small>Now: ${u.names[lv]}${lv < max ? ' → ' + u.names[lv + 1] : ''}<br>${u.desc}</small></div>${btn}</div>`;
  }).join('');
}
function showTab(t) { $('#jobs').classList.toggle('hidden', t !== 'jobs'); $('#garage').classList.toggle('hidden', t !== 'garage'); $('#tabJobs').classList.toggle('on', t === 'jobs'); $('#tabGarage').classList.toggle('on', t === 'garage'); }
function openBoard(tab) { renderBoard(); showTab(tab || 'jobs'); setMode('board'); }
$('#btnPlay').onclick = () => openBoard('jobs');
$('#btnHow').onclick = () => { $('#howto').classList.remove('hidden'); $('#title').classList.add('hidden'); };
$('#btnHowBack').onclick = () => { $('#howto').classList.add('hidden'); $('#title').classList.remove('hidden'); };
$('#btnSound').onclick = toggleSound; $('#btnSound2').onclick = toggleSound;
$('#btnReset').onclick = e => { e.preventDefault(); if (confirm('Erase your earnings, upgrades and stars?')) { save = defaultSave(); persist(); refreshSound(); } };
$('#btnBoardBack').onclick = () => setMode('menu');
$('#tabJobs').onclick = () => showTab('jobs'); $('#tabGarage').onclick = () => showTab('garage');
$('#jobs').addEventListener('click', e => { const b = e.target.closest('[data-job]'); if (b && !b.disabled) startJob(+b.dataset.job); });
$('#garage').addEventListener('click', e => {
  const b = e.target.closest('[data-buy]'); if (!b || b.disabled) return;
  const u = UPG.find(x => x.id === b.dataset.buy), lv = upLvl(u.id), cost = u.costs[lv];
  if (lv < u.costs.length && save.money >= cost) { save.money -= cost; save.up[u.id] = lv + 1; persist(); sfx.buy(); renderBoard(); }
});
$('#btnResume').onclick = () => setMode('play');
$('#btnQuit').onclick = () => openBoard('jobs');
$('#btnNext').onclick = () => startJob(Math.min(LEVELS.length - 1, lastLv + 1));
$('#btnRetry').onclick = () => startJob(lastLv);
$('#btnGarage').onclick = () => openBoard('garage');
$('#btnMenu').onclick = () => openBoard('jobs');

/* ---------- boot ---------- */
function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000); frame.last = now;
  update(dt); render(dt);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', resize);
layoutFor(MENU_DEF); MENU = newGame(1, true); resize(); MENU = newGame(1, true);
MENU.cells.forEach((c, i) => { if (i % 5 === 0) { c.hp = 0; } });
refreshSound(); setMode('menu');
requestAnimationFrame(frame);
// small hook used by automated tests
window.RR = { get g() { return G; }, get L() { return L; }, get mode() { return mode; }, stripOffset: () => (G ? stripOffset() : 0), perfectTol: () => (G ? stripParams().perfect : 0), save: () => save };
})();
