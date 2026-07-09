'use strict';
/**
 * B24 verification: flipbook honors an ancestor max-height.
 *
 *   npx http-server -p 8123 -c-1 &
 *   node test/verify-b24.js
 *
 * A portrait 1-page flipbook inside a max-height:400px wrapper must have its canvas
 * capped to fit (≤ 400px, minus toolbar reserve), with the width shrunk to preserve
 * the page aspect so the page still fills the canvas width (no reintroduced side
 * whitespace — B22 stays intact) and the narrower canvas is centered. A control copy
 * with no ancestor cap must stay tall (B22 fill-width behavior unchanged).
 */
const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8123';
const CAP = 400;          // .capped-wrap max-height
const TOOLBAR_RESERVE = 48;

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const fail = (m) => results.push(['FAIL', m]);
  const pass = (m) => results.push(['PASS', m]);

  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('favicon')) errors.push('console.error: ' + m.text()); });

  await page.goto(BASE + '/test/harness-b24.html', { waitUntil: 'load' });
  await page.waitForSelector('#bws-pdf-capped canvas', { timeout: 15000 });
  await page.waitForSelector('#bws-pdf-free canvas', { timeout: 15000 });
  await page.waitForTimeout(1500);

  const probe = await page.evaluate(() => {
    function scan(id) {
      const c = document.querySelector('#' + id + ' canvas');
      const ctx = c.getContext('2d');
      const { width: W, height: H } = c;
      const img = ctx.getImageData(0, 0, W, H).data;
      const midRow = Math.floor(H / 2);
      let firstX = -1, lastX = -1;
      const colorAt = (x) => { const i = (midRow * W + x) * 4; return [img[i], img[i + 1], img[i + 2], img[i + 3]]; };
      for (let x = 0; x < W; x++) { if (colorAt(x)[3] > 10) { if (firstX < 0) firstX = x; lastX = x; } }
      const rect = c.getBoundingClientRect();
      const wrapRect = c.closest('.capped-wrap, .free-wrap').getBoundingClientRect();
      return {
        canvasW: W, canvasH: H,
        cssW: c.clientWidth, cssH: c.clientHeight,
        drawnFrac: (lastX - firstX + 1) / W,
        // horizontal centering of the canvas within its wrapper
        leftGap: rect.left - wrapRect.left,
        rightGap: wrapRect.right - rect.right,
      };
    }
    return { capped: scan('bws-pdf-capped'), free: scan('bws-pdf-free') };
  });

  const cap = probe.capped, free = probe.free;

  // ---- capped canvas fits the ancestor ceiling ----
  const ceiling = CAP - TOOLBAR_RESERVE;
  if (cap.cssH <= ceiling + 2) pass(`capped canvas fits ancestor max-height (cssH=${cap.cssH}px ≤ ${ceiling}px)`);
  else fail(`capped canvas overflows max-height: cssH=${cap.cssH}px > ${ceiling}px`);

  // ---- width shrank to keep aspect (page still fills canvas width, no side gap) ----
  if (cap.drawnFrac >= 0.9) pass(`capped page still fills canvas width (drawnFrac=${cap.drawnFrac.toFixed(2)}, no side whitespace)`);
  else fail(`capped page not filling canvas width: drawnFrac=${cap.drawnFrac.toFixed(2)}`);
  if (cap.cssW < free.cssW - 2) pass(`capped canvas narrower than uncapped (${cap.cssW}px < ${free.cssW}px) — shrank to fit`);
  else fail(`capped canvas did not shrink: capped=${cap.cssW}px free=${free.cssW}px`);

  // ---- narrower canvas centered in wrapper ----
  if (Math.abs(cap.leftGap - cap.rightGap) <= 2) pass(`capped canvas centered in wrapper (gaps ${cap.leftGap.toFixed(0)}/${cap.rightGap.toFixed(0)})`);
  else fail(`capped canvas off-center: leftGap=${cap.leftGap.toFixed(0)} rightGap=${cap.rightGap.toFixed(0)}`);

  // ---- control: no cap → tall canvas (B22 fill-width unchanged) ----
  if (free.cssH > CAP) pass(`uncapped control stays tall (cssH=${free.cssH}px > ${CAP}px) — B22 intact`);
  else fail(`uncapped control unexpectedly short: cssH=${free.cssH}px`);
  if (free.drawnFrac >= 0.9) pass(`uncapped control fills width (drawnFrac=${free.drawnFrac.toFixed(2)})`);
  else fail(`uncapped control not filling width: drawnFrac=${free.drawnFrac.toFixed(2)}`);

  await page.screenshot({ path: __dirname + '/b24-shot.png', fullPage: true });

  if (errors.length) errors.forEach((e) => fail(e));
  console.log('\n=== B24 verification ===');
  results.forEach(([s, m]) => console.log(`  [${s}] ${m}`));
  await browser.close();
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
