'use strict';
/**
 * PROTOTYPE — THROWAWAY (wayfinder map #9, ticket #17). Do not ship.
 *
 * Drives spike-singleflip.html with playwright-core + system Chrome to answer:
 *   Is `single + flip` a RE-PARAMETERIZATION of the spread warp, or new code?
 *
 * Method: the harness runs the SAME drawTurningPage() fn with two loc's
 * (spread spine-pivot vs single full-page edge-pivot). This driver:
 *   1. Renders both across flipFrac in {0,.25,.5,.75,1}, screenshots a strip.
 *   2. Runs a geometry probe per frame:
 *        opaqueFrac -> page actually painted (not blank/clipped away)
 *        tornCols   -> vertical columns with a white GAP inside the page
 *                      = the warp tore / self-overlapped (the failure signal).
 *   3. Verdict: SINGLE is a re-parameterization iff, at every frac, it paints
 *      a non-trivial page AND has ~0 torn columns (matching spread's tear count).
 *
 *   npx http-server -p 8123 -c-1 &   (or any static server on 8123)
 *   node test/spike-singleflip.js
 */
const { chromium } = require('playwright-core');
const BASE = 'http://127.0.0.1:8123';
const FRACS = [0, 0.25, 0.5, 0.75, 1];

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const pass = (m) => results.push(['PASS', m]);
  const fail = (m) => results.push(['FAIL', m]);
  const note = (m) => results.push(['NOTE', m]);

  const page = await browser.newPage({ viewport: { width: 960, height: 400 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.location().url.includes('favicon')) errors.push('console.error: ' + m.text()); });

  await page.goto(BASE + '/test/spike-singleflip.html', { waitUntil: 'load' });

  // Probe both modes across the sweep.
  const probe = async (mode) => {
    const rows = [];
    for (const f of FRACS) {
      const r = await page.evaluate(([m, ff]) => window.__probe(m, ff), [mode, f]);
      rows.push({ f, ...r });
    }
    return rows;
  };
  const spread = await probe('spread');
  const single = await probe('single');

  const fmt = (rows) => rows.map(r => `f=${r.f}: opaque=${(r.opaqueFrac*100).toFixed(0)}% torn=${r.tornCols}`).join('  |  ');
  note('SPREAD  ' + fmt(spread));
  note('SINGLE  ' + fmt(single));

  // --- verdict criteria -----------------------------------------------------
  // (a) SINGLE paints a real page at every mid-sweep frac (not clipped to nothing).
  const midSingle = single.filter(r => r.f > 0 && r.f < 1);
  const paints = midSingle.every(r => r.opaqueFrac > 0.05);
  if (paints) pass('SINGLE paints a non-trivial page at every mid-sweep frac — warp is not clipped away');
  else fail('SINGLE went blank mid-sweep — full-page loc clips the draw away (NOT a clean re-param)');

  // (b) SINGLE tears no worse than SPREAD (the same fn, so tear count should match ~0).
  const spreadTorn = Math.max(...spread.map(r => r.tornCols));
  const singleTorn = Math.max(...single.map(r => r.tornCols));
  if (singleTorn <= spreadTorn + 2) pass(`SINGLE tear-free: max torn cols ${singleTorn} vs spread ${spreadTorn} — no new geometry holes`);
  else fail(`SINGLE tore: max torn cols ${singleTorn} vs spread ${spreadTorn} — edge-pivot self-overlaps, needs new geometry`);

  // (c) the fn was literally the same object for both (structural proof, not pixels):
  //     confirmed by construction in the harness — note it.
  note('Both modes call the identical drawTurningPage() fn; only loc {left,width,reveal-clip} differs.');

  // Screenshot strips for the human eyeball (HITL prototype requirement).
  for (const f of FRACS) {
    await page.evaluate((ff) => { window.__render('spread', ff); window.__render('single', ff); }, f);
    await page.screenshot({ path: `${__dirname}/spike-singleflip-f${String(f).replace('.', '')}.png` });
  }
  // A mid-sweep hero shot at f=0.5.
  await page.evaluate(() => { window.__render('spread', 0.5); window.__render('single', 0.5); });
  await page.screenshot({ path: `${__dirname}/spike-singleflip-shot.png` });

  if (errors.length) errors.forEach((e) => fail(e));
  console.log('\n=== Spike #17: single-page flip re-parameterization ===');
  results.forEach(([s, m]) => console.log(`  [${s}] ${m}`));
  await browser.close();
  const failed = results.filter((r) => r[0] === 'FAIL').length;
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED (notes are informational)');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
