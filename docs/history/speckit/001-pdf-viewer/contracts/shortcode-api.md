# Contract: [bws_pdf] Shortcode API

**Version**: 1.0.0 (pre-deployment — breaking changes permitted with documentation)
**Defined in**: `bws-pdf-viewer.php` → `BWS_PDF_Viewer::shortcode_handler()`

---

## Format

```
[bws_pdf attr="value" ...]https://example.com/document.pdf[/bws_pdf]
```

The PDF source URL is the **shortcode content** (between opening and closing tags), not an
attribute. It MUST be a valid URL. Empty content returns an inline error message.

---

## Attributes

All attributes are optional. Resolution order for each:
1. Explicit shortcode attribute (highest priority)
2. Admin settings (`bws_pdf_viewer_options` WordPress option)
3. Plugin hardcoded defaults

| Attribute          | Type    | Default         | Accepted values                   | Description |
|--------------------|---------|-----------------|-----------------------------------|-------------|
| `view_mode`        | string  | admin / `document` | `document`, `flipbook`         | Display mode |
| `layout`           | string  | `auto`          | `auto`, `single`, `double`        | Page layout |
| `book_layout`      | string  | `traditional`   | `traditional`, `spread`           | First-page handling |
| `width`            | string  | `100%`          | Any CSS width value               | Container width |
| `height`           | string  | `auto`          | CSS value or `auto`               | Container height |
| `breakpoint`       | int     | `768`           | px value                          | Container width for single↔double switch |
| `background_color` | string  | `#353535`       | CSS colour                        | Viewer background colour |
| `box_color`        | string  | `#353535`       | CSS colour                        | Page box colour |
| `box_border`       | int     | `0`             | px value                          | Page border width |
| `margin`           | float   | `1`             | Numeric factor                    | Page margin factor |
| `margin_top`       | float   | `null`          | Numeric factor                    | Top margin override |
| `margin_left`      | float   | `null`          | Numeric factor                    | Left margin override |
| `show_controls`    | bool    | `true`          | `true`, `false`                   | Show navigation controls (prev/next/counter) |
| `show_fullscreen`  | bool    | admin / `true`  | `true`, `false`                   | Show fullscreen toggle button |
| `show_print`       | bool    | admin / `true`  | `true`, `false`                   | Show print button |
| `enable_animations`| bool    | `true`          | `true`, `false`                   | Allow flip animations (also governed by OS reduced-motion) |
| `force_native`     | string  | `null`          | `true`, `false`, omit             | Force native (PDF.js) or image sub-mode |

---

## Mode Governance

If an admin has disabled a view mode, the shortcode `view_mode` attribute is overridden:

- `view_mode="flipbook"` when flipbook is disabled → silently renders in document mode
- `view_mode="document"` when document is disabled → silently renders in flipbook mode
- At least one mode is always enabled (admin UI prevents disabling both)

---

## Boolean Attribute Values

PHP `filter_var($val, FILTER_VALIDATE_BOOLEAN)` is used. Truthy: `"true"`, `"1"`, `"yes"`,
`"on"`. Falsy: `"false"`, `"0"`, `"no"`, `"off"`. Other values treated as false.

---

## Breaking Changes from v3.0.0 (pre-deployment)

| Change | Old value | New value | Reason |
|--------|-----------|-----------|--------|
| `view_mode` value renamed | `"singlepage"` | `"document"` | Clearer editor-facing name |
| Attribute removed | `enable_portal_integration` | *(removed)* | Replaced by filter hooks |
| Attribute removed | `enable_search` | *(removed)* | Reserved for future feature |

---

## Examples

```
[bws_pdf]https://example.com/annual-report.pdf[/bws_pdf]

[bws_pdf view_mode="flipbook" show_fullscreen="true" show_print="false"]
https://example.com/product-catalog.pdf
[/bws_pdf]

[bws_pdf view_mode="document" layout="single" width="800px"]
https://example.com/technical-manual.pdf
[/bws_pdf]
```

---

## Error Output

**No PDF URL**: Returns `<p class="bws-pdf-viewer-error">Error: No PDF URL specified.</p>`
(inline, immediately, no assets enqueued).

**Load failure**: Viewer container rendered with `.bws-pdf-viewer-error` `role="alert"` div
containing error message + `<a>` link to open PDF directly in new tab. Container remains
visible at its configured width. (FR-014)
