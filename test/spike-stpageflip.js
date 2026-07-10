'use strict';
/**
 * PROTOTYPE — THROWAWAY (wayfinder map #9, ticket #11). Do not ship.
 *
 * Spike B: StPageFlip (page-flip 2.0.7) as the transient animation layer of Arch (A).
 * Drives spike-stpageflip.html with playwright-core + system Chrome.
 *
 *   node test/spike-stpageflip.js      (static server must serve repo root on :8123)
 */
const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8123';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const pass = (m) => results.push(['PASS', m]);
  const fail = (m) => results.push(['FAIL', m]);
  const note = (m) => results.push(['NOTE', m]);

  const page = await browser.newPage({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('favicon')) errors.push('console.error: ' + m.text()); });

  await page.goto(BASE + '/test/spike-stpageflip.html', { waitUntil: 'load' });

  // wait for lib init
  try {
    await page.waitForFunction(() => window.__ready === true, { timeout: 8000 });
    pass('lib constructed + loadFromImages() rendered (page-flip 2.0.7 runs)');
  } catch (e) {
    fail('lib did not init within 8s');
  }

  // Q4: testability — is there ANY progress-parameterized public hook?
  const scrub = await page.evaluate(() => window.__hasScrubHook());
  if (scrub.hasAny) note(`Q4: instance exposes hook(s): ${scrub.found.join(', ')}`);
  else pass('Q4 testability: NO renderFrame/progress/currentTime/seek hook — animation is behind its own rAF (must fork or wrap for seam scrubbing)');

  // Q2: built-in single-page (portrait) mode exists + responsive orientation switch
  const wide = await page.evaluate(() => window.__orientationFor(900));
  const narrow = await page.evaluate(() => window.__orientationFor(380));
  note(`Q2 orientation @900px = ${wide}, @380px = ${narrow}`);
  if (wide && narrow && wide !== narrow) pass(`Q2 built-in responsive single<->spread: switched ${wide}->${narrow} on width change`);
  else if (narrow === 'portrait') pass(`Q2 portrait (single-page) mode reachable (@380px = portrait)`);
  else note('Q2: orientation did not switch in harness (stretch sizing may pin it) — feature exists in API regardless');

  // Q1: soft curl actually animates — flip and confirm the canvas changes over frames
  const framing = await page.evaluate(async () => {
    const flipCanvas = () => document.querySelector('#flip canvas');
    const grab = () => { const c = flipCanvas(); if (!c) return null; return c.getContext('2d').getImageData(0,0,c.width,c.height).data.slice(0, 4000); };
    const f0 = grab();
    window.__flip();
    await new Promise(r => setTimeout(r, 120));   // mid-curl
    const fMid = grab();
    await new Promise(r => setTimeout(r, 600));    // settled
    const f1 = grab();
    const diff = (a, b) => { if(!a||!b) return -1; let d=0; for(let i=0;i<a.length;i+=4) if(Math.abs(a[i]-b[i])>8) d++; return d/(a.length/4); };
    return { midMoved: diff(f0, fMid), settledMoved: diff(f0, f1), hasCanvas: !!flipCanvas() };
  });
  if (framing.hasCanvas) pass('Q1: lib renders to a <canvas> (soft-curl raster surface present)');
  if (framing.midMoved > 0.02) pass(`Q1: curl animates — mid-flip frame differs from start (${(framing.midMoved*100).toFixed(1)}% pixels moved)`);
  else note(`Q1: mid-flip motion not captured by timing (midMoved=${(framing.midMoved*100).toFixed(1)}%) — rAF-timed, hard to sample without a scrub hook (reinforces Q4)`);

  // Q3: a11y — does the lib's surface swallow / cover our persistent underlay text?
  const a11y = await page.evaluate(() => window.__textLayerAlive());
  if (a11y.present) pass(`Q3 a11y: our persistent text layer SURVIVES in the DOM ("${a11y.text}")`);
  else fail('Q3 a11y: persistent text layer was removed by the lib');
  if (a11y.coveredByFlip) note(`Q3 a11y: BUT the flip <canvas> paints OVER it (top element at text center = ${a11y.topTag}) — text is present-but-occluded; underneath-layer model needs the overlay to be transient/removed to expose it (matches Arch A: overlay must be discarded on settle)`);
  else note(`Q3 a11y: text center hit-tests to ${a11y.topTag} (not covered)`);

  await page.screenshot({ path: __dirname + '/spike-stpageflip-shot.png' });

  if (errors.length) errors.forEach((e) => note('runtime: ' + e)); // lib is old; note not fail
  console.log('\n=== Spike B: StPageFlip flip overlay ===');
  results.forEach(([s, m]) => console.log(`  [${s}] ${m}`));
  await browser.close();
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED (notes are informational)');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
