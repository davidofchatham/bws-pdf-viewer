'use strict';
/**
 * Automated verification for T29–T32 — toolbar icons, first/last buttons,
 * download button, and dock-by-mode positioning.
 *
 * Asserts:
 *   V30 — every button carries an aria-hidden + focusable=false SVG glyph;
 *         icon-only buttons (first/last/fullscreen/print/download) have BOTH
 *         aria-label AND title; prev/next keep visible text alongside the icon.
 *   V31 — document/flow mode docks the toolbar ABOVE the pages (first child of
 *         the container); flip/book mode docks it BELOW (last child).
 *   V32 — download button present in both modes, downloads config.pdf.
 *   V6/V27 — first/last live in the page-nav group (flipbook only), join the
 *         roving order, and disable at the corresponding edge.
 *
 * Reuses harness-toolbar.html (the 002 fixtures already carry the modes we need;
 * show_download defaults on when the config key is absent — !== false).
 *
 * Usage (from repo root, http-server serving repo root on :8123):
 *   node test/verify-toolbar-icons.js
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
  await page.waitForSelector('#bws-pdf-flip .bws-pdf-viewer-controls', { timeout: 20000 });
  await page.waitForSelector('#bws-pdf-doc .bws-pdf-viewer-controls', { timeout: 20000 });
  await page.waitForTimeout(1200);

  // ---------- V30: every button has an aria-hidden, non-focusable SVG ----------
  const glyphs = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const btns = Array.from(bar.querySelectorAll('button'));
    return btns.map((b) => {
      const svg = b.querySelector('svg.bws-pdf-icon');
      return {
        cls: b.className.split(' ')[0],
        hasSvg: !!svg,
        ariaHidden: svg && svg.getAttribute('aria-hidden'),
        focusable: svg && svg.getAttribute('focusable'),
      };
    });
  });
  const allHaveGlyph = glyphs.every((g) => g.hasSvg);
  if (allHaveGlyph) pass(`V30: all ${glyphs.length} buttons carry an SVG glyph`);
  else fail('V30: some buttons missing SVG: ' + JSON.stringify(glyphs.filter((g) => !g.hasSvg)));

  const glyphA11y = glyphs.every((g) => g.ariaHidden === 'true' && g.focusable === 'false');
  if (glyphA11y) pass('V30: every glyph is aria-hidden=true + focusable=false');
  else fail('V30: glyph a11y wrong: ' + JSON.stringify(glyphs));

  // ---------- V30: icon-only buttons carry BOTH aria-label AND title ----------
  const iconOnly = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const sels = ['bws-pdf-first', 'bws-pdf-last', 'bws-pdf-fullscreen', 'bws-pdf-print', 'bws-pdf-download'];
    return sels.map((s) => {
      const b = bar.querySelector('.' + s);
      if (!b) return { cls: s, missing: true };
      return {
        cls: s,
        ariaLabel: b.getAttribute('aria-label'),
        title: b.getAttribute('title'),
        // icon-only = no visible text node besides whitespace
        visibleText: b.textContent.trim(),
      };
    });
  });
  const named = iconOnly.filter((b) => !b.missing).every((b) => b.ariaLabel && b.title);
  if (named) pass('V30: icon-only buttons all have aria-label + title');
  else fail('V30: icon-only button missing name: ' + JSON.stringify(iconOnly));

  const trulyIconOnly = iconOnly.filter((b) => !b.missing).every((b) => b.visibleText === '');
  if (trulyIconOnly) pass('V30: icon-only buttons carry no visible text');
  else fail('V30: icon-only button has stray text: ' + JSON.stringify(iconOnly));

  // ---------- V30: prev/next keep visible text beside the icon ----------
  const withText = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const g = (s) => {
      const b = bar.querySelector('.' + s);
      return {
        text: b.querySelector('.bws-pdf-btn-text')?.textContent?.trim() || '',
        hasIcon: !!b.querySelector('svg.bws-pdf-icon'),
        title: b.getAttribute('title'),
      };
    };
    return { prev: g('bws-pdf-prev'), next: g('bws-pdf-next') };
  });
  if (withText.prev.text && withText.prev.hasIcon && withText.next.text && withText.next.hasIcon) {
    pass(`V30: prev/next are icon+text ("${withText.prev.text}"/"${withText.next.text}")`);
  } else {
    fail('V30: prev/next not icon+text: ' + JSON.stringify(withText));
  }

  // ---------- V31: dock position by mode ----------
  // Position is measured RELATIVE TO THE PAGE CONTENT, not literal first/last child:
  // the SR live-region announcer (visually hidden, position-neutral) is appended
  // last in both modes on the first page-change, so it must be excluded. Document
  // mode: toolbar precedes the first page-container. Flip mode: toolbar follows the
  // canvas. compareDocumentPosition tells us the ordering directly.
  const FOLLOWING = 4; // Node.DOCUMENT_POSITION_FOLLOWING
  const dock = await page.evaluate((FOLLOWING) => {
    const rel = (id, contentSel) => {
      const c = document.getElementById(id);
      const bar = c.querySelector('.bws-pdf-viewer-controls');
      const content = c.querySelector(contentSel);
      if (!bar || !content) return { ok: false, missing: true };
      // barBeforeContent === true when `content` FOLLOWS `bar` in document order.
      const barBeforeContent = !!(bar.compareDocumentPosition(content) & FOLLOWING);
      return { barBeforeContent };
    };
    return {
      doc: rel('bws-pdf-doc', '.page-container'),
      flip: rel('bws-pdf-flip', 'canvas'),
    };
  }, FOLLOWING);
  if (dock.doc.barBeforeContent) pass('V31: document/flow toolbar docks ABOVE the pages');
  else fail('V31: document toolbar not above pages: ' + JSON.stringify(dock.doc));
  if (dock.flip && dock.flip.barBeforeContent === false) pass('V31: flip/book toolbar docks BELOW the canvas');
  else fail('V31: flip toolbar not below canvas: ' + JSON.stringify(dock.flip));

  // ---------- V32: download present in both modes; targets config.pdf ----------
  const dl = await page.evaluate(() => {
    const g = (id) => !!document.querySelector('#' + id + ' .bws-pdf-download');
    return { doc: g('bws-pdf-doc'), flip: g('bws-pdf-flip') };
  });
  if (dl.doc && dl.flip) pass('V32: download button present in document + flip modes');
  else fail('V32: download button missing: ' + JSON.stringify(dl));

  // Clicking download creates an <a download> for the source URL. Intercept the
  // click by stubbing HTMLAnchorElement.click and capturing the href.
  const dlTarget = await page.evaluate(() => {
    return new Promise((resolve) => {
      const orig = window.HTMLAnchorElement.prototype.click;
      let captured = null;
      window.HTMLAnchorElement.prototype.click = function () {
        captured = { href: this.getAttribute('href'), download: this.hasAttribute('download') };
        // don't actually navigate
      };
      document.querySelector('#bws-pdf-flip .bws-pdf-download').click();
      window.HTMLAnchorElement.prototype.click = orig;
      resolve(captured);
    });
  });
  if (dlTarget && /fp\.pdf$/.test(dlTarget.href) && dlTarget.download) {
    pass(`V32: download click targets source PDF with download attr (${dlTarget.href})`);
  } else {
    fail('V32: download click wrong: ' + JSON.stringify(dlTarget));
  }

  // ---------- V6: first/last are flipbook-only (hidden in document mode) ----------
  const flFirstLast = await page.evaluate(() => {
    const g = (id) => ({
      first: !!document.querySelector('#' + id + ' .bws-pdf-first'),
      last: !!document.querySelector('#' + id + ' .bws-pdf-last'),
    });
    return { doc: g('bws-pdf-doc'), flip: g('bws-pdf-flip') };
  });
  if (flFirstLast.flip.first && flFirstLast.flip.last) pass('V6: first/last present in flipbook mode');
  else fail('V6: first/last missing in flipbook: ' + JSON.stringify(flFirstLast.flip));
  if (!flFirstLast.doc.first && !flFirstLast.doc.last) pass('V6: first/last hidden in document mode');
  else fail('V6: first/last leaked into document mode: ' + JSON.stringify(flFirstLast.doc));

  // ---------- V27: first/last join roving list + disable at edges ----------
  // At load (page 1) First must be disabled; Last enabled. Jump to last page and
  // the disabled states swap.
  const edgeStart = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    return {
      firstDisabled: !!bar.querySelector('.bws-pdf-first').disabled,
      lastDisabled: !!bar.querySelector('.bws-pdf-last').disabled,
      inRoving: !!bar.querySelector('.bws-pdf-first[tabindex]') && !!bar.querySelector('.bws-pdf-last[tabindex]'),
    };
  });
  if (edgeStart.inRoving) pass('V27: first/last carry a roving tabindex');
  else fail('V27: first/last not in roving order: ' + JSON.stringify(edgeStart));
  if (edgeStart.firstDisabled && !edgeStart.lastDisabled) pass('V27: on page 1, First disabled + Last enabled');
  else fail('V27: page-1 edge state wrong: ' + JSON.stringify(edgeStart));

  // Click Last → jump to final page; First enables, Last disables. The write-only
  // jump field stays empty (V11); the range counter reaches "12 of 12" (V33).
  await page.click('#bws-pdf-flip .bws-pdf-last');
  await page.waitForTimeout(700);
  const edgeEnd = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    return {
      firstDisabled: !!bar.querySelector('.bws-pdf-first').disabled,
      lastDisabled: !!bar.querySelector('.bws-pdf-last').disabled,
      counter: bar.querySelector('.bws-pdf-viewer-page-counter').textContent,
    };
  });
  if (!edgeEnd.firstDisabled && edgeEnd.lastDisabled && /12\s+of\s+12/.test(edgeEnd.counter)) {
    pass(`V27: Last jumps to last page → First enabled, Last disabled ("${edgeEnd.counter}")`);
  } else {
    fail('V27: last-page edge state wrong: ' + JSON.stringify(edgeEnd));
  }

  // Click First → back to page 1 (counter "1 of 12", First disabled again).
  await page.click('#bws-pdf-flip .bws-pdf-first');
  await page.waitForTimeout(700);
  const backToFirst = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    return {
      counter: bar.querySelector('.bws-pdf-viewer-page-counter').textContent,
      firstDisabled: !!bar.querySelector('.bws-pdf-first').disabled,
    };
  });
  if (/1\s+of\s+12/.test(backToFirst.counter) && backToFirst.firstDisabled)
    pass('V27: First jumps back to page 1');
  else fail(`V27: First did not reach page 1: ${JSON.stringify(backToFirst)}`);

  // ---------- T034: wrap-together subgroups (page-info · nav · utility) ----------
  // Structure: G1 counter alone; G2 first|prev|Jump-to|next|last (input in middle);
  // G3 fullscreen|print|download. At a narrow width the bar wraps BETWEEN groups and
  // never mid-group — each group stays on one visual row.
  const groupStruct = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const g = (cls) => Array.from(bar.querySelector('.' + cls)?.children || [])
      .map((c) => c.className.split(' ')[0]);
    return {
      info: g('bws-pdf-controls-info'),
      nav: g('bws-pdf-controls-nav'),
      util: g('bws-pdf-controls-utility'),
    };
  });
  const structOk = groupStruct.info.join() === 'bws-pdf-viewer-page-counter'
    && groupStruct.nav.join() === 'bws-pdf-first,bws-pdf-prev,bws-pdf-page-input,bws-pdf-next,bws-pdf-last'
    && groupStruct.util.join() === 'bws-pdf-fullscreen,bws-pdf-print,bws-pdf-download';
  if (structOk) pass('T034: groups = [counter] [first,prev,jump,next,last] [fs,print,dl]');
  else fail('T034: group structure wrong: ' + JSON.stringify(groupStruct));

  // Force the container narrow → the bar must wrap, each group intact on its own row.
  await page.evaluate(() => { document.getElementById('bws-pdf-flip').style.width = '380px'; });
  await page.waitForTimeout(400);
  const wrap = await page.evaluate(() => {
    const bar = document.querySelector('#bws-pdf-flip .bws-pdf-viewer-controls');
    const groups = Array.from(bar.querySelectorAll('.bws-pdf-controls-group'));
    const rowOf = (g) => Math.round(g.getBoundingClientRect().top);
    const intact = (g) => {
      const tops = Array.from(g.children).map((k) => Math.round(k.getBoundingClientRect().top));
      return Math.max(...tops) - Math.min(...tops) <= 3;
    };
    return { distinctRows: new Set(groups.map(rowOf)).size, allIntact: groups.every(intact) };
  });
  await page.evaluate(() => { document.getElementById('bws-pdf-flip').style.width = ''; });
  if (wrap.allIntact && wrap.distinctRows === 3) pass('T034: narrow bar wraps between groups, each group intact (3 rows)');
  else fail('T034: narrow wrap tore a group: ' + JSON.stringify(wrap));

  // ---------- Zero console errors ----------
  if (errors.length === 0) pass('zero JS console errors');
  else fail('JS errors: ' + JSON.stringify(errors));

  await page.close();
  await browser.close();

  let failed = 0;
  for (const [s, m] of results) { console.log(s + '  ' + m); if (s === 'FAIL') failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
