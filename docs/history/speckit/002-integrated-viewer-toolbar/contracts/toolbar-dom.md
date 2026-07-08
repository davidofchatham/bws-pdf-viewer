# Contract: Toolbar DOM / ARIA

**Feature**: 002-integrated-viewer-toolbar
**Consumers**: theme authors (CSS targeting), automated harness (`test/verify-toolbar.js`),
assistive technology.

This contract is what tests assert and what site CSS may rely on. Class names are stable API.

## Structure

```html
<div class="bws-pdf-viewer-container">           <!-- existing container, flex column -->
  <!-- viewer area (canvas / pages) -->
  <div class="bws-pdf-viewer-controls"
       role="toolbar"
       aria-label="PDF viewer controls">          <!-- translatable -->
    <button type="button" class="bws-pdf-prev"    aria-label="Previous page">…</button>
    <span class="bws-pdf-viewer-page-nav">
      <input class="bws-pdf-page-input" type="text" inputmode="numeric" pattern="[0-9]*"
             aria-label="Page number" />
      <span class="bws-pdf-viewer-page-counter" aria-hidden="true">of 12</span>
    </span>
    <button type="button" class="bws-pdf-next"       aria-label="Next page">…</button>
    <button type="button" class="bws-pdf-fullscreen" aria-label="Enter fullscreen">…</button>
    <button type="button" class="bws-pdf-print"      aria-label="Print PDF">…</button>
  </div>
</div>
```

## Invariants

1. Toolbar is the last child of the viewer container and inside it (fullscreen inherits it).
2. `role="toolbar"` with non-empty `aria-label`; all labels pass through the plugin's
   translation mechanism.
3. Optional controls: `.bws-pdf-fullscreen` present only when config enables it AND the
   environment supports fullscreen (absent, never disabled). `.bws-pdf-print` present only when
   enabled. `show_controls="false"` → the entire `.bws-pdf-viewer-controls` element is absent.
4. Roving tabindex: exactly one toolbar control has `tabindex="0"` at any time; all others
   `tabindex="-1"`. ArrowLeft/ArrowRight move focus within the toolbar; Home/End go to
   first/last control. Arrow keys do NOT flip pages while focus is inside the toolbar.
5. Page input: value always equals current page except while the user is editing. Enter/blur
   commits per the state machine in data-model.md; Escape restores without navigating.
6. Fullscreen button label/text toggles between "Enter fullscreen"/"Exit fullscreen" on
   `fullscreenchange` (existing behaviour preserved).
7. Disabled state: `.bws-pdf-prev[disabled]` at page 1, `.bws-pdf-next[disabled]` at last page.
8. Page announcements: the existing `aria-live="polite"` announcement element and its
   "Page N of M" wording are unchanged by this feature.
9. Every control: minimum 24×24 CSS px target, `:focus-visible` outline ≥2px with ≥3:1
   contrast, AA contrast in default/hover/focus/disabled states.
10. The visible page-count text (`.bws-pdf-viewer-page-counter`) is `aria-hidden` because the
    input's accessible name plus the live announcements already convey position; screen readers
    are not double-fed.

## Back-compat notes

- `.bws-pdf-viewer-controls`, `.bws-pdf-prev`, `.bws-pdf-next`, `.bws-pdf-fullscreen`,
  `.bws-pdf-print` class names are unchanged from the current release.
- `.bws-pdf-viewer-page-counter` remains but is now display-only next to the new
  `.bws-pdf-page-input`.
- The bar moves from after-the-viewer to inside-the-container — sites that styled its outer
  margin may see spacing changes (documented in release notes; pre-deployment breaking-change
  allowance per constitution §III API Stability).
