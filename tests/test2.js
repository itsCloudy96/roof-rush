// level-6 bot run + mouse + fail + garage checks
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');
const server = http.createServer((q, r) => { let f = path.join(__dirname, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); } }); }).listen(8124);
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); }); page.on('pageerror', e => errs.push('PE ' + e.message));
  await page.addInitScript(() => { if (!localStorage.getItem('roofrush.v1')) localStorage.setItem('roofrush.v1', JSON.stringify({ money: 1000, up: { tool: 0, nail: 0, crew: 0, radio: 0 }, unlocked: 6, stars: [], best: [], sound: false })); });
  await page.goto('http://localhost:8124/'); await page.waitForTimeout(300);
  const ev = f => page.evaluate(f);
  // garage buy
  await page.click('#btnPlay'); await page.click('#tabGarage'); await page.screenshot({ path: 'shot-garage.png' });
  await page.click('[data-buy="crew"]'); await page.click('[data-buy="tool"]');
  console.log('after buy', JSON.stringify(await ev(() => RR.save().up)), await ev(() => RR.save().money));
  await page.click('#tabJobs'); await page.click('[data-job="5"]');
  await page.waitForFunction(() => RR.g && RR.g.phase === 'tear');
  const L = await ev(() => ({ ...RR.L })); const k = 390 / 400;
  await page.screenshot({ path: 'shot-l6.png' });
  const pts = []; for (let r = 0; r < L.rows; r++) { const y = (L.eave - (r + 0.5) * L.rowH) * k; for (let i = 0; i <= 14; i++) pts.push([(r % 2 ? L.roofX + L.roofW - i / 14 * L.roofW : L.roofX + i / 14 * L.roofW) * k, y]); }
  const sweep = async () => { await page.mouse.move(...pts[0]); await page.mouse.down(); for (const p of pts) { await page.mouse.move(...p); await page.waitForTimeout(10); } await page.mouse.up(); };
  const t0 = Date.now();
  while ((await ev(() => RR.g.phase)) === 'tear') await sweep();
  console.log('tear secs', ((Date.now() - t0) / 1000).toFixed(1), 'left', await ev(() => RR.g.left.toFixed(1)), 'crew', await ev(() => RR.g.workers.length));
  await page.screenshot({ path: 'shot-l6-crew.png' });
  while ((await ev(() => RR.g.phase)) === 'under') await sweep();
  console.log('under done left', await ev(() => RR.g.left.toFixed(1)));
  await page.waitForTimeout(1900);
  let n = 0;
  while ((await ev(() => RR.g.phase)) === 'shingle') {
    const t1 = Date.now();
    while (Date.now() - t1 < 8000) { const off = await ev(() => RR.stripOffset()), tol = await ev(() => RR.perfectTol()); if (Math.abs(off) < tol * 0.6) break; await page.waitForTimeout(6); }
    await page.mouse.click(200, 400); n++; await page.waitForTimeout(250);
    if (n === 4) await page.screenshot({ path: 'shot-l6-shingle.png' });
  }
  await page.waitForSelector('#result:not(.hidden)', { timeout: 6000 }); await page.waitForTimeout(1200);
  console.log('L6', await ev(() => document.querySelector('#resTable').innerText.replace(/\s+/g, ' ')), 'left', await ev(() => RR.g.left.toFixed(1)));
  // fail path: retry and idle to storm
  await page.click('#btnRetry'); await page.waitForFunction(() => RR.g && RR.g.phase === 'tear');
  await ev(() => { RR.g.left = 1.5; }); await page.waitForTimeout(500); await page.screenshot({ path: 'shot-storm.png' });
  await page.waitForSelector('#result:not(.hidden)', { timeout: 8000 }); await page.waitForTimeout(500);
  console.log('fail', await ev(() => document.querySelector('#resTitle').textContent), await ev(() => document.querySelector('#resTable').innerText.replace(/\s+/g, ' ')));
  await page.screenshot({ path: 'shot-fail.png' });
  console.log('ERRORS', errs); await b.close(); server.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
