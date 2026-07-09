'use strict';
/**
 * B22 verification: flipbook fill-width for 1-page and 2-page books.
 *
 *   npx http-server -p 8123 -c-1 &
 *   node test/verify-b22.js
 *
 * Exits 0 when all checks pass; writes screenshots next to this script.
 */
const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8123';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const fail = (m) => results.push(['FAIL', m]);
  const pass = (m) => results.push(['PASS', m]);

  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('favicon')) errors.push('console.error: ' + m.text()); });

  await page.goto(BASE + '/test/harness-b22.html', { waitUntil: 'load' });
  await page.waitForSelector('#bws-pdf-one canvas', { timeout: 15000 });
  await page.waitForSelector('#bws-pdf-two canvas', { timeout: 15000 });
  await page.waitForSelector('#bws-pdf-three canvas', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Sample the drawn page extent by scanning canvas pixels for non-transparent columns.
  const probe = await page.evaluate(() => {
    function scan(id) {
      const c = document.querySelector('#' + id + ' canvas');
      const ctx = c.getContext('2d');
      const { width: W, height: H } = c;
      const img = ctx.getImageData(0, 0, W, H).data;
      const midRow = Math.floor(H / 2);
      let firstX = -1, lastX = -1;
      const colorAt = (x) => {
        const i = (midRow * W + x) * 4;
        return [img[i], img[i + 1], img[i + 2], img[i + 3]];
      };
      for (let x = 0; x < W; x++) {
        const a = colorAt(x)[3];
        if (a > 10) { if (firstX < 0) firstX = x; lastX = x; }
      }
      const drawnW = lastX - firstX + 1;
      return {
        canvasW: W, canvasH: H,
        cssW: c.clientWidth,
        firstX, lastX, drawnFrac: drawnW / W,
        leftSample: colorAt(Math.floor(W * 0.25)),
        rightSample: colorAt(Math.floor(W * 0.75)),
        centerSample: colorAt(Math.floor(W * 0.5)),
      };
    }
    const grabCtl = (id) => {
      const ctl = document.querySelector('#' + id + ' .bws-pdf-viewer-controls');
      const next = ctl?.querySelector('.bws-pdf-next');
      const counter = ctl?.querySelector('.bws-pdf-viewer-page-counter');
      return {
        counter: counter?.textContent ?? null,
        nextDisabled: next ? next.disabled : null,
        hasNav: !!ctl?.querySelector('.bws-pdf-next') || !!ctl?.querySelector('.bws-pdf-prev'),
        hasPrev: !!ctl?.querySelector('.bws-pdf-prev'),
      };
    };
    return {
      one: { ...scan('bws-pdf-one'), ctl: grabCtl('bws-pdf-one') },
      two: { ...scan('bws-pdf-two'), ctl: grabCtl('bws-pdf-two') },
      three: { ...scan('bws-pdf-three'), ctl: grabCtl('bws-pdf-three') },
    };
  });

  // ---- 1-page book ----
  const one = probe.one;
  // The lone page must fill essentially the whole canvas width (was ~0.5 with the bug).
  if (one.drawnFrac >= 0.9) pass(`1-page fills width (drawnFrac=${one.drawnFrac.toFixed(2)})`);
  else fail(`1-page NOT filling width — drawnFrac=${one.drawnFrac.toFixed(2)} (bug draws ~0.5)`);
  // Its color (reddish) should be present at both quarter and three-quarter marks.
  const red = (s) => s[3] > 10 && s[0] > s[2];
  if (red(one.leftSample) && red(one.rightSample)) pass('1-page page content spans left+right thirds');
  else fail(`1-page content missing on a side: L=${one.leftSample} R=${one.rightSample}`);

  // ---- 2-page book (single spread) ----
  const two = probe.two;
  // Single [p1|p2] spread → nothing to navigate → prev/next hidden (B23).
  if (!two.ctl.hasNav) pass('2-page hides prev/next (single spread, no phantom page)');
  else fail(`2-page still shows nav buttons (hasPrev=${two.ctl.hasPrev}) — phantom page reachable`);
  // Left half blue (b>r), right half green (g>r and g>b) — both pages on one spread.
  const L = two.leftSample, R = two.rightSample;
  const blue = L[3] > 10 && L[2] > L[0];
  const green = R[3] > 10 && R[1] > R[0] && R[1] > R[2];
  if (blue && green) pass(`2-page shows BOTH pages side-by-side (L blue ${L}, R green ${R})`);
  else fail(`2-page not a full spread: L=${L} (blue=${blue}) R=${R} (green=${green})`);
  if (two.drawnFrac >= 0.9) pass(`2-page spread fills width (drawnFrac=${two.drawnFrac.toFixed(2)})`);
  else fail(`2-page spread narrow: drawnFrac=${two.drawnFrac.toFixed(2)}`);

  // ---- 3-page book (traditional cover must survive) ----
  const three = probe.three;
  if (three.ctl.counter && /of\s*3/.test(three.ctl.counter)) pass(`3-page counter shows "${three.ctl.counter}"`);
  else fail(`3-page counter wrong: ${three.ctl.counter}`);
  if (three.ctl.nextDisabled === false) pass('3-page Next enabled (more spreads follow the cover)');
  else fail(`3-page Next should be enabled, got disabled=${three.ctl.nextDisabled}`);
  // Cover spread 0 = page 1 alone, CENTERED at half width: content in the middle,
  // transparent at the far left and far right thirds (no second page beside it).
  const tRed = three.centerSample[3] > 10 && three.centerSample[0] > three.centerSample[2];
  const tEdgesClear = three.leftSample[3] <= 10 && three.rightSample[3] <= 10;
  if (tRed && tEdgesClear) pass(`3-page cover is page 1 ALONE, centered (center=${three.centerSample}, edges transparent)`);
  else fail(`3-page cover not lone-centered: center=${three.centerSample} L=${three.leftSample} R=${three.rightSample}`);

  // ---- 3-page nav actually advances to spread 1 = [p2|p3] ----
  await page.click('#bws-pdf-three .bws-pdf-next');
  await page.waitForTimeout(1400); // allow flip animation to settle
  const threeAfter = await page.evaluate(() => {
    const c = document.querySelector('#bws-pdf-three canvas');
    const ctx = c.getContext('2d');
    const { width: W, height: H } = c;
    const row = Math.floor(H / 2);
    const at = (x) => { const i = (row * W + x) * 4; const d = ctx.getImageData(x, row, 1, 1).data; return [d[0], d[1], d[2], d[3]]; };
    const ctl = document.querySelector('#bws-pdf-three .bws-pdf-viewer-controls');
    return {
      left: at(Math.floor(W * 0.25)), right: at(Math.floor(W * 0.75)),
      counter: ctl?.querySelector('.bws-pdf-viewer-page-counter')?.textContent ?? null,
      nextDisabled: ctl?.querySelector('.bws-pdf-next')?.disabled ?? null,
    };
  });
  const L2 = threeAfter.left, R2 = threeAfter.right;
  const blue2 = L2[3] > 10 && L2[2] > L2[0];                 // p2 blue
  const green2 = R2[3] > 10 && R2[1] > R2[0] && R2[1] > R2[2]; // p3 green
  if (blue2 && green2) pass(`3-page Next lands on spread [p2|p3] (L=${L2} R=${R2})`);
  else fail(`3-page Next did not show [p2|p3]: L=${L2} R=${R2}`);
  if (threeAfter.nextDisabled === true) pass('3-page Next disabled on last spread');
  else fail(`3-page Next should disable on last spread, got ${threeAfter.nextDisabled}`);

  await page.screenshot({ path: __dirname + '/b22-shot.png', fullPage: true });

  if (errors.length) errors.forEach((e) => fail(e));
  console.log('\n=== B22 verification ===');
  results.forEach(([s, m]) => console.log(`  [${s}] ${m}`));
  await browser.close();
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
