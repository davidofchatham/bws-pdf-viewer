'use strict';
/**
 * PROTOTYPE — THROWAWAY (wayfinder map #9, ticket #10). Do not ship.
 *
 * Spike A: View Transitions API as the transient flip overlay for Arch (A).
 * Answers the 4 ticket questions by driving spike-viewtransitions.html with
 * playwright-core + system Chrome, probing pixels via getImageData.
 *
 *   npx http-server -p 8123 -c-1 &   (or any static server on 8123)
 *   node test/spike-viewtransitions.js
 */
const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8123';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const pass = (m) => results.push(['PASS', m]);
  const fail = (m) => results.push(['FAIL', m]);
  const note = (m) => results.push(['NOTE', m]);

  // deviceScaleFactor:1 per convergence-doc testability guidance (HiDPI multiplies subpixel diffs)
  const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('favicon')) errors.push('console.error: ' + m.text()); });

  await page.goto(BASE + '/test/spike-viewtransitions.html', { waitUntil: 'load' });

  // Q4: support reality + fallback path exists
  const supported = await page.evaluate(() => window.__vtSupported);
  note(`View Transitions supported in this Chrome: ${supported}`);
  if (!supported) note('turn() falls back to instant swap (fallback path exercised)');

  // baseline (page 1) snapshot for seam compare
  const pixDiff = (a, b) => {
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i+1] - b[i+1]) > 8 || Math.abs(a[i+2] - b[i+2]) > 8) diff++;
    }
    return diff / (a.length / 4);
  };

  const before = await page.evaluate(() => window.__snapshot());

  // Q3: scrub-testability. Start a turn, freeze at t=0 and t=1 via WAAPI currentTime.
  // Kick the transition but DON'T await it — we want to grab it mid-flight and scrub.
  const scrubInfo = await page.evaluate(async () => {
    const t = window.turn(1);
    if (!t) return { fallback: true, animCount: 0 };
    // wait until pseudo-element animations exist
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const atMid = window.scrubAt(0.5);       // proves currentTime is settable
    const overlayMid = window.__overlayCount();
    // Read done. Now RESUME the animations so the transition actually finishes —
    // leaving them paused would deadlock t.finished. finish() jumps to the end
    // AND resolves, which is exactly the mid-flip-cancel "jump to t=1" rule.
    document.getAnimations().forEach(a => { try { a.play(); a.finish(); } catch (e) {} });
    await Promise.race([
      t.finished.catch(() => {}),
      new Promise(r => setTimeout(r, 2000)),   // safety valve
    ]);
    return { fallback: false, animCount: atMid, overlayMid };
  });

  if (scrubInfo.fallback) {
    note('No VT support here → seam/scrub probes N/A; fallback swap verified instead');
    const after = await page.evaluate(() => window.__snapshot());
    const d = pixDiff(before, after);
    if (d > 0.1) pass(`fallback instant-swap changed the page (diff ${(d*100).toFixed(1)}%)`);
    else fail('fallback swap did not change page content');
  } else {
    // Q3: real WAAPI Animation objects were scrubbable (currentTime set, count > 0)
    if (scrubInfo.animCount > 0) pass(`Q3 scrub-testability: ${scrubInfo.animCount} WAAPI Animation object(s) frozen via currentTime — renderFrame(t) comes free`);
    else fail('Q3: no WAAPI animations found to scrub');

    // Q2: overlay pseudo-elements existed mid-flip (browser owned the snapshot layer)
    if (scrubInfo.overlayMid > 0) pass(`Q2 handoff seam: ${scrubInfo.overlayMid} ::view-transition overlay layer(s) present mid-flip — browser owns snapshot/z-order`);
    else note('Q2: could not observe overlay pseudo count (browser may hide from getAnimations)');
  }

  // Q1 + Q2 seam t=1: after settle, static layer shows the NEW page (page 2), overlay gone.
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__snapshot());
  const overlayAfter = await page.evaluate(() => window.__overlayCount());
  const d = pixDiff(before, after);
  if (d > 0.1) pass(`Q1/Q2 t=1: static layer advanced to new page (diff ${(d*100).toFixed(1)}%) — no stuck/blank frame`);
  else fail(`t=1: page did not advance (diff ${(d*100).toFixed(1)}%)`);
  if (overlayAfter === 0) pass('Q2 cleanup: no ::view-transition overlay layers remain after settle');
  else fail(`Q2 cleanup: ${overlayAfter} overlay layer(s) orphaned after settle`);

  await page.screenshot({ path: __dirname + '/spike-vt-shot.png' });

  if (errors.length) errors.forEach((e) => fail(e));
  console.log('\n=== Spike A: View Transitions flip overlay ===');
  results.forEach(([s, m]) => console.log(`  [${s}] ${m}`));
  await browser.close();
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED (notes are informational)');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
