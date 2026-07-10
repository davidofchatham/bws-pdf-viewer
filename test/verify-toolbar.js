'use strict';
/**
 * Automated verification for feature 002 — integrated viewer toolbar.
 *
 * Asserts toolbar-dom.md invariants 1–10, the page-jump commit/clamp/restore
 * state machine, counter+input sync, fullscreen label toggle, roving tabindex,
 * responsive-reinit page preservation, and text-layer presence after the PDF.js 6
 * builder swap.
 *
 * Usage (from repo root, http-server serving repo root on :8123):
 *   node test/verify-toolbar.js
 *
 * Exits 0 when all checks pass.
 */
const { chromium } = require('playwright-core');

const BASE = 'http://127.0.0.1:8123';
const URL = BASE + '/test/harness-toolbar.html';

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const fail = (m) => results.push(['FAIL', m]);
  const pass = (m) => results.push(['PASS', m]);

  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.location().url.includes('favicon.ico')) {
      errors.push('console.error: ' + msg.text() + ' @ ' + msg.location().url);
    }
  });

  await page.goto(URL, { waitUntil: 'load' });

  // Wait for the three enabled toolbars + the document-mode canvas.
  await page.waitForSelector('#bws-pdf-flip .bws-pdf-viewer-controls', { timeout: 20000 });
  await page.waitForSelector('#bws-pdf-doc .page-container canvas.pdf-canvas', { timeout: 20000 });
  await page.waitForTimeout(1500);

  // ---------- Invariant 1: toolbar is the last child, inside the container ----------
  const structural = await page.evaluate(() => {
    const c = document.getElementById('bws-pdf-flip');
    const bar = c.querySelector('.bws-pdf-viewer-controls');
    return {
      insideContainer: !!bar && c.contains(bar),
      role: bar?.getAttribute('role'),
      ariaLabel: bar?.getAttribute('aria-label'),
    };
  });
  if (structural.insideContainer) pass('inv1: toolbar inside container');
  else fail('inv1: toolbar not inside container');
  // ---------- Invariant 2: role=toolbar + non-empty aria-label ----------
  if (structural.role === 'toolbar' && structural.ariaLabel) pass(`inv2: role=toolbar, aria-label="${structural.ariaLabel}"`);
  else fail(`inv2: role/label wrong: ${JSON.stringify(structural)}`);

  // ---------- Invariant 3: show_controls=false -> no toolbar at all ----------
  const noControls = await page.evaluate(() =>
    !document.querySelector('#bws-pdf-nocontrols .bws-pdf-viewer-controls'));
  if (noControls) pass('inv3: show_controls=false suppresses the toolbar');
  else fail('inv3: toolbar present despite show_controls=false');

  // ---------- Invariant 4: roving tabindex — exactly one tabindex=0 ----------
  const roving = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const items = Array.from(bar.querySelectorAll('button, input'));
    return {
      total: items.length,
      tabbable: items.filter((el) => el.getAttribute('tabindex') === '0').length,
      order: items.map((el) => el.className.split(' ')[0]),
    };
  });
  if (roving.tabbable === 1) pass(`inv4: one roving tab stop (of ${roving.total} controls)`);
  else fail(`inv4: ${roving.tabbable} tabbable controls (expected 1)`);

  // inv4b: the single tab stop must be an ENABLED control. A disabled control
  // with tabindex=0 (e.g. Prev on page 1) is skipped by the browser, leaving the
  // whole toolbar unreachable by Tab until arrow navigation moves the roving
  // index. Regression guard for that bug.
  const tabStop = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const el = bar.querySelector('[tabindex="0"]');
    return el ? { cls: el.className.split(' ')[0], disabled: !!el.disabled } : null;
  });
  if (tabStop && !tabStop.disabled) pass(`inv4b: tab stop is enabled (${tabStop.cls})`);
  else fail(`inv4b: tab stop is disabled or missing (${JSON.stringify(tabStop)}) — toolbar unreachable by Tab`);

  // Assembly order (T034/V27): grouped page-info · nav · utility. The counter is a
  // standalone display (G1, a span — not a roving item). The nav group (G2) is
  // first | prev | Jump-to input | next | last, with the input in the MIDDLE. Roving
  // order over buttons+input = first, prev, page-input, next, last, then utility (G3).
  const idx = (c) => roving.order.indexOf(c);
  const orderOk = idx('bws-pdf-first') === 0
    && idx('bws-pdf-prev') === 1
    && idx('bws-pdf-page-input') === 2
    && idx('bws-pdf-next') === 3
    && idx('bws-pdf-last') === 4
    && idx('bws-pdf-fullscreen') > idx('bws-pdf-last');
  if (orderOk) pass('inv1/order: first/prev/[jump]/next/last -> utility');
  else fail('order wrong: ' + JSON.stringify(roving.order));

  // Arrow moves roving focus within the toolbar. Focus the Next button (prev is
  // disabled at page 1 and cannot receive focus); ArrowRight should advance past it.
  await page.focus('#bws-pdf-flip .bws-pdf-next');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  const afterArrow = await page.evaluate(() => document.activeElement?.className.split(' ')[0]);
  if (afterArrow && afterArrow !== 'bws-pdf-next') pass(`inv4: ArrowRight moved focus (${afterArrow})`);
  else fail('inv4: ArrowRight did not move focus');

  // inv4c: clicking the page-jump input must KEEP focus. The container's click
  // handler refocuses the container to enable keyboard paging; without a toolbar
  // guard it steals focus off a just-clicked input so it can't be typed into.
  await page.click('#bws-pdf-flip .bws-pdf-page-input');
  await page.waitForTimeout(100);
  const clickFocus = await page.evaluate(() =>
    document.activeElement?.className.split(' ')[0]);
  if (clickFocus === 'bws-pdf-page-input') pass('inv4c: clicked page-input retains focus');
  else fail(`inv4c: click stole focus off page-input (activeElement=${clickFocus})`);

  // inv4d: the page-input must not TRAP arrow keys. The Jump-to input sits between
  // Prev and Next in the nav group, so at the right boundary (empty field) ArrowRight
  // releases to Next; at the left boundary ArrowLeft releases to Prev. Mid-text
  // arrows still edit.
  await page.evaluate(() => {
    const el = document.querySelector('#bws-pdf-flip .bws-pdf-page-input');
    el.focus(); el.value = ''; el.setSelectionRange(0, 0);
  });
  await page.waitForTimeout(50);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const outRight = await page.evaluate(() => document.activeElement?.className.split(' ')[0]);
  if (outRight === 'bws-pdf-next') pass('inv4d: ArrowRight at input boundary moves to Next');
  else fail(`inv4d: input trapped ArrowRight (activeElement=${outRight})`);

  // Mid-text: caret with text on the right must still edit (not escape).
  await page.evaluate(() => {
    const el = document.querySelector('#bws-pdf-flip .bws-pdf-page-input');
    el.focus(); el.value = '12'; el.setSelectionRange(0, 0);
  });
  await page.waitForTimeout(50);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  const stillInput = await page.evaluate(() => ({
    active: document.activeElement?.className.split(' ')[0],
    caret: document.querySelector('#bws-pdf-flip .bws-pdf-page-input').selectionStart,
  }));
  if (stillInput.active === 'bws-pdf-page-input' && stillInput.caret === 1)
    pass('inv4d: mid-text ArrowRight edits (caret moved, focus kept)');
  else fail(`inv4d: mid-text arrow mishandled (${JSON.stringify(stillInput)})`);
  // Restore state for the page-jump state machine below.
  await page.evaluate(() => {
    const el = document.querySelector('#bws-pdf-flip .bws-pdf-page-input');
    el.blur();
  });
  await page.waitForTimeout(200);

  // ---------- V11 + V33: write-only "Jump to" field + range counter ----------
  const jump = async (id, value, key) => {
    const sel = '#' + id + ' .bws-pdf-page-input';
    await page.click(sel);
    await page.fill(sel, value);
    await page.press(sel, key || 'Enter');
    await page.waitForTimeout(700);
    return page.$eval('#' + id, (c) => {
      const v = c.querySelector('.bws-pdf-page-input').value;
      const cur = window.BwsPdfViewerWP.activeViewers.get(c.id)?.viewer?.currentPage;
      const counter = c.querySelector('.bws-pdf-viewer-page-counter')?.textContent;
      return { value: v, currentPage: cur, counter };
    });
  };

  // V6: page-nav is hidden in document/continuous mode, so the jump/range behavior
  // is verified against a FLIPBOOK container (#bws-pdf-flip: double/traditional,
  // 12-page fixture). V11: the field is WRITE-ONLY — it clears after every commit
  // and never mirrors the current page. V33: the counter shows the spread's visible
  // RANGE ("N–M of T"); internal currentPage stays the rightmost real page so the
  // edge-disable gating is unchanged.

  // Valid jump — navigates to the spread containing page 5 (traditional: [4|5]),
  // currentPage = rightmost real page (5 here), field CLEARS, counter shows the
  // range "4–5 of 12".
  let r = await jump('bws-pdf-flip', '5', 'Enter');
  if (String(r.currentPage) === '5' && r.value === '') pass('V11: valid jump navigates + field clears');
  else fail('V11: valid jump failed: ' + JSON.stringify(r));
  if (/4[–-]5\s+of\s+12/.test(r.counter)) pass(`V33: counter shows spread range "${r.counter}"`);
  else fail('V33: range counter wrong: ' + JSON.stringify(r.counter));

  // Out-of-range clamps to last page (12); field clears; Next disables. #bws-pdf-flip
  // is TRADITIONAL (cover-alone) → 12 pages pack as [p1][p2|p3]…[p10|p11][p12|filler],
  // so the final spread is a LONE page 12 → counter collapses to "12 of 12" (V33).
  r = await jump('bws-pdf-flip', '999', 'Enter');
  if (String(r.currentPage) === '12' && r.value === '') pass('V11: out-of-range clamps to last page, field clears');
  else fail('V11: clamp failed: ' + JSON.stringify(r));
  if (/(^|\D)12\s+of\s+12/.test(r.counter) && !/[–-]/.test(r.counter)) pass(`V33: lone final page collapses to single "${r.counter}"`);
  else fail('V33: last spread counter wrong: ' + JSON.stringify(r.counter));

  // Non-numeric → no navigation, field clears (was on page 12).
  r = await jump('bws-pdf-flip', 'abc', 'Enter');
  if (String(r.currentPage) === '12' && r.value === '') pass('V11: non-numeric commits nothing + clears field');
  else fail('V11: non-numeric failed: ' + JSON.stringify(r));

  // Escape → abandon jump, field clears, no navigation.
  await page.click('#bws-pdf-flip .bws-pdf-page-input');
  await page.fill('#bws-pdf-flip .bws-pdf-page-input', '3');
  await page.press('#bws-pdf-flip .bws-pdf-page-input', 'Escape');
  await page.waitForTimeout(300);
  r = await page.$eval('#bws-pdf-flip', (c) => ({
    value: c.querySelector('.bws-pdf-page-input').value,
    currentPage: window.BwsPdfViewerWP.activeViewers.get(c.id)?.viewer?.currentPage,
  }));
  if (String(r.currentPage) === '12' && r.value === '') pass('V11: Escape abandons jump + clears field');
  else fail('V11: Escape failed: ' + JSON.stringify(r));

  // ---------- V6: page-nav HIDDEN in document/continuous mode ----------
  const docNav = await page.evaluate(() => {
    const c = document.getElementById('bws-pdf-doc');
    return {
      hasInput: !!c.querySelector('.bws-pdf-page-input'),
      hasPrev: !!c.querySelector('.bws-pdf-prev'),
      hasNext: !!c.querySelector('.bws-pdf-next'),
      // fullscreen/print must still be present (bar renders, only nav hidden)
      hasFullscreen: !!c.querySelector('.bws-pdf-fullscreen'),
      hasPrint: !!c.querySelector('.bws-pdf-print'),
    };
  });
  if (!docNav.hasInput && !docNav.hasPrev && !docNav.hasNext) pass('V6: document mode hides page-nav (no prev/next/input)');
  else fail('V6: document mode still shows page-nav: ' + JSON.stringify(docNav));
  if (docNav.hasFullscreen && docNav.hasPrint) pass('V6: document-mode toolbar keeps fullscreen + print');
  else fail('V6: document-mode fullscreen/print missing: ' + JSON.stringify(docNav));

  // ---------- Invariant 10: counter aria-hidden; shows a range (flip) ----------
  const counter = await page.evaluate(() => {
    const c = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-page-counter');
    return { ariaHidden: c?.getAttribute('aria-hidden'), text: c?.textContent };
  });
  if (counter.ariaHidden === 'true' && /of\s+12/.test(counter.text)) pass(`inv10: counter aria-hidden, text "${counter.text}"`);
  else fail('inv10: counter wrong: ' + JSON.stringify(counter));

  // inv11 (V33): on the LAST spread (page 12 from the clamp jump above), Next must be
  // disabled and the counter must reach 12 (rightmost real page drives the gating).
  // The write-only jump field is EMPTY (V11) — it no longer carries the page number.
  const lastSpread = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const next = bar.querySelector('.bws-pdf-next');
    const input = bar.querySelector('.bws-pdf-page-input');
    const counter = bar.querySelector('.bws-pdf-viewer-page-counter');
    return { nextDisabled: !!next.disabled, inputValue: input.value, counter: counter.textContent };
  });
  if (lastSpread.nextDisabled && /12\s+of\s+12/.test(lastSpread.counter) && lastSpread.inputValue === '')
    pass(`inv11: last spread disables Next, counter reaches 12 ("${lastSpread.counter}"), field empty`);
  else fail('inv11: last spread wrong: ' + JSON.stringify(lastSpread));

  // ---------- Invariant 8: SR live region carries "Page N of M" (flip) ----------
  const announcer = await page.evaluate(() => {
    const a = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-sr-announcer');
    return { live: a?.getAttribute('aria-live'), text: a?.textContent };
  });
  if (announcer.live === 'polite' && /Page\s+\d+\s+of\s+12/.test(announcer.text)) pass(`inv8: live region "${announcer.text}"`);
  else fail('inv8: announcer wrong: ' + JSON.stringify(announcer));

  // ---------- Invariant 6: fullscreen button has a label ----------
  const fs = await page.evaluate(() => {
    const b = document.querySelector('#bws-pdf-flip .bws-pdf-fullscreen');
    return b ? { label: b.getAttribute('aria-label'), text: b.textContent } : null;
  });
  if (fs && /fullscreen/i.test(fs.label)) pass(`inv6: fullscreen labelled "${fs.label}"`);
  else fail('inv6: fullscreen label missing: ' + JSON.stringify(fs));

  // ---------- Text layer present after the builder swap (US4) ----------
  const textLayer = await page.evaluate(() => {
    const spans = document.querySelectorAll('#bws-pdf-doc .page-container .textLayer span');
    const scaleVar = document.querySelector('#bws-pdf-doc .page-container')?.style.getPropertyValue('--scale-factor');
    return { spanCount: spans.length, scaleVar };
  });
  if (textLayer.spanCount > 0) pass(`US4: text layer rendered (${textLayer.spanCount} spans, --scale-factor=${textLayer.scaleVar})`);
  else fail('US4: no text-layer spans — builder swap may be broken');

  // ---------- Reinit page preservation ----------
  // Jump the narrow flipbook to page 3, resize wide->narrow crossing the breakpoint,
  // and confirm the reinitialised viewer restores near that page.
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.waitForTimeout(300);
  // Give the narrow embed a real width change by widening its column via style.
  await page.evaluate(() => { document.querySelector('.col-narrow').style.width = '900px'; });
  await page.waitForTimeout(500);
  const rjump = await jump('bws-pdf-narrow', '4', 'Enter');
  await page.evaluate(() => { document.querySelector('.col-narrow').style.width = '300px'; });
  await page.waitForTimeout(1200); // debounced reinit (150ms) + render
  const preserved = await page.$eval('#bws-pdf-narrow', (c) =>
    window.BwsPdfViewerWP.activeViewers.get(c.id)?.viewer?.currentPage);
  if (rjump && Number(preserved) >= 3) pass(`reinit: page preserved across layout change (landed ${preserved})`);
  else fail(`reinit: page not preserved (jumped to 4, landed ${preserved})`);

  // ---------- Spread-layout goToPage lands on the correct spread (V28/V33) ----------
  // book_layout="spread" = PLAIN two-up packing [p1|p2] [p3|p4] [p5|p6] … (NO lone
  // cover — that is traditional layout). pageToSpread(p) = floor((p-1)/2):
  //   jump 5 → spread 2 → slots [4,5] → pages [5|6] → currentPage 6, range "5–6 of 12"
  //   jump 6 → spread 2 → SAME [5|6] spread → currentPage 6, range "5–6 of 12"
  // currentPage is the rightmost real page (gating); the counter names both visible
  // pages. (The previous expectation of 5/7 encoded a packing the code never had.)
  await page.waitForSelector('#bws-pdf-spread .bws-pdf-viewer-controls', { timeout: 20000 });
  await page.waitForTimeout(500);
  const spreadJump = await jump('bws-pdf-spread', '5', 'Enter');
  if (String(spreadJump.currentPage) === '6' && /5[–-]6\s+of\s+12/.test(spreadJump.counter)) {
    pass(`spread: jump 5 → [5|6] spread, currentPage 6, counter "${spreadJump.counter}"`);
  } else {
    fail(`spread: jump 5 wrong: ${JSON.stringify(spreadJump)}`);
  }
  const spreadJump2 = await jump('bws-pdf-spread', '6', 'Enter');
  if (String(spreadJump2.currentPage) === '6' && /5[–-]6\s+of\s+12/.test(spreadJump2.counter)) {
    pass(`spread: jump 6 → same [5|6] spread, currentPage 6, counter "${spreadJump2.counter}"`);
  } else {
    fail(`spread: jump 6 wrong: ${JSON.stringify(spreadJump2)}`);
  }

  // ---------- Zero console errors ----------
  if (errors.length === 0) pass('zero JS console errors');
  else fail('JS errors: ' + JSON.stringify(errors));

  await page.screenshot({ path: __dirname + '/toolbar.png', fullPage: true });
  await page.close();
  await browser.close();

  let failed = 0;
  for (const [s, m] of results) { console.log(s + '  ' + m); if (s === 'FAIL') failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
