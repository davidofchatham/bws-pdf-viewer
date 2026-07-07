'use strict';
/**
 * Automated verification for tasks T028 (two viewers, independent layout)
 * and T029 (error state for invalid PDF URL).
 *
 * Usage (from repo root):
 *   npm i -D playwright-core        # once; drives installed system Chrome, no browser download
 *   npx http-server -p 8123 -c-1 &  # serve repo root
 *   node test/verify-t028-t029.js
 *
 * Exits 0 when all checks pass; screenshots written next to this script.
 */
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8123';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const fail = (m) => results.push(['FAIL', m]);
  const pass = (m) => results.push(['PASS', m]);

  // ---------- T028: two viewers, independent layout ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.location().url.includes('favicon.ico')) {
        errors.push('console.error: ' + msg.text() + ' @ ' + msg.location().url);
      }
    });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon.ico')) errors.push(`HTTP ${r.status()}: ${r.url()}`); });

    await page.goto(BASE + '/harness-t028.html', { waitUntil: 'load' });
    try {
      await page.waitForSelector('#bws-pdf-a canvas', { timeout: 15000 });
      await page.waitForSelector('#bws-pdf-b canvas', { timeout: 15000 });
      pass('T028: both viewers rendered a canvas');
    } catch (e) {
      fail('T028: canvas missing: ' + e.message);
    }
    await page.waitForTimeout(1500); // let both settle

    const info = await page.evaluate(() => {
      const grab = (id) => {
        const c = document.querySelector('#' + id + ' canvas');
        const controls = document.querySelector('#' + id + ' .bws-pdf-viewer-controls');
        const loading = document.querySelector('#' + id + ' .bws-pdf-viewer-loading');
        return {
          canvas: c ? { w: c.width, h: c.height, cssW: c.clientWidth } : null,
          hasControls: !!controls,
          controlButtons: controls ? controls.querySelectorAll('button').length : 0,
          counterText: controls?.querySelector('.bws-pdf-page-info, .bws-pdf-counter, [class*="page"]')?.textContent
            ?? controls?.textContent ?? null,
          loadingGone: !loading,
        };
      };
      return { a: grab('bws-pdf-a'), b: grab('bws-pdf-b') };
    });

    if (info.a.canvas && info.b.canvas) {
      const ra = info.a.canvas.w / info.a.canvas.h;
      const rb = info.b.canvas.w / info.b.canvas.h;
      if (ra > rb * 1.4) pass(`T028: layouts independent (wide ratio ${ra.toFixed(2)} vs narrow ${rb.toFixed(2)})`);
      else fail(`T028: layouts NOT independent (wide ratio ${ra.toFixed(2)} vs narrow ${rb.toFixed(2)})`);
    }
    if (info.a.hasControls && info.b.hasControls) pass(`T028: controls present on both (buttons: ${info.a.controlButtons}/${info.b.controlButtons})`);
    else fail(`T028: controls missing (a: ${info.a.hasControls}, b: ${info.b.hasControls})`);
    if (info.a.loadingGone && info.b.loadingGone) pass('T028: loading indicators removed');
    else fail('T028: loading indicator still present');
    if (errors.length === 0) pass('T028: zero JS console errors');
    else fail('T028: JS errors: ' + JSON.stringify(errors));
    console.log('T028 counters:', JSON.stringify({ a: info.a.counterText, b: info.b.counterText }));

    await page.screenshot({ path: __dirname + '/t028.png', fullPage: true });
    await page.close();
  }

  // ---------- T029: invalid PDF URL error state ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + '/harness-t029.html', { waitUntil: 'load' });
    try {
      await page.waitForSelector('#bws-pdf-err .bws-pdf-viewer-error[role="alert"]', { timeout: 15000 });
      pass('T029: div[role=alert].bws-pdf-viewer-error appeared');
    } catch (e) {
      fail('T029: error div missing: ' + e.message);
    }
    const err = await page.evaluate(() => {
      const container = document.getElementById('bws-pdf-err');
      const ed = container.querySelector('.bws-pdf-viewer-error');
      const link = ed?.querySelector('a');
      const rect = container.getBoundingClientRect();
      return {
        visible: rect.width > 0 && rect.height > 0,
        message: ed?.querySelector('p')?.textContent ?? null,
        link: link ? { href: link.getAttribute('href'), target: link.target, rel: link.rel, text: link.textContent } : null,
        loadingGone: !container.querySelector('.bws-pdf-viewer-loading'),
      };
    });
    if (err.visible) pass('T029: container visible, not collapsed');
    else fail('T029: container collapsed');
    if (err.link && err.link.target === '_blank' && err.link.href.includes('does-not-exist.pdf')) {
      pass(`T029: direct link present (${err.link.text} -> ${err.link.href}, rel=${err.link.rel})`);
    } else fail('T029: link wrong/missing: ' + JSON.stringify(err.link));
    if (err.loadingGone) pass('T029: loading indicator removed');
    else fail('T029: loading indicator still present');
    console.log('T029 message:', err.message);

    await page.screenshot({ path: __dirname + '/t029.png', fullPage: true });
    await page.close();
  }

  await browser.close();
  let failed = 0;
  for (const [s, m] of results) { console.log(s + '  ' + m); if (s === 'FAIL') failed++; }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
