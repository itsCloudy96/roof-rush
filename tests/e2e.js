// Playwright end-to-end test on a 390x844 phone: tutorial -> win a bid -> complete a job -> hire -> event -> busy town screenshot
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2];
const OUT = process.argv[3] || path.join(__dirname, '..');
let server, base = URL_;
if (!URL_) {
  const root = path.join(__dirname, '..');
  server = http.createServer((q, r) => { const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); } }); }).listen(8125);
  base = 'http://localhost:8125/';
}
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  const ev = f => page.evaluate(f);
  const settle = async () => { for (let i = 0; i < 6 && await page.isVisible('#modal'); i++) { const b = await page.$('#modal [data-act=evchoice],#modal [data-act=close],#modal [data-act=offok],#modal [data-act=empireok]'); if (b) { const t = await ev(() => document.querySelector('#modal h2') ? document.querySelector('#modal h2').textContent : ''); if (await page.isVisible('[data-act=evchoice]')) console.log('  handled random event: ' + t); await b.tap(); } await page.waitForTimeout(350); } };
  const shot = n => page.screenshot({ path: path.join(OUT, n) });
  await page.goto(base); await page.waitForTimeout(600);
  ok(await ev(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll on load');
  ok(await page.isVisible('#coach'), 'tutorial coach shown on first launch');
  await shot('shot-0-welcome.png');
  const t0 = Date.now();
  await page.tap('[data-act=tutnext]'); await page.waitForTimeout(300);
  await page.tap('#firstLead'); await page.waitForSelector('#bidslider');
  await shot('shot-1-bid.png');
  await page.tap('#btnSuggest'); await page.tap('#btnSubmit');
  await page.waitForFunction(() => document.querySelector('#modal').innerText.includes('YOU WON'), null, { timeout: 5000 });
  const firstWinSec = (Date.now() - t0) / 1000;
  ok(firstWinSec < 30, 'first bid won ' + firstWinSec.toFixed(1) + 's after the tutorial started (<30s)');
  await shot('shot-2-won.png');
  await page.tap('[data-act=close]'); await page.waitForTimeout(300);
  ok(await ev(() => RR.S.jobs.length === 1 && RR.S.stats.wins === 1), 'job scheduled after win');
  await ev(() => RR.setSpeed(4));
  await page.tap('[data-act=tutnext]');
  let handledEvent = null;
  for (let i = 0; i < 300 && !(await ev(() => RR.S.stats.jobsDone >= 1)); i++) {
    if (await page.isVisible('[data-act=evchoice]')) { handledEvent = await ev(() => document.querySelector('#modal h2').textContent); await shot('shot-event-natural.png'); await page.tap('[data-act=evchoice]'); }
    await page.waitForTimeout(200);
  }
  if (handledEvent) ok(true, 'natural random event handled during first job: "' + handledEvent + '"');
  ok(await ev(() => RR.S.stats.jobsDone >= 1), 'first job completed');
  ok(true, 'first job completed (cash ' + (await ev(() => Math.round(RR.S.cash))) + ')');
  await page.waitForTimeout(400); await shot('shot-3-done.png');
  // tutorial: crews tab -> truck -> hire
  await page.tap('[data-tab=crews]'); await page.waitForTimeout(300);
  await ev(() => RR.setSpeed(1));
  await page.tap('#truckBtn'); await page.waitForTimeout(200);
  await page.tap('#firstHire'); await page.waitForTimeout(300);
  ok(await ev(() => RR.S.crews.length === 2), 'hired a second crew');
  const hireSec = (Date.now() - t0) / 1000; console.log('  first hire at ' + hireSec.toFixed(0) + 's of play');
  await page.tap('[data-act=tutnext]'); await page.waitForTimeout(200);
  ok(await ev(() => RR.S.tutDone === true), 'tutorial finished');
  // event handling
  await ev(() => RR.forceEvent('adjuster')); await page.waitForSelector('[data-act=evchoice]', { timeout: 3000 });
  await shot('shot-4-event.png');
  const leadsBefore = await ev(() => RR.S.leads.length);
  await page.tap('[data-act=evchoice][data-i="0"]'); await page.waitForTimeout(300);
  ok(await ev(() => RR.S.pending.length === 0) && !(await page.isVisible('#modal')), 'event resolved and modal closed');
  ok(await ev(() => RR.S.leads.length) > leadsBefore, 'adjuster event added leads');
  await ev(() => RR.forceEvent('hail')); await page.waitForSelector('[data-act=evchoice]'); await page.tap('[data-act=evchoice]');
  ok(await ev(() => RR.S.fx.hail > RR.S.day), 'hail storm effect active');
  // fill the town with jobs via quick bids
  await page.tap('[data-tab=leads]'); await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    if (!(await page.$('[data-act=quick]:not([disabled])'))) break;
    await page.locator('[data-act=quick]:not([disabled])').first().tap(); await page.waitForSelector('[data-act=close]', { timeout: 5000 }); await page.tap('[data-act=close]'); await page.waitForTimeout(250);
  }
  await ev(() => RR.setSpeed(4));
  for (let i = 0; i < 10; i++) { await page.waitForTimeout(500); await settle(); }
  await ev(() => RR.setSpeed(2)); await settle();
  // tab sweep for overflow
  for (const t of ['leads', 'jobs', 'crews', 'office', 'goals']) {
    await settle(); await page.tap('[data-tab=' + t + ']'); await page.waitForTimeout(250);
    const o = await ev(() => ({ pw: document.querySelector('#panel').scrollWidth, pc: document.querySelector('#panel').clientWidth, dw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(o.pw <= o.pc + 1 && o.dw <= o.iw, 'no horizontal overflow on ' + t + ' tab');
    await shot('shot-tab-' + t + '.png');
  }
  await settle(); await page.tap('[data-tab=leads]'); await page.waitForTimeout(300);
  await shot('screenshot.png');
  // persistence
  const cash = await ev(() => Math.round(RR.S.cash)), day = await ev(() => RR.S.day);
  await page.reload(); await page.waitForTimeout(800);
  ok(await page.evaluate(d => RR.S.day >= d - 1 && RR.S.crews.length === 2, day), 'progress saved and restored after reload (day ' + day + ')');
  ok(!(await page.isVisible('#coach')), 'tutorial not repeated after reload');
  // offline earnings: pretend we were away 3 hours (write storage from this page, open a fresh page)
  await ev(() => { RR.S.saved = Date.now() - 3 * 3600e3; localStorage.setItem('roofrush.tycoon.v1', JSON.stringify(RR.S)); });
  const p2 = await ctx.newPage(); await p2.goto(base); await p2.waitForTimeout(800);
  const welcome = await p2.evaluate(() => document.querySelector('#modal').innerText);
  ok(/Welcome back/.test(welcome), 'offline earnings modal after 3h away: ' + welcome.replace(/\s+/g, ' ').slice(0, 90));
  await p2.close();
  const st = await ev(() => ({ cash: Math.round(RR.S.cash), val: RR.E.value(RR.S), jobs: RR.S.stats.jobsDone, day: RR.S.day, rep: +RR.S.rep.toFixed(2) }));
  console.log('  state', JSON.stringify(st));
  ok(errs.length === 0, 'no console errors/warnings ' + (errs.length ? JSON.stringify(errs.slice(0, 5)) : ''));
  await b.close(); if (server) server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
