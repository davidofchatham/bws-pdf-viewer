# Data Model: Integrated Viewer Toolbar

**Feature**: 002-integrated-viewer-toolbar | **Date**: 2026-07-07

No persisted data changes. All entities are runtime state in the browser.

## Toolbar

One per viewer instance. Owned by `addNavigationControls(viewerData)`.

| Field | Type | Rules |
|-------|------|-------|
| `controlsDiv` | HTMLElement | `role="toolbar"`, translatable `aria-label`; docked bottom, inside `viewerData.container` |
| controls | prevBtn, pageInput, pageCount, nextBtn, [fsBtn], [printBtn] | Optional controls present only when config enables them (FR-009); fsBtn absent when fullscreen unsupported (FR-010) |
| roving focus | tabindex management | Exactly one control has `tabindex="0"`; others `-1`; Arrow keys move focus (D6) |
| `_rebindViewer` | function | Existing hook; re-binds events after responsive reinit |

## Page Position

Shared, derived state — single source of truth is `viewerData.viewer`.

| Field | Type | Rules |
|-------|------|-------|
| `viewer.currentPage` | number (1-based) | Updated only by the `seen` handler (existing display-index conversion for flipbook retained) |
| `viewer.page_count` | number | Set by each viewer at init |
| sync rule | — | Any change flows: viewer `seen` event → `onSeen()` → pageInput.value, pageCount text, prev/next disabled state, `announcePageChange()` (FR-004, FR-007) |
| bounds | — | prev disabled at page 1; next disabled at page_count; single-page PDF: both disabled, input rejects ≠1 |

### Page-jump commit state machine

```
IDLE ──focus──► EDITING
EDITING ──Enter/blur──► VALIDATE
EDITING ──Escape──► IDLE (restore current page)
VALIDATE:
  non-numeric | empty ──► IDLE (restore current page, no navigation)
  in range [1, page_count] ──► NAVIGATE(n)
  out of range ──► NAVIGATE(clamp(n, 1, page_count))
NAVIGATE ──goToPage(n)──► viewer emits 'seen' ──► IDLE (field shows landed page)
```

## Viewer (internal interface — see contracts/viewer-api.md)

| Member | flipbook | document (native) | image (singlepage) |
|--------|----------|-------------------|--------------------|
| `flip_forward()` / `flip_back()` | existing | existing | existing |
| `goToPage(n)` | **NEW** (D3) | existing | **NEW** (D3) |
| `page_count` | existing | existing | existing |
| `on('seen')` payload | 0-based display index (existing) | 1-based page (existing) | 1-based page (existing) |
| `on('page-loaded')` | existing | existing | existing |

Constraint: `goToPage` additions are additive; no existing member's signature or event payload
changes (reuse-first, FR-016).

## Document-mode page rendering unit (nativepageviewer.js)

Per page container, after component adoption:

| Layer | Before | After |
|-------|--------|-------|
| canvas | `page.render()` (kept) | unchanged |
| text | hand-positioned spans | `TextLayerBuilder` instance; `.div` appended; `.cancel()` on cleanup |
| annotations | hand-positioned `<a>` rects | `AnnotationLayerBuilder` instance (shared `PDFLinkService`/`EventBus`); `.div` appended; `.cancel()` on cleanup |
| scale | implicit | `--scale-factor` CSS var set per container (D9) |

Lifecycle rules (unchanged): render when IntersectionObserver fires (200px rootMargin);
cleanup (canvas + both builders) when page is >5 from current view.
