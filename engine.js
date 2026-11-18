/* Roof Rush Tycoon – game engine (pure logic, no DOM). Used by the UI and by the node economy sim. MIT. */
(function (root) {
'use strict';

/* ================= static data ================= */
const KINDS = {
  repair:  { label: 'Roof Repair',     rate: 400, mat: 110, work: 0.5, sz: [1, 4],    spec: 'repair',  min: 0,   color: '#35c2a1', matName: 'Patch kit & flashing' },
  shingle: { label: 'Re-roof',         rate: 300, mat: 150, work: 1.0, sz: [10, 26],  spec: 'shingle', min: 1.0, color: '#ff8a3d', matName: 'Asphalt shingles' },
  storm:   { label: 'Storm Damage',    rate: 325, mat: 155, work: 1.0, sz: [12, 30],  spec: 'shingle', min: 1.5, color: '#4f86f0', matName: 'Impact-rated shingles' },
  metal:   { label: 'Metal Roof',      rate: 520, mat: 250, work: 1.35, sz: [14, 32], spec: 'metal',   min: 3.0, color: '#8d9db0', matName: 'Standing-seam metal' },
  flat:    { label: 'Commercial Flat', rate: 360, mat: 180, work: 0.9, sz: [40, 110], spec: 'flat',    min: 3.5, color: '#8e6bd0', matName: 'TPO membrane' },
};
const SPECS = { repair: 'Repairs', shingle: 'Shingles', metal: 'Metal', flat: 'Flat roofs' };
const TOWNS = [
  { name: 'Maple Heights', mult: 1.0,  size: 1.0,  work: 1.0, cost: 0,      rep: 0,   office: 0, share: 5,   kinds: ['repair', 'shingle', 'storm'] },
  { name: 'Riverside',     mult: 1.25, size: 1.15, work: 1.15, cost: 25000, rep: 2.5, office: 0, share: 3.5, kinds: ['repair', 'shingle', 'storm', 'metal'] },
  { name: 'Oak Hill',      mult: 1.6,  size: 1.35, work: 1.35, cost: 120000, rep: 3.5, office: 1, share: 3,   kinds: ['shingle', 'storm', 'metal', 'repair'] },
  { name: 'Downtown',      mult: 2.1,  size: 1.6,  work: 1.7, cost: 450000, rep: 4.2, office: 2, share: 3.5, kinds: ['flat', 'flat', 'metal'] },
];
const UPS = {
  trucks: { name: 'Trucks',        desc: 'Each truck lets you run one more crew.', costs: [1200, 3500, 9000, 22000, 50000, 110000, 220000], max: 8, base: 1 },
  tools:  { name: 'Power Tools',   desc: 'Nail guns and tear-off tools: crews work 8% faster per level.', costs: [600, 2200, 7500, 24000, 75000] },
  dump:   { name: 'Dumpsters & Lifts', desc: 'Faster cleanup and less waste: materials cost 4% less per level.', costs: [600, 2500, 9000, 30000, 90000] },
  safety: { name: 'Safety Gear',   desc: 'Fewer injuries and happier crews.', costs: [700, 3000, 12000, 40000] },
  train:  { name: 'Crew Training', desc: 'Every crew does +5 quality per level, so fewer callbacks and more stars.', costs: [1500, 7000, 28000, 90000] },
  sales:  { name: 'Sales Rep',     desc: 'Brings in more leads and a hot lead each week. Level 2+ unlocks Auto-Bid. Costs salary every payday.', costs: [2500, 10000, 40000, 140000, 400000], salary: 60 },
  office: { name: 'Office',        desc: 'More lead board space, better applicants, unlocks big towns and more sales levels.', costs: [4000, 30000, 150000], names: ['Garage', 'Rented office', 'Office suite', 'Headquarters'] },
};
const CAMPAIGNS = {
  signs:  { name: 'Yard Signs',        cost: 250,   days: 12, boost: 0.30, rep: 0,    min: 0 },
  flyers: { name: 'Door Flyers',       cost: 900,   days: 15, boost: 0.50, rep: 0.02, min: 0 },
  ads:    { name: 'Online Ads',        cost: 3500,  days: 20, boost: 0.80, rep: 0.03, min: 1 },
  radio:  { name: 'Radio Spots',       cost: 14000, days: 25, boost: 1.20, rep: 0.05, min: 2 },
  tv:     { name: 'TV Commercial',     cost: 55000, days: 30, boost: 1.80, rep: 0.08, min: 3 },
};
const RIVALS = ['Summit Roofing', 'Bluebird Roofers', 'Big Box Roofing', 'Budget Shingles', 'Apex Exteriors', 'Hometown Roofers', 'Cheapo Roofs'];
const LAST = ['Alvarez', 'Brooks', 'Chen', 'Dawson', 'Ellis', 'Fischer', 'Garcia', 'Hughes', 'Ito', 'Jensen', 'Kim', 'Lopez', 'Murphy', 'Nguyen', 'Ortiz', 'Patel', 'Quinn', 'Reyes', 'Singh', 'Turner', 'Vega', 'Walsh', 'Young', 'Zimmer'];
const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'The', 'Dr.'];
const BIZ = ['Hartwell Storage', 'Pioneer Plaza', 'Lakeview Mall', 'Delta Logistics', 'Bright Smiles Dental', 'Corner Market', 'Metro Offices', 'Sunrise Bakery', 'Granite Bank', 'Fieldstone Church', 'Elm Street School', 'Valley Gym'];
const CREW_A = ['Ridge', 'Summit', 'Peak', 'Hammer', 'Storm', 'Shingle', 'Gable', 'Eave', 'Lucky', 'Rapid', 'Iron', 'Blue', 'Eagle', 'Copper'];
const CREW_B = ['Runners', 'Crew', 'Squad', 'Roofers', 'Raiders', 'Pros', 'Gang', 'Kings', 'Hawks', 'Bandits'];
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const MILES = [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000];
const GOALS = [
  { id: 'firstbid', name: 'Win your first bid',        reward: 200,   check: s => s.stats.wins >= 1 },
  { id: 'firstjob', name: 'Finish your first job',     reward: 250,   check: s => s.stats.jobsDone >= 1 },
  { id: 'hire',     name: 'Hire your second crew',     reward: 300,   check: s => s.crews.length >= 2 },
  { id: 'jobs5',    name: 'Finish 5 jobs',             reward: 500,   check: s => s.stats.jobsDone >= 5 },
  { id: 'hail',     name: 'Ride out a hail storm',     reward: 400,   check: s => s.stats.hails >= 1 },
  { id: 'rep3',     name: 'Reach 3 stars',             reward: 800,   check: s => s.rep >= 3 },
  { id: 'jobs25',   name: 'Finish 25 jobs',            reward: 2500,  check: s => s.stats.jobsDone >= 25 },
  { id: 'crews4',   name: 'Run 4 crews',               reward: 3000,  check: s => s.crews.length >= 4 },
  { id: 'sales',    name: 'Hire a sales rep',          reward: 1000,  check: s => s.ups.sales >= 1 },
  { id: 'perfect5', name: '5 flawless jobs (quality 90+)', reward: 2500, check: s => s.stats.perfect >= 5 },
  { id: 'town2',    name: 'Open a second town',        reward: 4000,  check: s => s.ups.towns >= 2 },
  { id: 'rep4',     name: 'Reach 4 stars',             reward: 10000, check: s => s.rep >= 4 },
  { id: 'jobs100',  name: 'Finish 100 jobs',           reward: 15000, check: s => s.stats.jobsDone >= 100 },
  { id: 'crews8',   name: 'Run 8 crews',               reward: 30000, check: s => s.crews.length >= 8 },
  { id: 'town4',    name: 'Win downtown',              reward: 50000, check: s => s.ups.towns >= 4 },
  { id: 'rep45',    name: 'Reach 4.5 stars',           reward: 40000, check: s => s.rep >= 4.5 },
];

/* ================= helpers ================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function rand(s) { s.rs = (s.rs + 0x6D2B79F5) | 0; let t = s.rs; t = Math.imul(t ^ (t >>> 15), 1 | t); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const rr = (s, a, b) => a + rand(s) * (b - a);
const ri = (s, a, b) => Math.floor(rr(s, a, b + 1));
const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
const round10 = v => Math.max(10, Math.round(v / 10) * 10);
const round5 = v => Math.round(v / 5) * 5;
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const cdf = z => 0.5 * (1 + erf(z / Math.SQRT2));
function nrm(s) { let u = 0, v = 0; while (u === 0) u = rand(s); v = rand(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const SD = 0.09;
const PACE = 0.25; // squares per day for a speed-1 crew
function dateOf(day) { return { m: MONTHS[Math.floor(day / 30) % 12], d: (day % 30) + 1, y: Math.floor(day / 360) + 1 }; }
function log(s, text, tone) { s.log.unshift({ day: s.day, text, tone: tone || '' }); if (s.log.length > 40) s.log.pop(); s.dirty = true; }
function emit(s, type, data) { (s.fx2 = s.fx2 || []).push(Object.assign({ type }, data)); }
function earn(s, amt) { s.cash += amt; s.dayNet += amt; s.stats.earned += amt; }
function spendOp(s, amt) { s.cash -= amt; s.dayNet -= amt; }
function spendCap(s, amt) { s.cash -= amt; }

/* ================= state ================= */
function makeCrew(s, o) {
  return Object.assign({ id: s.nextId++, name: 'Crew', spec: 'shingle', speed: 3, quality: 55, wage: 50, morale: 75, jobId: null, outUntil: 0, idle: 0 }, o);
}
function newState(seed) {
  const s = {
    v: 2, rs: (seed || (Date.now() & 0x7fffffff)) | 0, day: 0, t: 0, cash: 1500, rep: 2.0, nextId: 1,
    crews: [], candidates: [], candDay: -99, leads: [], jobs: [], claims: [], pending: [], log: [], recent: [],
    ups: { trucks: 1, tools: 0, dump: 0, safety: 0, train: 0, sales: 0, office: 0, towns: 1 },
    camp: {}, fx: {}, auto: true, autoBid: 0, priceMult: 1, debt: 0, assets: 0,
    stats: { bids: 0, wins: 0, jobsDone: 0, earned: 0, hails: 0, perfect: 0, bestJob: 0, callbacks: 0, lost: 0 },
    goals: {}, miles: {}, net: [], dayNet: 0, tut: 0, nextEvent: 11, lastEvent: 0, sound: false, won: false, speed: 2, saved: 0,
  };
  s.crews.push(makeCrew(s, { name: 'Home Team', spec: 'shingle', speed: 3, quality: 58, wage: 45, morale: 80 }));
  // tutorial lead: friendly first bid
  const L = genLead(s, { kind: 'shingle', town: 0, sq: 10, comps: [{ n: 'Budget Shingles', mu: 1.04 }], cust: 'Mrs. Alvarez', exp: 30 });
  L.tut = true; s.leads.push(L);
  for (let i = 0; i < 3; i++) s.leads.push(genLead(s));
  refreshCandidates(s, true);
  return s;
}

/* ================= leads & bidding ================= */
function leadRate(s) {
  let r = 0.30 + 0.07 * s.ups.sales;
  let m = 1;
  for (const id in s.camp) if (s.camp[id] > s.day) m += CAMPAIGNS[id].boost;
  if (s.fx.viral > s.day) m += 0.8;
  r *= m;
  if (s.fx.hail > s.day) r += 0.9;
  return r;
}
function boardCap(s) { return 6 + 2 * s.ups.office + (s.fx.hail > s.day ? 4 : 0); }
function pickTown(s) {
  let tot = 0; for (let i = 0; i < s.ups.towns; i++) tot += TOWNS[i].share;
  let x = rand(s) * tot; for (let i = 0; i < s.ups.towns; i++) { x -= TOWNS[i].share; if (x <= 0) return i; } return 0;
}
function genLead(s, o) {
  o = o || {};
  const town = o.town != null ? o.town : pickTown(s), T = TOWNS[town];
  let kind = o.kind;
  if (!kind) {
    kind = pick(s, T.kinds);
    if (town === 0 && s.ups.towns === 1 && kind === 'repair' && rand(s) < 0.2) kind = 'shingle';
    if (kind === 'storm' && !(s.fx.hail > s.day) && rand(s) < 0.6) kind = 'shingle';
    if (s.fx.hail > s.day && town < 3 && rand(s) < 0.6) kind = 'storm';
  }
  const K = KINDS[kind];
  let sq = o.sq || Math.max(1, Math.round(rr(s, K.sz[0], K.sz[1]) * (kind === 'repair' ? 1 : T.size)));
  const hot = o.hot != null ? o.hot : false;
  const variance = rr(s, 0.93, 1.1);
  let price = round10(sq * K.rate * T.mult * variance * (1 + 0.03 * s.ups.sales) * (kind === 'storm' ? 1.05 : 1) * (hot ? 1.12 : 1));
  const nc = o.comps ? o.comps.length : hot ? 1 : kind === 'repair' ? ri(s, 1, 2) : kind === 'flat' || kind === 'metal' ? ri(s, 1, 2) : ri(s, 2, 3);
  const comps = o.comps || [];
  const names = RIVALS.slice();
  while (comps.length < nc) { const n = names.splice(Math.floor(rand(s) * names.length), 1)[0]; comps.push({ n, mu: round2(rr(s, 0.88, 1.05)) }); }
  let cust = o.cust;
  if (!cust) cust = kind === 'flat' ? pick(s, BIZ) : (pick(s, TITLES) === 'The' ? 'The ' + pick(s, LAST) + ' family' : pick(s, TITLES.slice(0, 3)) + ' ' + pick(s, LAST));
  return {
    id: s.nextId++, kind, town, sq, price, work: round1(sq * K.work * T.work), matBase: Math.round(sq * K.mat * T.mult),
    minRep: Math.max(K.min, town === 2 ? 3.0 : 0), exp: s.day + (o.exp || ri(s, 5, 9)), comps, cust, hot, ins: kind === 'storm',
    born: s.day,
  };
}
const round2 = v => Math.round(v * 100) / 100, round1 = v => Math.round(v * 10) / 10;
function spawnLeads(s) {
  let l = leadRate(s), n = 0;
  while (l > 0 && n < 3) { if (rand(s) < Math.min(1, l)) { addLead(s, genLead(s)); n++; } l -= 1; }
  // weekly hot lead from sales rep
  if (s.ups.sales > 0 && s.day % 7 === 3) { addLead(s, genLead(s, { hot: true })); log(s, 'Your sales rep landed a HOT lead.', 'good'); }
}
function addLead(s, L) {
  s.leads.push(L);
  const cap = boardCap(s);
  while (s.leads.length > cap) { let k = 0; for (let i = 1; i < s.leads.length; i++) if (s.leads[i].exp < s.leads[k].exp) k = i; s.leads.splice(k, 1); }
  s.dirty = true;
}
function matMult(s) { return s.priceMult * (1 - 0.04 * s.ups.dump); }
function bestCrewFor(s, lead) {
  let best = null, bs = -1;
  for (const c of s.crews) { const v = effSpeed(s, c, lead.kind); if (v > bs) { bs = v; best = c; } }
  return best;
}
function costEstimate(s, lead) {
  const mats = Math.round(lead.matBase * matMult(s));
  const c = bestCrewFor(s, lead);
  const days = c ? lead.work / effSpeed(s, c, lead.kind) : lead.work / 2;
  const labor = Math.round(days * (c ? c.wage : 250));
  return { mats, labor, days, total: mats + labor, crew: c };
}
function userEff(s, lead, bid) {
  const ratio = bid / lead.price;
  let e = ratio / (1 + 0.045 * (s.rep - 2.5));
  if (s.fx.undercut > s.day) e += 0.07;
  return e;
}
function budgetFactor(ratio) { return clamp(1 - (ratio - 1.28) / 0.22, 0, 1); }
function winChance(s, lead, bid) {
  const e = userEff(s, lead, bid);
  let p = 1;
  for (const c of lead.comps) p *= 1 - cdf((e - c.mu) / SD);
  return clamp(p * budgetFactor(bid / lead.price), 0, 1);
}
function suggestBid(s, lead, mode) {
  const cost = costEstimate(s, lead).total;
  let best = lead.price, bv = -1e18;
  for (let r = 0.6; r <= 1.5001; r += 0.01) {
    const bid = round10(lead.price * r);
    const p = winChance(s, lead, bid), prof = bid - cost;
    let v = p * prof;
    if (prof < cost * 0.08) v = -1e12 + bid;          // never suggest a razor-thin or losing bid
    if (mode === 'safe') v = prof >= cost * 0.28 ? p * prof + 1e6 * 0 : -1e12 + bid;
    if (v > bv) { bv = v; best = bid; }
  }
  return best;
}
function freeLots(s, town) { return 4 - s.jobs.filter(j => j.town === town && j.status !== 'done').length; }
function submitBid(s, id, bid) {
  const i = s.leads.findIndex(l => l.id === id); if (i < 0) return { err: 'gone' };
  const L = s.leads[i];
  if (s.rep + 1e-9 < L.minRep) return { err: 'rep' };
  if (freeLots(s, L.town) <= 0) return { err: 'lots' };
  bid = round10(clamp(bid, L.price * 0.55, L.price * 1.6));
  const p = winChance(s, L, bid);
  const e = userEff(s, L, bid);
  s.stats.bids++;
  let best = { n: null, c: 9 };
  for (const c of L.comps) { const x = c.mu + SD * nrm(s); if (x < best.c) best = { n: c.n, c: x }; }
  let win = e < best.c && rand(s) < budgetFactor(bid / L.price);
  if (s.stats.bids === 1 && p >= 0.5) win = true; // friendly first bid
  s.leads.splice(i, 1); s.dirty = true;
  if (!win) {
    s.stats.lost++;
    const wp = round10(Math.max(best.c, 0.5) * L.price);
    return { win: false, winner: best.n || 'Another roofer', winPrice: wp, p, bid, lead: L };
  }
  const job = {
    id: s.nextId++, kind: L.kind, town: L.town, sq: L.sq, cust: L.cust, price: bid, work: L.work, matBase: L.matBase, progress: 0, status: 'sched',
    crewId: null, won: s.day, startBy: s.day + 26, due: 0, started: 0, labor: 0, ins: L.ins, lot: 0, mats: 0,
  };
  const used = s.jobs.filter(j => j.town === L.town && j.status !== 'done').map(j => j.lot);
  for (let k = 0; k < 4; k++) if (!used.includes(k)) { job.lot = k; break; }
  const best0 = bestCrewFor(s, L);
  const ref = best0 ? L.work / effSpeed(s, best0, L.kind) : L.work / 2;
  job.due = s.day + Math.max(7, Math.round(ref * 2.1) + 5);
  const dep = Math.round(bid * 0.35); job.deposit = dep; earn(s, dep);
  s.jobs.push(job); s.stats.wins++;
  log(s, 'Won ' + KINDS[L.kind].label + ' for ' + L.cust + ' at $' + bid.toLocaleString(), 'good');
  emit(s, 'win', { job: job.id, amt: dep });
  autoAssign(s);
  return { win: true, job, p, bid, deposit: dep, lead: L };
}
function autoBidAll(s) {
  if (!s.autoBid || s.ups.sales < 2) return;
  for (const L of s.leads.slice()) {
    if (s.rep < L.minRep || freeLots(s, L.town) <= 0) continue;
    const cost = costEstimate(s, L).total;
    let bid;
    if (s.autoBid === 1) bid = Math.max(round10(L.price * 0.98), round10(cost * 1.3));
    else if (s.autoBid === 2) bid = suggestBid(s, L);
    else bid = Math.max(round10(cost * 1.1), round10(L.price * 0.86));
    const r = submitBid(s, L.id, bid);
    if (r && r.win === false) log(s, 'Auto-bid lost to ' + r.winner, '');
  }
}

/* ================= crews ================= */
function specMult(crew, kind) {
  const K = KINDS[kind]; if (crew.spec === K.spec) return 1.3;
  return (K.spec === 'metal' || K.spec === 'flat') ? 0.6 : 0.8;
}
function effSpeed(s, crew, kind) {
  return PACE * crew.speed * specMult(crew, kind) * (0.6 + 0.4 * crew.morale / 100) * (1 + 0.08 * s.ups.tools);
}
function effQuality(s, crew, kind) {
  const m = crew.spec === KINDS[kind].spec ? 6 : ((KINDS[kind].spec === 'metal' || KINDS[kind].spec === 'flat') ? -12 : -4);
  return crew.quality + 5 * s.ups.train + m + (crew.morale - 60) * 0.1;
}
function crewName(s) {
  for (let t = 0; t < 30; t++) { const n = pick(s, CREW_A) + ' ' + pick(s, CREW_B); if (!s.crews.some(c => c.name === n) && !s.candidates.some(c => c.name === n)) return n; }
  return 'Crew ' + s.nextId;
}
function genCandidate(s, first) {
  const tier = s.rep * 0.5 + s.ups.office * 0.5;
  const speed = round1(clamp(2.4 + tier * 0.9 + rr(s, -0.5, 1.4) + s.crews.length * 0.12, 2.2, 11));
  const quality = Math.round(clamp(46 + tier * 5 + rr(s, -10, 22), 35, 95));
  const wage = round5(speed * 13 + quality * 0.4 + rr(s, -4, 4));
  const specs = ['repair', 'shingle', 'shingle', 'shingle'];
  if (s.ups.towns >= 2 || s.rep >= 2.5) specs.push('metal');
  if (s.ups.towns >= 4 || s.rep >= 3.5) specs.push('flat', 'flat');
  const spec = first ? 'shingle' : pick(s, specs);
  const c = { id: s.nextId++, name: crewName(s), spec, speed, quality, wage, fee: round5(wage * 8), morale: 70 };
  if (first) { c.speed = 3.2; c.quality = 62; c.wage = 55; c.fee = 450; }
  return c;
}
function refreshCandidates(s, first) {
  s.candidates = [];
  const n = 3 + Math.floor(s.ups.office / 1) ;
  for (let i = 0; i < Math.min(5, n); i++) s.candidates.push(genCandidate(s, first && i === 0));
  s.candDay = s.day; s.dirty = true;
}
function hire(s, id) {
  const i = s.candidates.findIndex(c => c.id === id); if (i < 0) return { err: 'gone' };
  const c = s.candidates[i];
  if (s.crews.length >= s.ups.trucks) return { err: 'truck' };
  if (s.cash < c.fee) return { err: 'cash' };
  spendCap(s, c.fee);
  s.candidates.splice(i, 1);
  s.crews.push(makeCrew(s, { name: c.name, spec: c.spec, speed: c.speed, quality: c.quality, wage: c.wage, morale: 75 }));
  log(s, 'Hired ' + c.name + '!', 'good'); emit(s, 'hire', {}); s.dirty = true;
  autoAssign(s);
  return { ok: true };
}
function fireCrew(s, id) {
  const i = s.crews.findIndex(c => c.id === id); if (i < 0 || s.crews.length <= 1) return false;
  const c = s.crews[i];
  const j = s.jobs.find(j => j.crewId === id && j.status === 'active'); if (j) { j.status = 'sched'; j.crewId = null; }
  s.crews.splice(i, 1); s.dirty = true; return true;
}
function bonusCrew(s, id) {
  const c = s.crews.find(c => c.id === id); if (!c) return false;
  const cost = c.wage * 3; if (s.cash < cost) return false;
  spendOp(s, cost); c.morale = clamp(c.morale + 25, 0, 100); emit(s, 'spend', {}); s.dirty = true; return true;
}
function assign(s, jobId, crewId) {
  const j = s.jobs.find(j => j.id === jobId), c = s.crews.find(c => c.id === crewId);
  if (!j || !c || j.status === 'done') return false;
  if (c.jobId || c.outUntil > s.day) return false;
  if (j.status === 'active' && j.crewId) { const old = s.crews.find(x => x.id === j.crewId); if (old) old.jobId = null; }
  return startJob(s, j, c);
}
function startJob(s, j, c) {
  if (j.status !== 'active' && !j.mats) {
    const need = Math.round(j.matBase * matMult(s));
    if (s.cash < need) { j.needCash = need; s.dirty = true; return false; }   // can't buy materials yet
    j.mats = need; spendOp(s, need); emit(s, 'spend', {}); j.needCash = 0;
  }
  j.crewId = c.id; c.jobId = j.id; c.idle = 0;
  if (j.status !== 'active') { j.status = 'active'; j.started = s.day; }
  s.dirty = true; return true;
}
function autoAssign(s) {
  if (!s.auto) return;
  for (const c of s.crews) {
    if (c.jobId || c.outUntil > s.day) continue;
    const cand = s.jobs.filter(j => j.status === 'sched' || (j.status === 'active' && !s.crews.some(x => x.id === j.crewId)));
    if (!cand.length) break;
    cand.sort((a, b) => (specMult(c, b.kind) - specMult(c, a.kind)) || (a.due - b.due));
    for (const j of cand) if (startJob(s, j, c)) break;
  }
}

/* ================= value & goals ================= */
function monthlyNet(s) { return s.net.reduce((a, b) => a + b, 0) + s.dayNet; }
function value(s) { return Math.round(s.cash - s.debt + 0.6 * s.assets + 2 * Math.max(0, monthlyNet(s))); }
function buy(s, id) {
  const u = UPS[id], lv = s.ups[id];
  const maxLv = u.max ? u.max - (u.base || 0) : u.costs.length;
  const have = id === 'trucks' ? lv - 1 : lv;
  if (have >= u.costs.length) return { err: 'max' };
  if (id === 'sales' && lv >= 2 * s.ups.office + 1) return { err: 'office' };
  const cost = u.costs[have];
  if (s.cash < cost) return { err: 'cash' };
  spendCap(s, cost); s.ups[id]++; s.assets += cost; emit(s, 'buy', { id });
  log(s, 'Upgraded: ' + u.name, 'good'); s.dirty = true; return { ok: true };
}
function townCheck(s, i) {
  const T = TOWNS[i];
  if (i !== s.ups.towns) return 'locked';
  if (s.rep < T.rep) return 'rep';
  if (s.ups.office < T.office) return 'office';
  if (s.cash < T.cost) return 'cash';
  return '';
}
function buyTown(s, i) {
  if (townCheck(s, i)) return { err: townCheck(s, i) };
  spendCap(s, TOWNS[i].cost); s.assets += TOWNS[i].cost; s.ups.towns++; emit(s, 'buy', { id: 'town' });
  log(s, 'Opened ' + TOWNS[i].name + '!', 'good');
  for (let k = 0; k < 3; k++) addLead(s, genLead(s, { town: i }));
  s.dirty = true; return { ok: true };
}
function runCampaign(s, id) {
  const C = CAMPAIGNS[id]; if (s.ups.office < C.min && id !== 'ads') { /* gating by office for big ones */ }
  if (s.camp[id] > s.day) return { err: 'active' };
  if (s.cash < C.cost) return { err: 'cash' };
  spendOp(s, C.cost); s.camp[id] = s.day + C.days; if (C.rep) s.rep = clamp(s.rep + C.rep, 1, 5);
  for (let k = 0; k < 2; k++) addLead(s, genLead(s));
  emit(s, 'spend', {}); log(s, C.name + ' campaign launched', 'good'); s.dirty = true; return { ok: true };
}
function checkGoals(s) {
  const out = [];
  for (const g of GOALS) if (!s.goals[g.id] && g.check(s)) { s.goals[g.id] = 1; out.push(g); } // 1 = ready to claim
  const v = value(s);
  MILES.forEach((m, i) => { if (!s.miles[i] && v >= m) s.miles[i] = 1; });
  if (!s.won && v >= 1000000) { s.won = true; emit(s, 'empire', {}); }
  return out;
}
function milestoneReward(i) { return Math.round(MILES[i] * 0.04); }
function claimGoal(s, id) {
  if (s.goals[id] !== 1) return 0;
  const g = GOALS.find(g => g.id === id); s.goals[id] = 2; earn(s, g.reward); s.stats.earned -= 0; emit(s, 'claim', { amt: g.reward }); return g.reward;
}
function claimMile(s, i) {
  if (s.miles[i] !== 1) return 0;
  const r = milestoneReward(i); s.miles[i] = 2; earn(s, r); emit(s, 'claim', { amt: r }); return r;
}
function claimable(s) { let n = 0; for (const k in s.goals) if (s.goals[k] === 1) n++; for (const k in s.miles) if (s.miles[k] === 1) n++; return n; }

/* ================= events ================= */
const EVENTS = {
  hail: {
    weight: s => (s.day > 8 ? ([0, 1, 2, 3, 4].includes(Math.floor(s.day / 30) % 12) ? 1.6 : 0.6) : 0),
    fire(s) {
      s.fx.hail = s.day + 8; s.stats.hails++;
      for (let i = 0; i < 4; i++) addLead(s, genLead(s, { kind: 'storm', town: Math.min(pickTown(s), 2) }));
      emit(s, 'hail', {});
      return { id: 'hail', data: {} };
    },
    view: () => ({ title: 'Hail Storm!', tone: 'storm', text: 'A hail storm just shredded roofs all over town. Storm-damage leads are pouring in for the next 8 days. Time to hustle!', choices: [{ label: 'Let\'s go!' }] }),
    choose() {},
  },
  rain: {
    weight: s => 1.0,
    fire(s) { const d = ri(s, 2, 3); s.fx.rain = s.day + d; for (const c of s.crews) c.morale = clamp(c.morale - 2, 0, 100); emit(s, 'rain', {}); log(s, 'Rain delay: no roofing for ' + d + ' days.', 'bad'); return null; },
  },
  price: {
    weight: s => (s.fx.price > s.day ? 0 : 0.8),
    fire(s) { return { id: 'price', data: { cost: Math.round(350 + Math.max(0, monthlyNet(s)) * 0.15) } }; },
    view: (s, d) => ({ title: 'Shingle Prices Spike', tone: 'bad', text: 'Your supplier says materials will cost 25% more for the next 20 days. Lock in today\'s price now, or ride it out?',
      choices: [{ label: 'Lock in prices', sub: '$' + d.cost.toLocaleString() }, { label: 'Ride it out', sub: 'Materials +25%' }] }),
    choose(s, d, i) { if (i === 0 && s.cash >= d.cost) { spendOp(s, d.cost); log(s, 'Locked in material prices.', 'good'); } else { s.priceMult = 1.25; s.fx.price = s.day + 20; log(s, 'Material prices up 25% for 20 days.', 'bad'); } },
  },
  injury: {
    weight: s => 0,
    fire(s, crew) { return { id: 'injury', data: { crew: crew.id, name: crew.name, med: 250 + Math.round(crew.wage * 5) } }; },
    view: (s, d) => ({ title: 'Injured Worker', tone: 'bad', text: d.name + ' had a bad fall. They will be out for 5 days. Cover the medical bills, or save the cash and hope nobody notices?',
      choices: [{ label: 'Pay medical bills', sub: '$' + d.med.toLocaleString() }, { label: 'Cut corners', sub: 'Morale drops. Lawsuit risk.' }] }),
    choose(s, d, i) {
      const c = s.crews.find(c => c.id === d.crew); if (!c) return;
      c.outUntil = s.day + 5;
      const j = s.jobs.find(j => j.crewId === c.id && j.status === 'active'); if (j) { j.crewId = null; j.status = 'active'; } c.jobId = null;
      if (i === 0 && s.cash >= d.med) { spendOp(s, d.med); c.morale = clamp(c.morale + 8, 0, 100); log(s, 'Paid medical bills. Crew respects you.', 'good'); }
      else { c.morale = clamp(c.morale - 22, 0, 100); if (rand(s) < 0.4) { const f = 1500 + Math.round(monthlyNet(s) * 0.1); spendOp(s, f); s.rep = clamp(s.rep - 0.15, 1, 5); log(s, 'Lawsuit settled for $' + f.toLocaleString(), 'bad'); } }
    },
  },
  adjuster: {
    weight: s => (s.stats.jobsDone >= 3 ? 0.7 : 0),
    fire(s) { return { id: 'adjuster', data: { cost: 150 + Math.round(Math.max(0, monthlyNet(s)) * 0.02) } }; },
    view: (s, d) => ({ title: 'Insurance Adjuster', tone: 'info', text: 'An adjuster is walking a neighborhood with a stack of claims. Buy him lunch and he will steer premium storm jobs your way.',
      choices: [{ label: 'Buy lunch', sub: '$' + d.cost + ' for 3 premium leads' }, { label: 'Just wave hello', sub: '1 lead' }] }),
    choose(s, d, i) {
      if (i === 0 && s.cash >= d.cost) { spendOp(s, d.cost); for (let k = 0; k < 3; k++) addLead(s, genLead(s, { kind: 'storm', hot: true, town: Math.min(pickTown(s), 2) })); log(s, 'Adjuster sent 3 premium leads.', 'good'); }
      else addLead(s, genLead(s, { kind: 'storm' }));
    },
  },
  quit: {
    weight: s => 0,
    fire(s, crew) { return { id: 'quit', data: { crew: crew.id, name: crew.name, raise: Math.round(crew.wage * 0.15 / 5) * 5, cost: crew.wage * 3 } }; },
    view: (s, d) => ({ title: d.name + ' Wants Out', tone: 'bad', text: 'They\'re burned out and talking to a competitor. Make a counter-offer with a raise and a bonus, or let them walk?',
      choices: [{ label: 'Counter-offer', sub: '+$' + d.raise + '/day, $' + d.cost + ' bonus' }, { label: 'Let them go', sub: 'Lose the crew' }] }),
    choose(s, d, i) {
      const c = s.crews.find(c => c.id === d.crew); if (!c) return;
      if (i === 0 && s.cash >= d.cost) { spendOp(s, d.cost); c.wage += d.raise; c.morale = 72; log(s, c.name + ' stayed.', 'good'); }
      else { fireCrew(s, c.id); log(s, c.name + ' quit.', 'bad'); }
    },
  },
  viral: {
    weight: s => 0,
    fire(s) { s.rep = clamp(s.rep + 0.25, 1, 5); s.fx.viral = s.day + 10; emit(s, 'viral', {}); return { id: 'viral', data: {} }; },
    view: () => ({ title: 'Review Goes Viral!', tone: 'good', text: 'A customer\'s glowing review is blowing up on social media. +0.25 stars and double the leads for 10 days!', choices: [{ label: 'Awesome!' }] }),
    choose() {},
  },
  claim: {
    weight: s => 0,
    fire(s, c) { return { id: 'claim', data: { cost: c.cost, name: c.name } }; },
    view: (s, d) => ({ title: 'Warranty Callback', tone: 'bad', text: d.name + ' says their new roof is leaking at a seam. Send a crew to fix it, or blow them off?',
      choices: [{ label: 'Fix it', sub: '$' + d.cost.toLocaleString() }, { label: 'Ignore it', sub: 'Lose 0.3 stars' }] }),
    choose(s, d, i) { if (i === 0 && s.cash >= d.cost) { spendOp(s, d.cost); s.rep = clamp(s.rep + 0.02, 1, 5); log(s, 'Fixed the callback. Customer happy.', 'good'); } else { s.rep = clamp(s.rep - 0.3, 1, 5); log(s, 'Ignored a callback. Bad review posted.', 'bad'); } },
  },
  neighbor: {
    weight: s => (s.stats.jobsDone >= 2 ? 0.5 : 0),
    fire(s) { addLead(s, genLead(s, { hot: true })); addLead(s, genLead(s, { hot: true })); log(s, 'Neighbors referred two hot leads!', 'good'); return null; },
  },
  undercut: {
    weight: s => (s.fx.undercut > s.day || s.stats.wins < 2 ? 0 : 0.5),
    fire(s) { s.fx.undercut = s.day + 14; return { id: 'undercut', data: {} }; },
    view: () => ({ title: 'Big Box Price War', tone: 'bad', text: 'Big Box Roofing is slashing prices across town. Your bids are less competitive for the next 14 days. Stay sharp.', choices: [{ label: 'We can handle it' }] }),
    choose() {},
  },
  loan: {
    weight: s => 0,
    fire(s) { return { id: 'loan', data: {} }; },
    view: () => ({ title: 'Bank Bridge Loan', tone: 'info', text: 'Your account is in the red. The bank will advance $3,000 now. You repay $3,600, taken from payroll over the next few weeks.', choices: [{ label: 'Take the loan', sub: '+$3,000' }, { label: 'No thanks' }] }),
    choose(s, d, i) { if (i === 0) { s.cash += 3000; s.debt += 3600; log(s, 'Took a bridge loan.', ''); } },
  },
};
function pushEvent(s, ev) { if (ev) { s.pending.push(ev); s.dirty = true; } }
function fireRandomEvent(s) {
  const ids = Object.keys(EVENTS).filter(id => EVENTS[id].weight(s) > 0);
  let tot = ids.reduce((a, id) => a + EVENTS[id].weight(s), 0), x = rand(s) * tot, pickId = ids[0];
  for (const id of ids) { x -= EVENTS[id].weight(s); if (x <= 0) { pickId = id; break; } }
  pushEvent(s, EVENTS[pickId].fire(s));
  s.lastEvent = s.day;
}
function eventView(s, ev) { return EVENTS[ev.id].view(s, ev.data); }
function resolveEvent(s, i) {
  const ev = s.pending.shift(); if (!ev) return;
  EVENTS[ev.id].choose(s, ev.data, i); s.dirty = true;
}
function forceEvent(s, id, arg) { pushEvent(s, EVENTS[id].fire(s, arg)); }

/* ================= simulation ================= */
function completeJob(s, j, crew) {
  const K = KINDS[j.kind];
  const Q = clamp(effQuality(s, crew, j.kind) + rr(s, -8, 8), 5, 100);
  const late = s.day > j.due;
  let pay = j.price - j.deposit;
  let bonus = 0;
  if (!late && Q >= 70) bonus = Math.round(j.price * 0.05);
  if (late) bonus = -Math.round(j.price * 0.10);
  earn(s, pay + bonus);
  const profit = j.price + bonus - j.mats - j.labor;
  j.status = 'done'; j.Q = Math.round(Q); j.profit = profit; j.finished = s.day; j.bonus = bonus;
  crew.jobId = null; crew.morale = clamp(crew.morale + (late ? 1 : 5) + (Q >= 80 ? 3 : 0), 0, 100); crew.idle = 0;
  s.stats.jobsDone++; if (Q >= 90) s.stats.perfect++; s.stats.bestJob = Math.max(s.stats.bestJob, j.price);
  let d = Q >= 85 ? 0.14 : Q >= 70 ? 0.08 : Q >= 55 ? 0.03 : Q >= 40 ? -0.04 : -0.12;
  d += late ? -0.06 : 0.03;
  if (d > 0) d *= (5.4 - s.rep) / 3.4;
  s.rep = clamp(s.rep + d, 1, 5);
  const stars = Q >= 85 ? 5 : Q >= 70 ? 4 : Q >= 55 ? 3 : Q >= 40 ? 2 : 1;
  s.recent.unshift({ id: j.id, name: K.label, cust: j.cust, pay: pay + j.deposit + bonus, profit, stars, late, day: s.day });
  if (s.recent.length > 8) s.recent.pop();
  log(s, 'Finished ' + K.label + ' for ' + j.cust + '. ' + (profit >= 0 ? '+' : '-') + '$' + Math.abs(profit).toLocaleString() + ' profit, ' + stars + ' star review.', profit >= 0 ? 'good' : 'bad');
  emit(s, 'done', { job: j.id, amt: pay + bonus, profit, town: j.town, lot: j.lot });
  // callbacks & viral
  const cb = clamp((72 - Q) / 100, 0, 0.5);
  if (rand(s) < cb) s.claims.push({ day: s.day + ri(s, 4, 10), cost: Math.round(j.price * rr(s, 0.1, 0.18)), name: j.cust });
  if (Q >= 85 && rand(s) < 0.15 && !(s.fx.viral > s.day)) pushEvent(s, EVENTS.viral.fire(s));
  const gone = s.jobs.indexOf(j); // keep done jobs briefly for animation
  s.dirty = true;
}
function advanceWork(s, dt) {
  if (s.fx.rain > s.day) return;
  for (const j of s.jobs) {
    if (j.status !== 'active' || !j.crewId) continue;
    const c = s.crews.find(c => c.id === j.crewId); if (!c) { j.crewId = null; continue; }
    if (c.outUntil > s.day) continue;
    j.progress += effSpeed(s, c, j.kind) * dt;
    j.labor += c.wage * dt;
    if (j.progress >= j.work) { j.progress = j.work; completeJob(s, j, c); }
  }
  // purge old completed
  s.jobs = s.jobs.filter(j => j.status !== 'done' || s.day - j.finished < 2);
}
function dayTick(s) {
  s.day++;
  const net = s.dayNet; s.net.push(net); if (s.net.length > 30) s.net.shift(); s.dayNet = 0;
  s.leads = s.leads.filter(l => l.exp > s.day);
  for (const k in s.fx) if (s.fx[k] <= s.day) { delete s.fx[k]; if (k === 'price') s.priceMult = 1; }
  if (!(s.fx.price > s.day)) s.priceMult = 1;
  spawnLeads(s);
  if (s.cash < 300 && s.day % 10 === 0 && !s.jobs.some(j => j.status === 'active')) { earn(s, 250); log(s, 'Odd jobs around town kept the lights on (+$250).', ''); }
  // jobs: patience
  for (const j of s.jobs) {
    if (j.status === 'sched' && s.day > j.startBy) {
      j.status = 'done'; j.cancelled = true; j.finished = s.day; s.cash -= j.deposit; s.dayNet -= j.deposit;
      s.rep = clamp(s.rep - 0.15, 1, 5); log(s, j.cust + ' canceled. You took too long to start. Deposit refunded.', 'bad'); emit(s, 'cancel', {});
    }
  }
  s.jobs = s.jobs.filter(j => !(j.cancelled && s.day - j.finished >= 1));
  // crews
  const raining = s.fx.rain > s.day;
  for (const c of s.crews) {
    if (c.outUntil > s.day) continue;
    if (!c.jobId) { c.idle++; if (c.idle > 3) c.morale = clamp(c.morale - 0.7, 0, 100); }
    else { c.morale = clamp(c.morale + 0.25 + 0.1 * s.ups.safety, 0, 100); }
    const job = s.jobs.find(j => j.id === c.jobId);
    if (job && s.day > job.due) c.morale = clamp(c.morale - 0.6, 0, 100);
    if (raining) c.morale = clamp(c.morale - 0.3, 0, 100);
  }
  autoAssign(s);
  autoBidAll(s);
  // payday
  if (s.day % 7 === 6) payroll(s);
  // random crew events
  if (s.day > 12) for (const c of s.crews) {
    if (c.outUntil > s.day) continue;
    if (s.pending.length === 0) {
      if (c.morale < 28 && rand(s) < 0.06 && s.crews.length > 1) { pushEvent(s, EVENTS.quit.fire(s, c)); break; }
      if (c.jobId && rand(s) < 0.006 * (1 - 0.2 * s.ups.safety)) { pushEvent(s, EVENTS.injury.fire(s, c)); break; }
    }
  }
  // claims
  for (let i = s.claims.length - 1; i >= 0; i--) if (s.claims[i].day <= s.day && s.pending.length < 2) { pushEvent(s, EVENTS.claim.fire(s, s.claims[i])); s.claims.splice(i, 1); }
  // loan
  if (s.cash < -800 && !s.debt && s.pending.length === 0 && s.day > 20) pushEvent(s, EVENTS.loan.fire(s));
  // random events
  if (s.day >= s.nextEvent && s.pending.length === 0) {
    if (s.day === s.nextEvent && s.stats.hails === 0 && s.day <= 13 && !s.firstEventDone) { s.firstEventDone = true; pushEvent(s, EVENTS.hail.fire(s)); }
    else fireRandomEvent(s);
    s.nextEvent = s.day + ri(s, 7, 12);
  }
  if (s.day - s.candDay >= 7) refreshCandidates(s);
  if (s.day % 30 === 0) emit(s, 'month', { net: monthlyNet(s), month: dateOf(s.day - 1).m });
  checkGoals(s);
  s.dirty = true;
}
function payroll(s) {
  let tot = 0;
  for (const c of s.crews) tot += c.wage * 7;
  tot += s.ups.sales * UPS.sales.salary * 7;
  if (s.debt > 0) { const r = Math.min(s.debt, 600); s.debt -= r; tot += r; }
  spendOp(s, tot);
  // debt repayment isn't really an operating cost but keeps things simple
  emit(s, 'payday', { amt: tot });
  if (s.cash < 0) { for (const c of s.crews) c.morale = clamp(c.morale - 5, 0, 100); log(s, 'Payroll came up short. Crews are upset.', 'bad'); }
}
function advance(s, dt) {
  // dt in days; sub-step so daily ticks fire exactly
  let left = dt;
  while (left > 1e-9) {
    const step = Math.min(left, 1 - s.t, 0.25);
    advanceWork(s, step);
    s.t += step; left -= step;
    if (s.t >= 1 - 1e-9) { s.t = 0; dayTick(s); if (s.pending.length) break; }
  }
}
function offlineEarn(s, secs) {
  const hrs = Math.min(6, secs / 3600); if (hrs < 0.03) return 0;
  const daily = Math.max(0, monthlyNet(s)) / 30;
  const per = s.crews.length * 25 * (0.6 + s.rep / 4) * (1 + 0.25 * s.ups.office) + 0.5 * daily;
  return Math.round(hrs * per);
}

root.RRE = { KINDS, SPECS, TOWNS, UPS, CAMPAIGNS, GOALS, MILES, MONTHS, newState, advance, dayTick, genLead, winChance, suggestBid, submitBid, costEstimate, effSpeed, effQuality,
  hire, fireCrew, bonusCrew, assign, autoAssign, buy, buyTown, townCheck, runCampaign, checkGoals, claimGoal, claimMile, claimable, milestoneReward,
  eventView, resolveEvent, forceEvent, value, monthlyNet, offlineEarn, dateOf, leadRate, boardCap, freeLots, refreshCandidates, userEff, SD, matMult, pushEvent, EVENTS, log };
if (typeof module !== 'undefined') module.exports = root.RRE;
})(typeof window !== 'undefined' ? window : globalThis);
