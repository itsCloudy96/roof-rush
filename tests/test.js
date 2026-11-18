const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2];
let server, base = URL_;
async function serve() {
  if (URL_) return;
  server = http.createServer((q, r) => { let f = path.join(__dirname, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); } }); }).listen(8123);
  base = 'http://localhost:8123/';
}
(async () => {
  await serve();
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await page.goto(base); await page.waitForTimeout(500);
  await page.screenshot({ path: 'shot-title.png' });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const swipe = async (pts) => { await touch('touchStart', ...pts[0]); for (const p of pts.slice(1)) { await touch('touchMove', ...p); await page.waitForTimeout(12); } await touch('touchEnd'); };
  const tap = async (x, y) => { await touch('touchStart', x, y); await page.waitForTimeout(30); await touch('touchEnd'); };
  const ev = f => page.evaluate(f);
  // no horizontal scroll
  console.log('scrollW', await ev(() => [document.documentElement.scrollWidth, innerWidth, document.body.scrollWidth]));
  await page.tap('#btnPlay'); await page.waitForTimeout(200);
  await page.screenshot({ path: 'shot-board.png' });
  await page.tap('[data-job="0"]'); await page.waitForTimeout(300);
  console.log('mode', await ev(() => RR.mode));
  await page.waitForFunction(() => RR.g && RR.g.phase === 'tear', null, { timeout: 5000 });
  const L = await ev(() => ({ ...RR.L }));
  // tear off: zigzag swipes
  const rowsPts = [];
  for (let r = 0; r < L.rows; r++) {
    const y = L.eave - (r + 0.5) * L.rowH; const pts = [];
    for (let i = 0; i <= 12; i++) { const x = r % 2 ? L.roofX + L.roofW - (i / 12) * L.roofW : L.roofX + (i / 12) * L.roofW; pts.push([x * 390 / 400, y * 390 / 400]); }
    rowsPts.push(pts);
  }
  // convert logical coords -> css px (W=400 maps to 390 wide; H scaled the same)
  const k = 390 / 400;
  let shotDone = false;
  for (let pass = 0; pass < 6 && (await ev(() => RR.g.phase)) === 'tear'; pass++) for (const pts of rowsPts) { await swipe(pts); if (!shotDone && (await ev(() => RR.g.remHp / RR.g.totalHp)) < 0.6) { await page.screenshot({ path: 'shot-tear.png' }); shotDone = true; } }
  console.log('after tear', await ev(() => RR.g.phase), await ev(() => RR.g.left.toFixed(1)));
  await page.waitForTimeout(200);
  for (let pass = 0; pass < 4 && (await ev(() => RR.g.phase)) === 'under'; pass++) for (const pts of rowsPts) await swipe(pts);
  console.log('after under', await ev(() => RR.g.phase));
  await page.screenshot({ path: 'shot-under.png' });
  await page.waitForTimeout(2000);
  // shingles
  let n = 0, shot2 = false;
  while ((await ev(() => RR.g.phase)) === 'shingle' && n < 40) {
    // wait for near-zero offset
    const t0 = Date.now();
    while (Date.now() - t0 < 8000) {
      const off = await ev(() => RR.stripOffset()), tol = await ev(() => RR.perfectTol());
      if (Math.abs(off) < tol * 0.5 + (n % 3 === 2 ? 14 : 0)) break;
      await page.waitForTimeout(8);
    }
    await tap(200 * k, 300); n++;
    await page.waitForTimeout(260);
    if (!shot2 && n === Math.ceil(L.rows / 2)) { await page.screenshot({ path: 'shot-shingle.png' }); shot2 = true; }
  }
  console.log('rows placed', n);
  await page.waitForSelector('#result:not(.hidden)', { timeout: 6000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'shot-result.png' });
  console.log('result', await ev(() => document.querySelector('#resTitle').textContent), await ev(() => document.querySelector('#resTable').innerText.replace(/\s+/g, ' ')));
  console.log('save', JSON.stringify(await ev(() => RR.save())));
  console.log('scrollW end', await ev(() => [document.documentElement.scrollWidth, innerWidth]));
  console.log('ERRORS', errs);
  await b.close(); if (server) server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
