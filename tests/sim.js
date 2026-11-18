// Economy simulation: plays scripted strategies against the real engine and prints a monthly table.
const E = require('../engine.js');
function play(strategy, days, seed, quiet) {
  const s = E.newState(seed);
  const rows = []; let hired = 0;
  for (let d = 0; d < days; d++) {
    E.advance(s, 1);
    while (s.pending.length) E.resolveEvent(s, strategy.eventChoice(s));
    strategy.act(s);
    E.checkGoals(s);
    if (strategy.claim) { for (const g of E.GOALS) E.claimGoal(s, g.id); E.MILES.forEach((m, i) => E.claimMile(s, i)); }
    if ((d + 1) % 30 === 0) rows.push({ mo: (d + 1) / 30, cash: Math.round(s.cash), val: E.value(s), rep: +s.rep.toFixed(2), crews: s.crews.length, jobs: s.stats.jobsDone, bids: s.stats.bids, wins: s.stats.wins, towns: s.ups.towns, sales: s.ups.sales, mnet: Math.round(E.monthlyNet(s)) });
  }
  if (!quiet) { console.log('--- ' + strategy.name + ' seed ' + seed); console.table(rows.filter(r => r.mo <= 6 || r.mo % 3 === 0)); }
  return { s, rows };
}
const smart = {
  name: 'smart-investor', claim: true,
  eventChoice: s => 0,
  act(s) {
    // capacity-aware bidding: keep at most crews+1 jobs in the pipeline, best profit-per-crew-day first
    let pending = s.jobs.filter(j => j.status !== 'done').length;
    const scored = s.leads.filter(L => s.rep >= L.minRep && E.freeLots(s, L.town) > 0).map(L => {
      const c = E.costEstimate(s, L), bid = E.suggestBid(s, L);
      return { L, bid, cost: c.total, score: (bid - c.total) / Math.max(1, c.days) };
    }).filter(x => x.bid >= x.cost * 1.12).sort((a, b) => b.score - a.score);
    for (const x of scored) { if (pending >= s.crews.length + 1) break; const r = E.submitBid(s, x.L.id, x.bid); if (r.win) pending++; }
    // invest: priority list with reserve for payroll
    const payroll = s.crews.reduce((a, c) => a + c.wage * 7, 0) + s.ups.sales * 420;
    const reserve = payroll * 2 + 1200;
    const tryBuy = id => { const u = E.UPS[id]; const have = id === 'trucks' ? s.ups[id] - 1 : s.ups[id]; if (have >= u.costs.length) return false; if (s.cash - u.costs[have] < reserve) return false; return E.buy(s, id).ok; };
    for (let k = 0; k < 4; k++) {
      // hire if truck free
      const demand = s.jobs.filter(j => j.status === 'sched').length + s.leads.filter(L => s.rep >= L.minRep).length / 3;
      if (s.crews.length < s.ups.trucks && demand >= 1 && s.crews.every(c => c.jobId)) {
        const c = s.candidates.slice().sort((a, b) => (b.speed * 10 + b.quality - b.wage / 20) - (a.speed * 10 + a.quality - a.wage / 20))[0];
        if (c && s.cash - c.fee > reserve * 0.8) { E.hire(s, c.id); continue; }
      }
      // town
      for (let t = 1; t < 4; t++) if (E.townCheck(s, t) === '' && s.cash - E.TOWNS[t].cost > reserve) { E.buyTown(s, t); }
      const busy = s.jobs.filter(j => j.status !== 'done').length;
      const need = s.crews.length >= s.ups.trucks && demand >= 1.5 && s.crews.every(c => c.jobId);
      if (need && tryBuy('trucks')) continue;
      if (s.ups.office < 3 && (s.ups.sales >= 1 + 2 * s.ups.office - 0 || s.rep > 2.4 + s.ups.office) && tryBuy('office')) continue;
      if (tryBuy('sales')) continue;
      if (tryBuy('tools')) continue;
      if (tryBuy('train') && s.ups.train < 2) continue;
      if (tryBuy('dump')) continue;
      if (tryBuy('safety')) continue;
      break;
    }
    // marketing when idle crews / few leads
    const idle = s.crews.filter(c => !c.jobId).length;
    if (idle > 0 && s.leads.length < 5) for (const id of ['signs', 'flyers', 'ads', 'radio', 'tv']) { if (s.cash > E.CAMPAIGNS[id].cost * 3 + reserve && !(s.camp[id] > s.day)) { E.runCampaign(s, id); } }
    s.autoBid = 0;
  },
};
const lazy = { name: 'lazy-fair-price', eventChoice: () => 1, act(s) { for (const L of s.leads.slice()) if (s.rep >= L.minRep && E.freeLots(s, L.town) > 0) E.submitBid(s, L.id, L.price); } };
const lowball = { name: 'lowball-everything', eventChoice: () => 1, act(s) { for (const L of s.leads.slice()) if (s.rep >= L.minRep && E.freeLots(s, L.town) > 0) E.submitBid(s, L.id, L.price * 0.6); } };
const greedy = { name: 'greedy-high-bids', eventChoice: () => 1, act(s) { for (const L of s.leads.slice()) if (s.rep >= L.minRep && E.freeLots(s, L.town) > 0) E.submitBid(s, L.id, L.price * 1.25); } };
const days = +process.argv[2] || 720;
module.exports = { play, smart, lazy, lowball, greedy };
if (require.main !== module) return;
const seeds = [1, 2, 3, 4, 5];
const out = {};
for (const st of [smart, lazy, lowball, greedy]) {
  out[st.name] = seeds.map(sd => play(st, days, sd, true));
}
console.log('Single run detail:'); play(smart, days, 7);
console.log('\nSummary over ' + seeds.length + ' seeds @ ' + days + ' days (' + (days / 30) + ' months)');
console.table(Object.entries(out).map(([n, rs]) => {
  const f = k => rs.map(r => r.rows[r.rows.length - 1][k]);
  const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const m = (mo, k) => avg(rs.map(r => (r.rows[mo - 1] || {})[k] || 0));
  return { strategy: n, 'val@3mo': m(3, 'val'), 'val@6mo': m(6, 'val'), 'val@12mo': m(12, 'val'), ['val@' + days / 30 + 'mo']: avg(f('val')), crews: avg(f('crews')), rep: +(f('rep').reduce((a, b) => a + b, 0) / seeds.length).toFixed(2), jobs: avg(f('jobs')), winRate: +(avg(f('wins')) / Math.max(1, avg(f('bids')))).toFixed(2) };
}));
// first-5-minute check for smart strategy: day by day
const r = play(smart, 5, 7, true);
console.log('\nSanity: after 5 days cash', Math.round(r.s.cash), 'value', E.value(r.s));
// Find first win / first hire day for smart strategy
const s2 = E.newState(7); let firstWin = null, firstHire = null;
for (let d = 0; d < 300 && !(firstWin && firstHire); d++) { E.advance(s2, 1); while (s2.pending.length) E.resolveEvent(s2, 0); smart.act(s2); if (firstWin == null && s2.stats.wins) firstWin = d + 1; if (firstHire == null && s2.crews.length > 1) firstHire = d + 1; }
console.log('smart bot: first win by day', firstWin, ', first hire by day', firstHire, '(day = 2s at 1x, 1s at 2x)');
