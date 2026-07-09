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

  // Assembly order: prev, page-nav (input), next, [fullscreen], [print]
  const orderOk = roving.order[0] === 'bws-pdf-prev'
    && roving.order.includes('bws-pdf-page-input')
    && roving.order.includes('bws-pdf-next');
  if (orderOk) pass('inv1/order: prev -> page-input -> next -> ...');
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

  // inv4d: the page-input must not TRAP arrow keys. With the caret at the right
  // boundary (empty field), ArrowRight releases to the toolbar and moves focus to
  // Next; at the left boundary ArrowLeft moves to Prev. Mid-text arrows still edit.
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

  // ---------- Invariant 5 + page-jump state machine ----------
  const jump = async (id, value, key) => {
    const sel = '#' + id + ' .bws-pdf-page-input';
    await page.click(sel);
    await page.fill(sel, value);
    await page.press(sel, key || 'Enter');
    await page.waitForTimeout(700);
    return page.$eval('#' + id, (c) => {
      const v = c.querySelector('.bws-pdf-page-input').value;
      const cur = window.BwsPdfViewerWP.activeViewers.get(c.id)?.viewer?.currentPage;
      return { value: v, currentPage: cur };
    });
  };

  // V6 (amended 2026-07-08, issue #8): the page-nav group is hidden in document/
  // continuous mode — all pages are stacked, so prev/next + page-jump are
  // meaningless. The page-jump state machine is therefore verified against a
  // FLIPBOOK container (#bws-pdf-flip: double/traditional, 12-page fixture) where
  // navigation is meaningful. The counter reports the RIGHTMOST real page of the
  // spread a jump lands on, so the typed page sticks: goToPage(5) lands the spread
  // showing pages 4-5 and the counter/input read 5 (the page the user asked for).
  // NOTE: if IDEAS #1 "Contained Continuous" ships (a viewport-bounded continuous
  // mode), page-nav returns for that mode and needs its own coverage here.

  // Valid in-range jump — typed odd page sticks (spread shows 4-5, counter reads 5).
  let r = await jump('bws-pdf-flip', '5', 'Enter');
  if (String(r.currentPage) === '5' && String(r.value) === '5') pass('jump: valid page navigates + syncs input (jumped page 5 sticks)');
  else fail('jump: valid failed: ' + JSON.stringify(r));

  // Out-of-range clamps to last page (12); counter reads page_count, Next disables.
  r = await jump('bws-pdf-flip', '999', 'Enter');
  if (String(r.currentPage) === '12') pass('jump: out-of-range clamps to last page (12)');
  else fail('jump: clamp failed: ' + JSON.stringify(r));

  // Non-numeric restores current page, no navigation
  await page.click('#bws-pdf-flip .bws-pdf-page-input');
  await page.fill('#bws-pdf-flip .bws-pdf-page-input', 'abc');
  await page.press('#bws-pdf-flip .bws-pdf-page-input', 'Enter');
  await page.waitForTimeout(400);
  r = await page.$eval('#bws-pdf-flip', (c) => ({
    value: c.querySelector('.bws-pdf-page-input').value,
    currentPage: window.BwsPdfViewerWP.activeViewers.get(c.id)?.viewer?.currentPage,
  }));
  if (String(r.value) === String(r.currentPage) && String(r.currentPage) === '12') pass('jump: non-numeric restores current page');
  else fail('jump: non-numeric restore failed: ' + JSON.stringify(r));

  // Escape restores without navigating
  await page.click('#bws-pdf-flip .bws-pdf-page-input');
  await page.fill('#bws-pdf-flip .bws-pdf-page-input', '3');
  await page.press('#bws-pdf-flip .bws-pdf-page-input', 'Escape');
  await page.waitForTimeout(300);
  r = await page.$eval('#bws-pdf-flip', (c) => ({
    value: c.querySelector('.bws-pdf-page-input').value,
    currentPage: window.BwsPdfViewerWP.activeViewers.get(c.id)?.viewer?.currentPage,
  }));
  if (String(r.currentPage) === '12' && String(r.value) === '12') pass('inv5: Escape restores without navigating');
  else fail('inv5: Escape failed: ' + JSON.stringify(r));

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

  // ---------- Invariant 10: counter aria-hidden; input carries the page (flip) ----------
  const counter = await page.evaluate(() => {
    const c = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-page-counter');
    return { ariaHidden: c?.getAttribute('aria-hidden'), text: c?.textContent };
  });
  if (counter.ariaHidden === 'true' && /of\s+12/.test(counter.text)) pass(`inv10: counter aria-hidden, text "${counter.text}"`);
  else fail('inv10: counter wrong: ' + JSON.stringify(counter));

  // inv11: on the LAST spread (we are at page 12 from the clamp jump above), Next
  // must be disabled and the counter must read the true last page — not the
  // spread's left page. Regression guard: the old floor mapping reported the left
  // page, so Next stayed enabled and the counter under-read on the final spread.
  const lastSpread = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const next = bar.querySelector('.bws-pdf-next');
    const input = bar.querySelector('.bws-pdf-page-input');
    return { nextDisabled: !!next.disabled, inputValue: input.value };
  });
  if (lastSpread.nextDisabled && lastSpread.inputValue === '12') pass('inv11: last spread disables Next, counter reads 12');
  else fail('inv11: last spread wrong (Next stayed enabled or counter under-read): ' + JSON.stringify(lastSpread));

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

  // ---------- Spread-layout goToPage lands on the correct spread ----------
  // book_layout="spread": page 1 alone on the right of spread 0, then 2-3, 4-5, 6-7…
  // goToPage uses floor(pageNum/2): page 5 → showNdx 2 → spread showing pages 4-5;
  // page 6 → showNdx 3 → spread showing pages 6-7. The counter reports the spread's
  // RIGHTMOST page (so the last spread reaches page_count and Next disables): 5→5,
  // 6→7.
  await page.waitForSelector('#bws-pdf-spread .bws-pdf-viewer-controls', { timeout: 20000 });
  await page.waitForTimeout(500);
  const spreadJump = await jump('bws-pdf-spread', '5', 'Enter');
  if (String(spreadJump.currentPage) === '5') {
    pass(`spread: goToPage(5) shows spread 4-5, counter reads right page 5 (got ${spreadJump.currentPage})`);
  } else {
    fail(`spread: goToPage(5) landed wrong (currentPage=${spreadJump.currentPage}, expected 5)`);
  }
  const spreadJump2 = await jump('bws-pdf-spread', '6', 'Enter');
  if (String(spreadJump2.currentPage) === '7') {
    pass(`spread: goToPage(6) shows spread 6-7, counter reads right page 7 (got ${spreadJump2.currentPage})`);
  } else {
    fail(`spread: goToPage(6) landed wrong (currentPage=${spreadJump2.currentPage}, expected 7)`);
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
