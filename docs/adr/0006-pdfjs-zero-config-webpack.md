# ADR-0006 — PDF.js zero-config webpack integration

**Status:** accepted
**Cites:** I.php (build) · webpack.config.js

## Context

PDF.js needs a worker. Registering a "fake worker" or manually wiring the worker
path is fragile across domains and emits the "Setting up fake worker" warning.

## Decision

Use PDF.js's zero-config webpack entry: import `pdfjs-dist/webpack.mjs` (NOT
`pdfjs-dist/build/pdf.mjs`). The worker is auto-configured via
`GlobalWorkerOptions.workerPort` and bundled as a separate chunk named
`pdf.worker.js` (`chunkFilename`). Handle `.mjs` as `type: 'javascript/auto'`.

## Consequences

- No manual worker registration in WordPress; no fake-worker warning.
- The worker loads automatically via webpack's dynamic import — no separate
  script enqueue needed.
- Reference: https://github.com/mozilla/pdf.js/blob/master/examples/webpack/
