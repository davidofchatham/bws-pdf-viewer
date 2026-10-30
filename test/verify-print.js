'use strict';
/**
 * Automated verification for V34 / B25 — Print button prints the PDF, not the host page.
 *
 * The PDF is served from a DIFFERENT origin (:8124, CORS on) than the page (:8123),
 * matching the portal case. Asserts:
 *   - window.print() (host page) is never called
 *   - a hidden aria-hidden iframe on a blob: URL receives contentWindow.print()
 *   - that blob holds the real PDF bytes (same length as the source file)
 *   - print() throwing → falls back to opening the blob in a new tab
 *   - no getData → falls back to opening config.pdf in a new tab
 *
 * contentWindow is stubbed: a headless run has no print dialog, and what we own is
 * the hand-off, not Chrome's PDF viewer.
 *
 * Usage (from repo root; serves :8123 and :8124 itself):
 *   node test/verify-print.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.resolve(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf' };

function serve(port, cors) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); return res.end();
      }
      const h = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
      if (cors) h['Access-Control-Allow-Origin'] = '*';
      res.writeHead(200, h);
      fs.createReadStream(file).pipe(res);
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

async function main() {
  const servers = [await serve(8123, false), await serve(8124, true)];
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  const fail = (m) => results.push(['FAIL', m]);
  const pass = (m) => results.push(['PASS', m]);
  const pdfLen = fs.statSync(path.join(ROOT, 'test', 'fp.pdf')).size;

  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.location().url.includes('favicon.ico')) errors.push(m.text());
  });

  // Capture every loaded PDFDocumentProxy (not exported by pdfjsLib) so a test can break getData.
  await page.addInitScript(() => {
    window.__pdfs = [];
    let lib;
    Object.defineProperty(window, 'pdfjsLib', {
      configurable: true,
      get() { return lib; },
      set(v) {
        // Proxy, not assignment: the lib's exports are getter-defined (read-only).
        const gd = v.getDocument;
        const wrapped = function () {
          const task = gd.apply(v, arguments);
          task.promise.then((pdf) => window.__pdfs.push(pdf));
          return task;
        };
        lib = new Proxy(v, { get: (t, k) => (k === 'getDocument' ? wrapped : t[k]) });
      },
    });
  });
  await page.goto('http://127.0.0.1:8123/test/harness-print.html', { waitUntil: 'load' });
  for (const id of ['bws-pdf-flip', 'bws-pdf-doc']) {
    await page.waitForSelector(`#${id} .bws-pdf-print`, { timeout: 20000 });
  }
  await page.waitForTimeout(800);

  // Install spies. contentWindow getter returns a recorder instead of the real window.
  await page.evaluate(() => {
    window.__log = { hostPrint: 0, framePrint: [], opened: [], throwOnPrint: false };
    window.print = () => { window.__log.hostPrint++; };
    window.open = (href) => { window.__log.opened.push(href); return null; };
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        const src = this.src;
        return {
          focus() {},
          print() {
            if (window.__log.throwOnPrint) throw new DOMException('blocked', 'SecurityError');
            window.__log.framePrint.push(src);
          },
        };
      },
    });
  });

  const reset = () => page.evaluate(() => {
    window.__log.hostPrint = 0; window.__log.framePrint = []; window.__log.opened = [];
    document.querySelectorAll('body > iframe').forEach((f) => f.remove());
  });

  // Precondition: PDF origin differs from page origin.
  const cross = await page.evaluate(() => {
    const cfg = JSON.parse(document.getElementById('bws-pdf-flip').dataset.config);
    return new URL(cfg.pdf).origin !== location.origin;
  });
  if (cross) pass('precondition: PDF host is cross-origin to the page');
  else fail('precondition: PDF host is same-origin — test proves nothing');

  for (const id of ['bws-pdf-flip', 'bws-pdf-doc']) {
    await reset();
    await page.click(`#${id} .bws-pdf-print`);
    await page.waitForFunction(() => window.__log.framePrint.length > 0, null, { timeout: 10000 })
      .catch(() => {});
    const r = await page.evaluate(async () => {
      const f = document.querySelector('body > iframe');
      const out = {
        hostPrint: window.__log.hostPrint,
        printed: window.__log.framePrint,
        opened: window.__log.opened,
        ariaHidden: f && f.getAttribute('aria-hidden'),
      };
      if (window.__log.framePrint[0]) {
        const buf = await (await fetch(window.__log.framePrint[0])).arrayBuffer();
        out.len = buf.byteLength;
        out.magic = new TextDecoder().decode(new Uint8Array(buf, 0, 5));
      }
      return out;
    });

    if (r.hostPrint === 0) pass(`${id}: host window.print() not called`);
    else fail(`${id}: host window.print() called ${r.hostPrint}x`);
    if (r.printed.length === 1 && r.printed[0].startsWith('blob:')) pass(`${id}: blob: iframe received print()`);
    else fail(`${id}: iframe print wrong: ${JSON.stringify(r)}`);
    if (r.ariaHidden === 'true') pass(`${id}: print iframe is aria-hidden`);
    else fail(`${id}: print iframe not aria-hidden`);
    if (r.magic === '%PDF-' && r.len === pdfLen) pass(`${id}: blob holds the real PDF (${r.len} bytes)`);
    else fail(`${id}: blob content wrong: ${JSON.stringify({ magic: r.magic, len: r.len, want: pdfLen })}`);
    if (r.opened.length === 0) pass(`${id}: no tab opened on the happy path`);
    else fail(`${id}: unexpected window.open: ${JSON.stringify(r.opened)}`);
  }

  // Fallback 1: iframe print() throws → blob opened in a tab.
  await reset();
  await page.evaluate(() => { window.__log.throwOnPrint = true; });
  await page.click('#bws-pdf-flip .bws-pdf-print');
  await page.waitForFunction(() => window.__log.opened.length > 0, null, { timeout: 10000 }).catch(() => {});
  const fb1 = await page.evaluate(() => window.__log.opened);
  if (fb1.length === 1 && fb1[0].startsWith('blob:')) pass('fallback: print() throws → blob opened in a tab');
  else fail('fallback: print() throw not handled: ' + JSON.stringify(fb1));
  await page.evaluate(() => { window.__log.throwOnPrint = false; });

  // Fallback 2: getData rejects → source URL opened in a tab.
  await reset();
  const fb2 = await page.evaluate(async () => {
    const bar = document.querySelector('#bws-pdf-doc .bws-pdf-print');
    const origs = window.__pdfs.map((p) => p.getData);
    window.__pdfs.forEach((p) => { p.getData = () => Promise.reject(new Error('boom')); });
    bar.click();
    await new Promise((r) => setTimeout(r, 500));
    window.__pdfs.forEach((p, i) => { p.getData = origs[i]; });
    return window.__log.opened;
  });
  if (fb2.length === 1 && fb2[0] === 'http://127.0.0.1:8124/test/fp.pdf') pass('fallback: getData rejects → config.pdf opened in a tab');
  else fail('fallback: getData rejection not handled: ' + JSON.stringify(fb2));

  if (errors.length === 0) pass('zero JS console errors');
  else fail('JS errors: ' + JSON.stringify(errors));

  await page.close();
  await browser.close();
  servers.forEach((s) => s.close());

  let failed = 0;
  for (const [s, m] of results) { console.log(s + '  ' + m); if (s === 'FAIL') failed++; }
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
