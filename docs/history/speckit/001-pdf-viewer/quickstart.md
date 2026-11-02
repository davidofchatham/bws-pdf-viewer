# Quickstart: Testing BWS PDF Viewer

**Branch**: `001-pdf-viewer`
**Date**: 2026-03-02

---

## Prerequisites

- Node.js installed (`node -v`)
- `npm install` already run in project root
- A local WordPress install available for integration testing

---

## Development Testing (Dev Server)

### 1. Start the dev server

```bash
npm run test
# Starts webpack-dev-server at http://localhost:8080 with live reload
```

### 2. Document mode — functional checks

Open the document-mode test page (e.g. `test/test-pdf-sp.js` or equivalent HTML page):

- [ ] First page visible within ~2 seconds
- [ ] Scrolling reveals subsequent pages (lazy loading via IntersectionObserver)
- [ ] Arrow Down / Page Down / Space → advances to next page
- [ ] Arrow Up / Page Up → goes to previous page
- [ ] Home → goes to first page; End → goes to last page
- [ ] Fullscreen button appears and expands viewer (check `show_fullscreen` toggle)
- [ ] Print button appears and opens browser print dialog (check `show_print` toggle)
- [ ] Page counter updates on navigation
- [ ] Loading indicator visible briefly before first page renders

### 3. Flipbook mode — functional checks

Open the flipbook test page (`test/test-pdf.js` or equivalent):

- [ ] Wide window (>767px): two-page spread visible
- [ ] Click right edge / next button → page-turn animation plays
- [ ] Resize window to ≤767px → switches to single-page layout
- [ ] Enable OS reduced-motion → no flip animation; fade or instant transition used instead
- [ ] Single-page PDF (1 page) → centred, full viewer width (no blank half)
- [ ] Loading indicator visible briefly before first spread renders

### 4. Keyboard and accessibility checks

Tab to the viewer container (or click it to set focus), then:

- [ ] ArrowRight / Space → next page
- [ ] ArrowLeft → previous page
- [ ] Home → page 1; End → last page
- [ ] Container has `role="document"` and visible focus ring
- [ ] With VoiceOver or NVDA: page changes announced (e.g. "Page 3 of 24")
- [ ] All buttons have accessible labels (inspect with browser a11y tools)

### 5. Error state check

Temporarily set the PDF URL to a broken path (e.g. `https://example.invalid/doc.pdf`):

- [ ] Viewer container remains visible (does not collapse)
- [ ] Error message displayed inside the container (`role="alert"`)
- [ ] "Open PDF directly" link present and opens correct URL in new tab

### 6. URL rewriting check (development)

Add a test filter temporarily in `includes/bws-pdf-viewer.js` or via a test plugin:

```php
add_filter( 'bws_pdf_viewer_pdf_url', function( $url ) {
    return add_query_arg( 'rewritten', '1', $url );
} );
```

- [ ] Check browser network tab: PDF request includes `?rewritten=1`
- [ ] Remove the test filter after verification

---

## WordPress Integration Testing

### 1. Build production assets

```bash
npm run start
# Outputs built files to /dist
```

### 2. Deploy to WordPress

Upload the following changed files (increment version string in `bws-pdf-viewer.php` first):

- `bws-pdf-viewer.php`
- `dist/flipbook-viewer.js`
- `dist/pdf.js`
- `dist/pdf.worker.js`
- `includes/bws-pdf-viewer.js`
- `includes/bws-pdf-viewer.css`
- `includes/admin.php`

Hard-refresh the browser (Ctrl+F5) after upload to clear cached assets.

### 3. Document mode shortcode

```
[bws_pdf view_mode="document" show_fullscreen="true" show_print="true"]
https://yoursite.com/sample.pdf
[/bws_pdf]
```

- [ ] Document viewer renders; first page appears quickly
- [ ] Fullscreen and print buttons visible and functional
- [ ] Navigation controls (prev/next/counter) present
- [ ] Keyboard navigation works when viewer is focused
- [ ] `aria-label` on container present (inspect element)

### 4. Flipbook mode shortcode

```
[bws_pdf view_mode="flipbook"]https://yoursite.com/sample.pdf[/bws_pdf]
```

- [ ] Two-page spread on desktop
- [ ] Single-page on mobile or narrow container (≤767px)
- [ ] Page-turn animation on navigation

### 5. Controls toggle check

```
[bws_pdf view_mode="document" show_fullscreen="false" show_print="false"]
https://yoursite.com/sample.pdf
[/bws_pdf]
```

- [ ] Only navigation controls visible; fullscreen and print buttons absent

### 6. Multiple instances on one page

Place two shortcodes in different column widths:

- [ ] Each viewer independently adapts layout based on its own container width
- [ ] No JavaScript errors in console
- [ ] Both viewers load and navigate independently

### 7. Admin settings (P3)

Open Settings → BWS PDF Viewer in WordPress admin:

- [ ] Set default `view_mode` to "flipbook" → new shortcodes with no mode use flipbook
- [ ] Disable flipbook mode → shortcode with `view_mode="flipbook"` renders document mode
- [ ] Disable document mode → shortcode with `view_mode="document"` renders flipbook mode
- [ ] Attempt to disable both modes → second checkbox is disabled (UI prevents it)
- [ ] Set default `show_print` to false → shortcode with no `show_print` attr hides print button

### 8. Cross-browser regression

Run checks 3 and 4 above in each:

- [ ] Chrome (latest, desktop)
- [ ] Firefox (latest, desktop)
- [ ] Safari 15+ (desktop, if available)
- [ ] Safari iOS 14 (real device or Xcode Simulator) — confirm single-page layout, no fullscreen button crash
- [ ] Edge (latest, desktop)

### 9. URL rewriting (multi-domain plugin, if available)

- [ ] With a multi-domain plugin active and `bws_pdf_viewer_pdf_url` filter registered:
      PDF request uses the rewritten URL in browser network tab
- [ ] All plugin assets (JS, CSS) load from the rewritten plugin base URL
- [ ] Console: no 404s for assets; no hardcoded domain references

---

## Quick Regression Baseline

Before any deployment, run this minimum check:

1. Load a WordPress page with `[bws_pdf]https://yoursite.com/sample.pdf[/bws_pdf]`
2. First page renders (no blank viewer)
3. Next button or arrow key navigates to page 2
4. No new console errors compared to the previous build
