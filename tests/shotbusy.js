// Builds a mid-game company by letting the economy-test bot play ~1 year with the real engine, then screenshots it in the phone UI.
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const { play, smart } = require('./sim.js');
const root = path.join(__dirname, '..');
const DAYS = +process.argv[2] || 400;
let best = null;
for (let seed = 1; seed <= 12; seed++) {
  const r = play(smart, DAYS, seed, true), s = r.s;
  const act = s.jobs.filter(j => j.status !== 'done').length;
  const score = s.ups.towns * 10 + act * 3 + s.crews.length;
  if (!best || score > best.score) best = { s, score, seed };
}
const s = best.s; s.tutDone = true; s.tut = 99; s.speed = 1; s.pending = []; s.saved = Date.now();
console.log('seed', best.seed, 'day', s.day, 'towns', s.ups.towns, 'crews', s.crews.length, 'jobs', s.jobs.length, 'cash', Math.round(s.cash));
const server = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); } }); }).listen(8126);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); page.on('pageerror', e => errs.push(e.message));
  await page.addInitScript(st => localStorage.setItem('roofrush.tycoon.v1', JSON.stringify(st)), s);
  await page.goto('http://localhost:8126/'); await page.waitForTimeout(500);
  if (await page.isVisible('#modal')) { const bt = await page.$('#modal [data-act]'); if (bt) await bt.tap(); }
  await page.evaluate(() => RR.setSpeed(0)); await page.waitForTimeout(500);
  for (let i = 0; i < 3 && await page.isVisible('#modal'); i++) { const bt = await page.$('#modal [data-act]'); if (bt) await bt.tap(); await page.waitForTimeout(300); }
  await page.tap('[data-tab=jobs]'); await page.evaluate(() => RR.setSpeed(1)); await page.waitForTimeout(600); await page.evaluate(() => RR.setSpeed(0)); await page.waitForTimeout(3600);
  await page.screenshot({ path: path.join(root, process.argv[3] || 'screenshot.png') });
  console.log('errors', errs);
  await b.close(); server.close();
})();
