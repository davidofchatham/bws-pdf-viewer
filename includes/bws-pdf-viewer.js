/**
 * WordPress integration for BWS PDF Viewer
 * Bridges the [bws_pdf] shortcode configuration to the flipbook-viewer library.
 */

(function() {
    'use strict';

    // Track all active viewers — key: containerId, value: viewerData object
    const activeViewers = new Map();
    let currentFocusedViewer = null;

    // -------------------------------------------------------------------------
    // Localisation (T023)
    // -------------------------------------------------------------------------

    /**
     * Return the UI strings for toolbar controls. Strings are sourced from the
     * server-provided bwsPdfViewerData.i18n object (populated via wp_localize_script,
     * which runs them through WordPress translation) with English fallbacks so the
     * viewer works even if no i18n payload is present. No new i18n infrastructure is
     * invented here — this simply reads the existing localisation channel (reuse-first).
     */
    function getStrings() {
        const i18n = (window.bwsPdfViewerData && window.bwsPdfViewerData.i18n) || {};
        return {
            toolbarLabel:        i18n.toolbarLabel        || 'PDF viewer controls',
            prev:                i18n.prev                || 'Previous',
            prevLabel:           i18n.prevLabel           || 'Previous page',
            next:                i18n.next                || 'Next',
            nextLabel:           i18n.nextLabel           || 'Next page',
            of:                  i18n.of                  || 'of',
            pageNumberLabel:     i18n.pageNumberLabel     || 'Page number',
            jumpToLabel:         i18n.jumpToLabel         || 'Jump to page',
            jumpToPlaceholder:   i18n.jumpToPlaceholder   || 'Jump to…',
            fullscreen:          i18n.fullscreen          || 'Fullscreen',
            fullscreenLabel:     i18n.fullscreenLabel     || 'Enter fullscreen',
            exitFullscreen:      i18n.exitFullscreen      || 'Exit Fullscreen',
            exitFullscreenLabel: i18n.exitFullscreenLabel || 'Exit fullscreen',
            print:               i18n.print               || 'Print',
            printLabel:          i18n.printLabel          || 'Print PDF',
            download:            i18n.download            || 'Download',
            downloadLabel:      i18n.downloadLabel        || 'Download PDF',
            firstLabel:         i18n.firstLabel           || 'First page',
            lastLabel:          i18n.lastLabel            || 'Last page',
        };
    }

    // -------------------------------------------------------------------------
    // Toolbar icons (V30) — SVG glyphs adopted from PDF.js (pdfjs-dist/web/images,
    // Apache-2.0), inlined as strings so no separate asset is enqueued or fetched
    // cross-origin ([[portal-asset-origin-mismatch]]). The source `fill="black"` is
    // replaced with `currentColor` so each glyph inherits the toolbar's text color
    // (themes + meets AA contrast, V10); every SVG is aria-hidden + focusable=false
    // so a screen reader announces the button's aria-label, not the graphic.
    // prev/next/download/print/presentationMode are verbatim PDF.js paths; first/last
    // are drawn here (horizontal ⇤/⇥ double-chevron-to-bar) because PDF.js only ships
    // vertical-scroll first/last glyphs, wrong for a horizontal flipbook toolbar.
    // -------------------------------------------------------------------------
    const ICONS = {
        // Horizontal chevrons for prev/next (toolbar is horizontal; PDF.js pageUp/
        // pageDown glyphs are vertical). Drawn to match the PDF.js stroke weight.
        prev: '<path d="M10.5 3.5L6 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        next: '<path d="M5.5 3.5L10 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        // ⇤ : bar on the left, chevron pointing into it.
        first: '<path d="M3 3v10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 3.5L7.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        // ⇥ : bar on the right, chevron pointing into it.
        last: '<path d="M13 3v10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M4 3.5L8.5 8 4 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
        // PDF.js toolbarButton-download (verbatim paths, fill → currentColor).
        download: '<path d="M9.79407 7.31811H7.86307C7.41807 7.31811 7.19407 7.85711 7.50907 8.17211L10.1911 10.8541C10.3861 11.0491 10.7031 11.0491 10.8981 10.8541L13.5801 8.17211C13.8951 7.85711 13.6721 7.31811 13.2261 7.31811H11.2941V4.38211H11.2961V3.13211H11.2941V2.30811H9.79407V3.13211H9.79107V4.38211H9.79507V7.31811H9.79407Z" fill="currentColor"/><path d="M14 3.13208H12.796V4.38208H14C14.345 4.38208 14.625 4.66208 14.625 5.00708V13.0071C14.625 13.3521 14.345 13.6321 14 13.6321H2C1.655 13.6321 1.375 13.3521 1.375 13.0071V3.00708C1.375 2.66208 1.655 2.38208 2 2.38208H5.643C5.82 2.38208 5.989 2.45808 6.108 2.58908L7.536 4.17508C7.654 4.30708 7.823 4.38208 8 4.38208H8.291V3.13208H8.278L7.036 1.75208C6.681 1.35808 6.173 1.13208 5.642 1.13208H2C0.966 1.13208 0.125 1.97308 0.125 3.00708V13.0071C0.125 14.0411 0.966 14.8821 2 14.8821H14C15.034 14.8821 15.875 14.0411 15.875 13.0071V5.00708C15.875 3.97308 15.034 3.13208 14 3.13208Z" fill="currentColor"/>',
        // PDF.js toolbarButton-print (verbatim, fill → currentColor).
        print: '<path d="M13 4H12V2C12 1.46957 11.7893 0.960859 11.4142 0.585786C11.0391 0.210714 10.5304 0 10 0L6 0C5.46957 0 4.96086 0.210714 4.58579 0.585786C4.21071 0.960859 4 1.46957 4 2V4H3C2.46957 4 1.96086 4.21071 1.58579 4.58579C1.21071 4.96086 1 5.46957 1 6V11C1 11.5304 1.21071 12.0391 1.58579 12.4142C1.96086 12.7893 2.46957 13 3 13H4V14C4 14.5304 4.21071 15.0391 4.58579 15.4142C4.96086 15.7893 5.46957 16 6 16H10C10.5304 16 11.0391 15.7893 11.4142 15.4142C11.7893 15.0391 12 14.5304 12 14V13H13C13.5304 13 14.0391 12.7893 14.4142 12.4142C14.7893 12.0391 15 11.5304 15 11V6C15 5.46957 14.7893 4.96086 14.4142 4.58579C14.0391 4.21071 13.5304 4 13 4V4ZM10.75 14.15L10.15 14.75H5.85L5.25 14.15V10H10.75V14.15ZM10.75 4H5.25V1.85L5.85 1.25H10.15L10.75 1.85V4V4ZM13 7.6L12.6 8H11.4L11 7.6V6.4L11.4 6H12.6L13 6.4V7.6Z" fill="currentColor"/>',
        // PDF.js toolbarButton-presentationMode = our fullscreen glyph (verbatim).
        fullscreen: '<path d="M1.5 3C1.5 2.72421 1.72421 2.5 2 2.5H14C14.2758 2.5 14.5 2.72421 14.5 3V11C14.5 11.2758 14.2758 11.5 14 11.5H2C1.72421 11.5 1.5 11.2758 1.5 11V3ZM2 1C0.895786 1 0 1.89579 0 3V11C0 12.1042 0.895786 13 2 13H2.64979L1.35052 15.2499L2.64949 16L4.38194 13H11.6391L13.3715 16L14.6705 15.2499L13.3712 13H14C15.1042 13 16 12.1042 16 11V3C16 1.89579 15.1042 1 14 1H2ZM5.79501 4.64401V9.35601C5.79501 9.85001 6.32901 10.159 6.75701 9.91401L10.88 7.55801C11.312 7.31201 11.312 6.68901 10.88 6.44201L6.75701 4.08601C6.32801 3.84101 5.79501 4.15001 5.79501 4.64401Z" fill="currentColor"/>',
    };

    /**
     * Build an <svg> icon element for a button (V30). The SVG is aria-hidden and
     * non-focusable so the screen reader reads the button's aria-label, not the
     * graphic.
     * @param {string} name  Key into ICONS.
     * @returns {SVGElement}
     */
    function svgIcon(name) {
        const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        wrap.setAttribute('viewBox', '0 0 16 16');
        wrap.setAttribute('width', '16');
        wrap.setAttribute('height', '16');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.setAttribute('focusable', 'false');
        wrap.classList.add('bws-pdf-icon');
        wrap.innerHTML = ICONS[name] || '';
        return wrap;
    }

    // -------------------------------------------------------------------------
    // Toolbar roving focus — WAI-ARIA toolbar keyboard pattern (T018)
    // -------------------------------------------------------------------------

    /**
     * Implement the APG toolbar roving-tabindex pattern on a controls bar:
     * exactly one control is tabbable (tabindex 0), the rest are -1; ArrowLeft/Right
     * move focus within the toolbar (wrapping); Home/End jump to first/last.
     * The page-jump input is exempt while focused so arrows edit its value instead
     * of moving focus (research D6).
     */
    function setupToolbarRovingFocus(controlsDiv) {
        function items() {
            return Array.prototype.slice.call(
                controlsDiv.querySelectorAll('button, input')
            );
        }

        // The single tabbable control must be one that Tab can actually land on;
        // a disabled control with tabindex 0 is skipped by the browser, so if the
        // first control is disabled (e.g. Prev on page 1) the whole toolbar would
        // be unreachable by Tab until arrow navigation moved the roving index onto
        // an enabled control. Anchor tabindex 0 on the first ENABLED control, and
        // re-assert whenever disabled state changes (see resetRovingTabindex).
        function resetRovingTabindex() {
            const list = items();
            let anchor = list.findIndex(function(el) { return !el.disabled; });
            if (anchor === -1) anchor = 0; // all disabled — keep first as a fallback
            list.forEach(function(el, i) {
                el.setAttribute('tabindex', i === anchor ? '0' : '-1');
            });
        }
        resetRovingTabindex();
        // Expose so the counter/disabled-state updater can re-anchor the tab stop.
        controlsDiv._resetRovingTabindex = resetRovingTabindex;

        function focusAt(list, idx) {
            // Skip disabled controls when arrowing so focus never lands on one.
            const n = list.length;
            let clamped = (idx + n) % n;
            const step = idx >= 0 ? 1 : -1; // preserve direction of travel
            for (let tries = 0; tries < n && list[clamped].disabled; tries++) {
                clamped = (clamped + step + n) % n;
            }
            list.forEach(function(el) { el.setAttribute('tabindex', '-1'); });
            const target = list[clamped];
            target.setAttribute('tabindex', '0');
            target.focus();
        }

        // Does the page-input still have text to traverse in `dir` (-1 left / +1
        // right)? While it does, Left/Right/Home/End edit the field; once the caret
        // sits at the boundary the arrow is released to move toolbar focus, so the
        // input never traps the user (APG textbox-in-toolbar behaviour).
        function inputConsumesArrow(el, key) {
            if (!el.classList.contains('bws-pdf-page-input')) return false;
            const len = el.value.length;
            // Selection spanning text — let the field handle collapse/extend first.
            if (el.selectionStart !== el.selectionEnd) return true;
            const caret = el.selectionStart;
            if (key === 'Home') return caret > 0;
            if (key === 'End') return caret < len;
            if (key === 'ArrowLeft') return caret > 0;
            if (key === 'ArrowRight') return caret < len;
            return false;
        }

        controlsDiv.addEventListener('keydown', function(e) {
            // Let the page input own Left/Right/Home/End only while the caret can
            // still move that way; at the text boundary fall through to toolbar nav.
            if (inputConsumesArrow(e.target, e.key)) return;

            const list = items();
            const current = list.indexOf(e.target);
            if (current === -1) return;

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    focusAt(list, current + 1);
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    focusAt(list, current - 1);
                    break;
                case 'Home':
                    e.preventDefault();
                    focusAt(list, 0);
                    break;
                case 'End':
                    e.preventDefault();
                    focusAt(list, list.length - 1);
                    break;
            }
        });
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Initialize all PDF viewer containers found on the current page.
     */
    function initViewers() {
        const containers = document.querySelectorAll('.bws-pdf-viewer-container');
        containers.forEach(function(container) {
            try {
                const config = JSON.parse(container.dataset.config);
                initViewer(container, config);
            } catch (e) {
                showPdfError(container, 'Error reading viewer configuration: ' + e.message, '');
            }
        });
    }

    // -------------------------------------------------------------------------
    // Error helper (T010, T011)
    // -------------------------------------------------------------------------

    /**
     * Display a structured error inside the viewer container.
     * Removes any loading indicator first.
     * The container is NEVER cleared or hidden — it remains visible (FR-014).
     *
     * @param {HTMLElement} container
     * @param {string} message  Human-readable error description.
     * @param {string} pdfUrl   Original PDF URL for the "Open PDF directly" link.
     */
    function showPdfError(container, message, pdfUrl) {
        const loader = container.querySelector('.bws-pdf-viewer-loading');
        if (loader) loader.remove();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'bws-pdf-viewer-error';
        errorDiv.setAttribute('role', 'alert');

        const msg = document.createElement('p');
        msg.textContent = message;
        errorDiv.appendChild(msg);

        if (pdfUrl) {
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.textContent = 'Open PDF directly';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            const linkPara = document.createElement('p');
            linkPara.appendChild(link);
            errorDiv.appendChild(linkPara);
        }

        container.appendChild(errorDiv);
    }

    // -------------------------------------------------------------------------
    // Viewer initialisation
    // -------------------------------------------------------------------------

    /**
     * Initialise a single PDF viewer instance.
     *
     * @param {HTMLElement} container
     * @param {Object}      config    Parsed from data-config attribute.
     */
    function initViewer(container, config) {
        const containerId = container.id;

        // T008: Do NOT set GlobalWorkerOptions.workerSrc here.
        // The zero-config webpack approach (pdfjs-dist/webpack.mjs) configures the worker
        // automatically via GlobalWorkerOptions.workerPort. Manual overrides break this.

        // Respect OS reduced-motion preference (FR-012)
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const shouldAnimate = config.enableAnimations && !prefersReducedMotion;

        // T009: Mobile detection uses ≤767px (max-width: 767px) per constitution §II.
        // Previously was < 1024 — corrected to match admin-configurable breakpoint default (768).
        const capabilities = {
            hasTouch:    navigator.maxTouchPoints > 0,
            screenWidth: window.innerWidth,
            isMobile:    (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024) || window.innerWidth <= 767,
        };

        // Determine native (PDF.js layers) vs image rendering sub-mode (document mode only)
        let useNativeMode = false;
        if (config.forceNative === 'true' || config.forceNative === true) {
            useNativeMode = true;
        } else if (config.forceNative === 'false' || config.forceNative === false) {
            useNativeMode = false;
        } else {
            // Auto-detect: use native on desktop, image on mobile
            useNativeMode = !capabilities.isMobile && config.singlepage;
        }

        // Load the PDF document, then set up the viewer
        loadPDF(config.pdf, function(err, bookObj) {
            if (err) {
                showPdfError(container, 'Error loading PDF: ' + err, config.pdf);
                console.error('PDF Viewer load error:', err);
                return;
            }

            // T024: Single-page PDF in flipbook mode — force single layout so the page
            // is centred and fills the full canvas width (FR-002).
            let effectiveLayout = config.layout;
            let useTraditionalLayout = config.bookLayout === 'traditional';

            if (!config.singlepage && bookObj.numPages() === 1) {
                effectiveLayout = 'single';
                useTraditionalLayout = false; // skip blank-right-page wrapping for 1-page books
            }

            // Resolve auto layout based on current container width
            const containerWidth = container.offsetWidth;
            if (effectiveLayout === 'auto') {
                effectiveLayout = containerWidth >= config.breakpoint ? 'double' : 'single';
            }

            // Wrap book for traditional layout (page 1 alone as cover)
            const bookWrapper = createBookWrapper(bookObj, useTraditionalLayout);

            // Fetch page 1 once to learn the page aspect ratio, then compute canvas
            // dimensions from it. Needed so an 'auto'/unset height derives an exact
            // spread box (edge-to-edge, no letterbox) instead of a fixed 600 that
            // caps the spread width on wide containers (B16). getPage caches, so this
            // fetch is reused by the viewer's own first render.
            bookObj.getPage(1, function(pgErr, firstPage) {
                const pageAspect = (firstPage && firstPage.width && firstPage.height)
                    ? { w: firstPage.width, h: firstPage.height }
                    : null;
                continueInit(pageAspect);
            });

            function continueInit(pageAspect) {

            // Calculate canvas dimensions
            const dimensions = calculateDimensions(container, config, bookObj, effectiveLayout, undefined, pageAspect);

            // Options forwarded to the flipbook-viewer library
            const viewerOpts = {
                backgroundColor:   config.backgroundColor,
                boxColor:          config.boxColor,
                boxBorder:         config.boxBorder,
                margin:            config.margin,
                width:             dimensions.width,
                height:            dimensions.height,
                singlepage:        config.singlepage,
                traditionallayout: useTraditionalLayout,
                shouldAnimate:     shouldAnimate,  // T025: verified — flows to ctx.shouldAnimate in flipbookViewer
                nativeMode:        useNativeMode,
                capabilities:      capabilities,
            };

            if (config.marginTop !== null) viewerOpts.marginTop = config.marginTop;
            if (config.marginLeft !== null) viewerOpts.marginLeft = config.marginLeft;

            // viewerData is mutated during the lifetime of the viewer instance.
            // setupKeyboardNavigation reads viewerData.viewer each time a key is pressed
            // (T022), so responsive reinit only needs to update viewerData.viewer and the
            // controls — the keyboard/focus listeners remain attached.
            const viewerData = {
                viewer:            null, // filled in after flipbook.init() succeeds
                container:         container,
                config:            config,
                layout:            effectiveLayout,
                dimensions:        dimensions,
                bookWrapper:       bookWrapper,
                shouldAnimate:     shouldAnimate,
                useTraditionalLayout: useTraditionalLayout,
                pageAspect:        pageAspect, // page-1 aspect; reused on reinit for exact sizing
                reiniting:         false,
            };

            activeViewers.set(containerId, viewerData);

            // Set up keyboard and focus handlers once — they read viewerData.viewer
            // dynamically so they survive responsive reinit without being re-attached.
            setupKeyboardNavigation(containerId, viewerData);
            setupFocusDetection(container, containerId);

            // First-time viewer initialisation
            startViewer(viewerData, viewerOpts, function(err, viewer) {
                if (err) {
                    showPdfError(container, 'Error initialising viewer: ' + err, config.pdf);
                    console.error('PDF Viewer init error:', err);
                    return;
                }

                // T012: Remove loading indicator after successful initialisation
                const loader = container.querySelector('.bws-pdf-viewer-loading');
                if (loader) loader.remove();

                viewerData.viewer = viewer;

                // T020: Controls shown for ALL viewer modes when showControls is enabled.
                // Previous code incorrectly gated this on config.singlepage, hiding controls
                // in flipbook mode entirely.
                if (config.showControls !== false) {
                    addNavigationControls(viewerData);
                }

                setupResponsiveBehavior(containerId, viewerData, viewerOpts);

                console.log('PDF Viewer initialised:', containerId, useNativeMode ? '(native mode)' : '(image/flipbook mode)');
            });

            } // end continueInit
        });
    }

    /**
     * Call flipbook.init() and return the viewer via callback.
     * Extracted so responsive reinit can reuse it.
     *
     * @param {Object}   viewerData
     * @param {Object}   opts        Options for flipbook.init()
     * @param {Function} cb          (err, viewer)
     */
    function startViewer(viewerData, opts, cb) {
        flipbook.init(viewerData.bookWrapper, viewerData.container, opts, cb);
    }

    // -------------------------------------------------------------------------
    // Navigation controls (T014, T015, T016, T020, T021)
    // -------------------------------------------------------------------------

    /**
     * Build and append the navigation controls bar to the viewer container.
     * Called after successful initialisation and after each responsive reinit.
     *
     * @param {Object} viewerData  Mutable viewer state object.
     */
    function addNavigationControls(viewerData) {
        const { container, config } = viewerData;

        const t = getStrings();

        // V6: page-nav group is context-dependent. Hide prev/next + page-input +
        // counter when navigation is meaningless — continuous/document mode (all
        // pages stacked/scrolled) or when there is only ONE spread to show. The gate
        // keys off SPREAD count, not page count (B23): a 2-page plain book packs into
        // a single [p1|p2] spread with nothing to navigate, so its nav is hidden even
        // though it has >1 page. Fullscreen/print are unaffected.
        const wrapper = viewerData.bookWrapper;
        const spreadCount = (wrapper && typeof wrapper.numSpreads === 'function')
            ? wrapper.numSpreads()
            : (wrapper ? wrapper.numPages() : 0);
        const showPageNav = !config.singlepage && spreadCount > 1;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'bws-pdf-viewer-controls';
        // T010: WAI-ARIA toolbar semantics (toolbar-dom.md invariant 2)
        controlsDiv.setAttribute('role', 'toolbar');
        controlsDiv.setAttribute('aria-label', t.toolbarLabel);

        // --- Previous button ---
        const prevBtn = document.createElement('button');
        prevBtn.className = 'bws-pdf-prev';
        // Icon + text (V30): glyph first, then the visible label in a span so the
        // icon and word sit side by side. aria-label still names the button for SR.
        prevBtn.appendChild(svgIcon('prev'));
        prevBtn.appendChild(document.createTextNode(' '));
        var prevLabelSpan = document.createElement('span');
        prevLabelSpan.className = 'bws-pdf-btn-text';
        prevLabelSpan.textContent = t.prev;
        prevBtn.appendChild(prevLabelSpan);
        prevBtn.setAttribute('aria-label', t.prevLabel);
        prevBtn.setAttribute('title', t.prevLabel);
        prevBtn.setAttribute('type', 'button');

        prevBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.flip_back) viewer.flip_back();
            else if (viewer && viewer.goToPage) {
                const cur = Number(viewer.currentPage) || 1;
                if (cur > 1) viewer.goToPage(cur - 1);
            }
        });

        // --- Page-nav group: range counter + write-only "Jump to" input (V11/V33) ---
        // The counter (display-only) shows the spread's visible page RANGE; the input
        // is a write-only jump target that clears after commit and never mirrors the
        // current page. Counter first, then input, so the display reads left-to-right
        // "2–3 of 6  [Jump to…]".
        const pageNav = document.createElement('span');
        pageNav.className = 'bws-pdf-viewer-page-nav';

        // Display-only range counter ("N–M of T"). Not aria-live; announcements come
        // from the dedicated SR live region (toolbar-dom.md invariants 8 and 10).
        const pageCounter = document.createElement('span');
        pageCounter.className = 'bws-pdf-viewer-page-counter';
        pageCounter.setAttribute('aria-hidden', 'true');

        const pageInput = document.createElement('input');
        pageInput.className = 'bws-pdf-page-input';
        pageInput.setAttribute('type', 'text');
        pageInput.setAttribute('inputmode', 'numeric');
        pageInput.setAttribute('pattern', '[0-9]*');
        pageInput.setAttribute('aria-label', t.jumpToLabel);
        pageInput.setAttribute('placeholder', t.jumpToPlaceholder);

        pageNav.appendChild(pageCounter);
        pageNav.appendChild(pageInput);

        // --- Next button ---
        const nextBtn = document.createElement('button');
        nextBtn.className = 'bws-pdf-next';
        // Icon + text (V30): visible label span, then glyph \u2014 mirror of prev so the
        // arrow points outward on the trailing edge.
        var nextLabelSpan = document.createElement('span');
        nextLabelSpan.className = 'bws-pdf-btn-text';
        nextLabelSpan.textContent = t.next;
        nextBtn.appendChild(nextLabelSpan);
        nextBtn.appendChild(document.createTextNode(' '));
        nextBtn.appendChild(svgIcon('next'));
        nextBtn.setAttribute('aria-label', t.nextLabel);
        nextBtn.setAttribute('title', t.nextLabel);
        nextBtn.setAttribute('type', 'button');

        nextBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.flip_forward) viewer.flip_forward();
            else if (viewer && viewer.goToPage) {
                const cur = Number(viewer.currentPage) || 1;
                if (cur < viewer.page_count) viewer.goToPage(cur + 1);
            }
        });

        // --- First / Last page buttons (icon-only, V30/V6/V27) ---
        // Part of the page-nav group: only assembled when showPageNav (flipbook
        // multi-page). Jump straight to page 1 / last page via the viewer's goToPage
        // (I.flip maps page→spread). Disable at the corresponding edge (First on
        // page 1, Last on page_count) — updateCounter drives this alongside prev/next.
        const firstBtn = document.createElement('button');
        firstBtn.className = 'bws-pdf-first';
        firstBtn.appendChild(svgIcon('first'));
        firstBtn.setAttribute('aria-label', t.firstLabel);
        firstBtn.setAttribute('title', t.firstLabel);
        firstBtn.setAttribute('type', 'button');
        firstBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.goToPage) viewer.goToPage(1);
        });

        const lastBtn = document.createElement('button');
        lastBtn.className = 'bws-pdf-last';
        lastBtn.appendChild(svgIcon('last'));
        lastBtn.setAttribute('aria-label', t.lastLabel);
        lastBtn.setAttribute('title', t.lastLabel);
        lastBtn.setAttribute('type', 'button');
        lastBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.goToPage) viewer.goToPage(viewer.page_count || 1);
        });

        // --- "Jump to" commit (V11) ---
        // Write-only field: it never mirrors the current page, so there is no live
        // sync to guard and nothing to "restore" — every commit path just clears it.
        function commitPageInput() {
            const viewer = viewerData.viewer;
            const raw = pageInput.value.trim();
            pageInput.value = ''; // clears on every commit, valid or not (V11)
            if (!viewer || !viewer.goToPage) return;

            const n = parseInt(raw, 10);
            if (raw === '' || isNaN(n)) return; // empty / non-numeric → no navigation

            const total = viewer.page_count || 1;
            const clamped = Math.max(1, Math.min(n, total)); // clamp-on-jump (V11)
            viewer.goToPage(clamped);
        }

        pageInput.addEventListener('blur', commitPageInput);
        pageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitPageInput();
                pageInput.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                pageInput.value = ''; // abandon the jump, clear the field
                pageInput.blur();
            }
        });

        // The real pages visible in the current spread, as [low, high] (V33). Updated
        // by onSeen from the landed spread's two slots; drives the range counter. The
        // internal currentPage (rightmost, for gating) is tracked separately.
        let spreadRange = null;

        // Format the spread range for display (V33): "N–M of T" for a two-page spread,
        // "N of T" for a lone real page. Falls back to the single current page when no
        // range has been captured yet (e.g. first paint before the first 'seen').
        function formatCounter(current, total) {
            let lo = current, hi = current;
            if (spreadRange) { lo = spreadRange[0]; hi = spreadRange[1]; }
            const pages = (lo === hi) ? String(lo) : (lo + '–' + hi); // en-dash
            return pages + ' ' + t.of + ' ' + total;
        }

        // Counter update: reads from viewerData.viewer each call so it stays correct
        // after responsive reinit replaces the viewer instance.
        function updateCounter() {
            if (!showPageNav) return; // nav hidden — nothing to sync
            const viewer = viewerData.viewer;
            const current = (viewer && viewer.currentPage) || 1;
            const total   = (viewer && viewer.page_count) || 0;
            pageCounter.textContent = formatCounter(current, total);
            prevBtn.disabled  = current <= 1;
            firstBtn.disabled = current <= 1;
            nextBtn.disabled  = current >= total;
            lastBtn.disabled  = current >= total;
            // Disabled state just changed; if the current tab stop is now on a
            // disabled control (e.g. Prev on page 1), hand tabindex 0 to an enabled
            // sibling so the toolbar stays reachable by Tab. Only re-anchor when no
            // toolbar control is focused, so we never steal the roving index out
            // from under a keyboard user mid-navigation.
            if (controlsDiv._resetRovingTabindex &&
                !controlsDiv.contains(document.activeElement)) {
                controlsDiv._resetRovingTabindex();
            }
        }

        // T021: Flipbook viewer emits 'seen' with a display-slot index, once per
        // visible page (left then right of the current spread). showPages renders
        // slot S as book.getPage(S) — and getPage treats its argument as a 1-based
        // PDF page in BOTH layouts, so the emitted slot IS the PDF page number, with
        // two exceptions: slot 0 is the traditional cover (PDF page 1), and any slot
        // that maps to a blank/out-of-range filler (traditional slot 1; a trailing
        // slot past the last page) is not a real page.
        //
        // We report the RIGHTMOST real page of the current spread as currentPage so
        // the last spread reaches page_count — otherwise Next never disables and the
        // counter under-reads on the final spread of an even-page book. Left emits
        // before right, so taking each emit as it arrives naturally lands on the
        // right page; slot 0 maps to page 1 and any over-count slot is clamped.
        function slotToPage(slot) {
            const v = viewerData.viewer;
            const total = (v && v.page_count) || Infinity;
            const bw = viewerData.bookWrapper;
            // The wrapper owns the slot→page mapping (it knows traditional vs plain
            // packing — B23). A blank/filler slot maps to 0; keep the last real page
            // in that case so the counter doesn't jump to a phantom page.
            if (bw && typeof bw.slotToPage === 'function') {
                const page = bw.slotToPage(slot);
                return page > 0 ? Math.min(page, total) : (v && v.currentPage) || 1;
            }
            const page = slot < 1 ? 1 : slot; // slot 0 → cover (page 1); else slot == page
            return Math.min(page, total);     // clamp trailing blank/over-count slots
        }

        // Real pages visible in the spread that owns display slot `slot` (V33). The
        // spread's two slots are floor(slot/2)*2 and +1; map each to a real page,
        // drop blanks (slotToPage → 0 for a filler/cover-blank half), and return
        // [low, high] — collapsing to [p,p] when only one half is real (cover,
        // trailing-odd, 1-page book). Uses the WP-side slotToPage below, which
        // delegates to the wrapper's packing-aware mapping (V28).
        function spreadPagesFor(slot) {
            const base = Math.floor(slot / 2) * 2;
            const bw = viewerData.bookWrapper;
            const raw = bw && typeof bw.slotToPage === 'function';
            const pageOf = function(s) {
                return raw ? bw.slotToPage(s) : (s < 1 ? 1 : s);
            };
            const pages = [pageOf(base), pageOf(base + 1)]
                .filter(function(p) { return p > 0; }); // drop blank/filler halves
            if (!pages.length) return null;
            const total = (viewerData.viewer && viewerData.viewer.page_count) || Infinity;
            const clamped = pages.map(function(p) { return Math.min(p, total); });
            return [Math.min.apply(null, clamped), Math.max.apply(null, clamped)];
        }

        function onSeen(displayIndexOrPageNum) {
            const viewer = viewerData.viewer;
            if (!viewer) return;

            if (config.singlepage) {
                // Document / native mode: event already emits 1-based page number.
                // No spread range here (page-nav is hidden in this mode — V6).
                viewer.currentPage = displayIndexOrPageNum;
                spreadRange = null;
            } else {
                // Flipbook mode: event emits a 0-based display-slot index. currentPage
                // stays the RIGHTMOST real page (gating — V33); the visible range is
                // derived separately from the spread's two slots.
                viewer.currentPage = slotToPage(displayIndexOrPageNum);
                spreadRange = spreadPagesFor(displayIndexOrPageNum);
            }

            updateCounter();
            announcePageChange(container, viewer.currentPage, viewer.page_count);
        }

        // Wire up viewer event — detached and re-attached on reinit by replacing controls
        function bindViewerEvents() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.on) {
                viewer.on('seen', onSeen);
                viewer.on('page-loaded', updateCounter);
            }
        }

        bindViewerEvents();

        // Re-bind when viewer is replaced (responsive reinit sets viewerData.viewer)
        // We expose a rebind helper on the controlsDiv for the reinit path to call.
        controlsDiv._rebindViewer = bindViewerEvents;

        // --- Fullscreen button (T014, T016) ---
        if (config.showFullscreen !== false) {
            const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
            if (fsEnabled) {
                const fsBtn = document.createElement('button');
                fsBtn.className = 'bws-pdf-fullscreen';
                fsBtn.setAttribute('type', 'button');
                // Initialise the label from the CURRENT fullscreen state, not a fixed
                // default: the fullscreen relayout rebuilds this toolbar while already
                // in fullscreen, and no fresh fullscreenchange fires for the new button,
                // so a hardcoded "Fullscreen" would wrongly persist mid-fullscreen.
                const startFs = (document.fullscreenElement === container ||
                                 document.webkitFullscreenElement === container);
                // Icon-only (V30): no visible text; aria-label + title carry the name,
                // both toggled with fullscreen state. The glyph is constant.
                fsBtn.appendChild(svgIcon('fullscreen'));
                fsBtn.setAttribute('aria-label', startFs ? t.exitFullscreenLabel : t.fullscreenLabel);
                fsBtn.setAttribute('title', startFs ? t.exitFullscreenLabel : t.fullscreenLabel);

                fsBtn.addEventListener('click', function() {
                    if (document.fullscreenElement || document.webkitFullscreenElement) {
                        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
                    } else {
                        (container.requestFullscreen || container.webkitRequestFullscreen).call(container);
                    }
                });

                // T016/T021: Update button label when fullscreen state changes
                var onFsChange = function() {
                    const isFs = (document.fullscreenElement === container || document.webkitFullscreenElement === container);
                    fsBtn.setAttribute('aria-label', isFs ? t.exitFullscreenLabel : t.fullscreenLabel);
                    fsBtn.setAttribute('title', isFs ? t.exitFullscreenLabel : t.fullscreenLabel);
                };
                document.addEventListener('fullscreenchange', onFsChange);
                document.addEventListener('webkitfullscreenchange', onFsChange);

                // Detach on teardown (reinit removes this controlsDiv) so document-level
                // listeners don't accumulate across responsive reinit cycles.
                controlsDiv._teardown = function() {
                    document.removeEventListener('fullscreenchange', onFsChange);
                    document.removeEventListener('webkitfullscreenchange', onFsChange);
                };

                controlsDiv.appendChild(fsBtn);
            }
        }

        // --- Print button (icon-only, V30) ---
        if (config.showPrint !== false) {
            const printBtn = document.createElement('button');
            printBtn.className = 'bws-pdf-print';
            printBtn.appendChild(svgIcon('print'));
            printBtn.setAttribute('aria-label', t.printLabel);
            printBtn.setAttribute('title', t.printLabel);
            printBtn.setAttribute('type', 'button');
            printBtn.addEventListener('click', function() { window.print(); });
            controlsDiv.appendChild(printBtn);
        }

        // --- Download button (icon-only, V30/V32) ---
        // Present in ALL modes (download is meaningful even for a 1-page/continuous
        // doc, unlike page-nav — V6). Downloads the already-resolved source URL;
        // no cross-origin re-fetch. `download` attr requests a save rather than a
        // navigation; cross-origin hosts may ignore the filename hint but the click
        // still opens/saves the PDF (rel=noopener for the new-context fallback).
        if (config.showDownload !== false && config.pdf) {
            const dlBtn = document.createElement('button');
            dlBtn.className = 'bws-pdf-download';
            dlBtn.appendChild(svgIcon('download'));
            dlBtn.setAttribute('aria-label', t.downloadLabel);
            dlBtn.setAttribute('title', t.downloadLabel);
            dlBtn.setAttribute('type', 'button');
            dlBtn.addEventListener('click', function() {
                const a = document.createElement('a');
                a.href = config.pdf;
                a.download = '';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });
            controlsDiv.appendChild(dlBtn);
        }

        // T015/T030: Assemble page-nav group order: first | prev | page-nav | next | last,
        // ahead of the trailing utility buttons (fullscreen/print/download appended above).
        // Prepend in reverse so the final leading order is first, prev, pageNav, next, last.
        // V6: page-nav group only when navigation is meaningful (flipbook multi-page).
        if (showPageNav) {
            controlsDiv.insertBefore(lastBtn, controlsDiv.firstChild);
            controlsDiv.insertBefore(nextBtn, controlsDiv.firstChild);
            controlsDiv.insertBefore(pageNav, controlsDiv.firstChild);
            controlsDiv.insertBefore(prevBtn, controlsDiv.firstChild);
            controlsDiv.insertBefore(firstBtn, controlsDiv.firstChild);
        }

        // Nothing to show (nav hidden + fullscreen/print/download all off/unsupported) —
        // skip the empty bar rather than render a bare dark strip.
        if (!controlsDiv.firstChild) return null;

        // T018: roving tabindex — first control focusable, rest -1; arrows move focus.
        setupToolbarRovingFocus(controlsDiv);

        // T032/V31: dock by presentation mode. Document/flow (config.singlepage) puts
        // the bar ABOVE the pages; flip/book puts it BELOW. Real DOM move (⊥ CSS order)
        // so DOM order stays the reading + Tab order (V27).
        dockToolbar(container, controlsDiv, config);
        updateCounter();

        return controlsDiv;
    }

    /**
     * Dock the toolbar above (document/flow mode) or below (flip/book mode) the
     * viewer pages, by moving the real DOM node (V31). Idempotent — used both on
     * first build and when the fullscreen relayout rebuilds the toolbar (V22), so
     * the dock is re-applied correctly after a rebuild.
     * @param {HTMLElement} container
     * @param {HTMLElement} controlsDiv
     * @param {Object}      config
     */
    function dockToolbar(container, controlsDiv, config) {
        if (config.singlepage) {
            container.insertBefore(controlsDiv, container.firstChild);
        } else {
            container.appendChild(controlsDiv);
        }
    }

    // -------------------------------------------------------------------------
    // Responsive behaviour (T023)
    // -------------------------------------------------------------------------

    /**
     * Watch the container with ResizeObserver and reinitialise the viewer canvas
     * if the layout (single ↔ double page spread) needs to change.
     *
     * Flipbook mode with layout='auto' only. Document mode (native + image) is
     * skipped: its canvases reflow via CSS max-width:100%, and reinitViewer's
     * single-canvas teardown cannot clean up its many page containers/observers.
     *
     * @param {string} containerId
     * @param {Object} viewerData
     * @param {Object} initialOpts  Original viewerOpts used during first init.
     */
    function setupResponsiveBehavior(containerId, viewerData, initialOpts) {
        const { container, config } = viewerData;

        // Reinit is a flipbook-only concern: it swaps the single <canvas>'s dimensions
        // when the single↔double spread layout changes. Document mode (native and image
        // sub-modes) reflows via CSS (max-width: 100%) and its scroll-based viewers render
        // many page containers plus IntersectionObservers that reinitViewer's single-canvas
        // teardown does not clean up — so never reinit those modes.
        if (config.singlepage) return;

        // V22: relayout the flipbook when entering/exiting fullscreen so the canvas
        // rescales to the fullscreen dimensions instead of keeping its pre-fullscreen
        // pixel size stuck top-left (B10). Attached for BOTH auto and fixed layouts —
        // fixed layouts don't reflow on width via the ResizeObserver below, but the
        // canvas still must rescale to the fullscreen size. Document mode is exempt
        // (returned above): it reflows via CSS max-width:100%.
        // Track whether THIS container is the fullscreen element across events.
        // document.fullscreenElement is page-global, so on an exit event it is null
        // regardless of which viewer just exited; without a local flag we cannot
        // tell our own exit from an unrelated viewer's exit and would reinit every
        // flipbook on the page whenever any one of them left fullscreen (B-fs-scope).
        let wasThisFs = false;
        const onFullscreenRelayout = function() {
            const isFs = (document.fullscreenElement === container ||
                          document.webkitFullscreenElement === container);
            // Act only on transitions of THIS container: entering its own fullscreen,
            // or exiting while it was the fullscreen element. An unrelated viewer's
            // fullscreenchange leaves both isFs and wasThisFs false → ignored.
            const relevant = isFs || wasThisFs;
            wasThisFs = isFs;
            if (!relevant) return;

            // Defer two frames so the browser has fully applied the fullscreen box
            // size before we read container dimensions. A single rAF can fire before
            // layout settles on high-DPI/4K displays, yielding pre-fullscreen width
            // and a small canvas with black gaps around it (B13). Double-rAF reads
            // after the fullscreen relayout has committed.
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    if (viewerData.reiniting) return;
                    const width = container.offsetWidth;
                    const targetLayout = (config.layout === 'auto')
                        ? (width >= config.breakpoint ? 'double' : 'single')
                        : viewerData.layout;
                    reinitViewer(containerId, viewerData, targetLayout, initialOpts);
                });
            });
        };
        document.addEventListener('fullscreenchange', onFullscreenRelayout);
        document.addEventListener('webkitfullscreenchange', onFullscreenRelayout);
        viewerData.fullscreenRelayoutTeardown = function() {
            document.removeEventListener('fullscreenchange', onFullscreenRelayout);
            document.removeEventListener('webkitfullscreenchange', onFullscreenRelayout);
        };

        if (config.layout !== 'auto') return; // fixed layout — no single↔double observer

        if (typeof ResizeObserver === 'undefined') {
            console.warn('ResizeObserver not supported — responsive layout adaptation disabled');
            return;
        }

        let debounceTimer = null;

        const observer = new ResizeObserver(function(entries) {
            for (const entry of entries) {
                const containerWidth = entry.contentRect.width;
                const newLayout = containerWidth >= config.breakpoint ? 'double' : 'single';

                if (newLayout === viewerData.layout) continue; // no change needed

                // Debounce to avoid excessive reinits during drag-resize
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function() {
                    if (viewerData.reiniting) return;
                    reinitViewer(containerId, viewerData, newLayout, initialOpts);
                }, 150);
            }
        });

        observer.observe(container);
        viewerData.resizeObserver = observer;
    }

    /**
     * Tear down the existing flipbook canvas and controls, then reinitialise
     * with updated dimensions for the new layout.
     *
     * Keyboard, focus, and resize listeners are NOT re-attached — they read
     * viewerData.viewer dynamically and survive reinit automatically (T022).
     *
     * @param {string} containerId
     * @param {Object} viewerData
     * @param {string} newLayout   'single' or 'double'
     * @param {Object} baseOpts    Original viewer options to clone and update.
     */
    function reinitViewer(containerId, viewerData, newLayout, baseOpts) {
        const { container, config } = viewerData;
        viewerData.reiniting = true;

        // T026: capture current page BEFORE teardown so we can restore reading
        // position on the new viewer instance (FR-011, research D8).
        const savedPage = (viewerData.viewer && viewerData.viewer.currentPage) || 1;

        // Remove existing canvas (flipbook renders into a <canvas> element)
        const oldCanvas = container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();

        // Remove existing controls bar — new one will be added after reinit.
        // V22: capture its height first so the fullscreen relayout can reserve
        // room for the toolbar (it's a flex-column sibling of the canvas; the new
        // bar isn't in the DOM yet when dimensions are computed below).
        const oldControls = container.querySelector('.bws-pdf-viewer-controls');
        if (oldControls) {
            viewerData.toolbarHeight = oldControls.offsetHeight || viewerData.toolbarHeight || 0;
            if (typeof oldControls._teardown === 'function') oldControls._teardown();
            oldControls.remove();
        }

        // Temporarily re-show loading indicator
        let loader = container.querySelector('.bws-pdf-viewer-loading');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'bws-pdf-viewer-loading';
            loader.innerHTML = '<span>Loading\u2026</span>';
            container.appendChild(loader);
        }

        // Recalculate dimensions for the new layout (V22: reserve the captured
        // toolbar height so the fullscreen canvas leaves room for the docked bar).
        const newDimensions = calculateDimensions(container, config, viewerData.bookWrapper, newLayout, viewerData.toolbarHeight, viewerData.pageAspect);

        const newOpts = Object.assign({}, baseOpts, {
            width:  newDimensions.width,
            height: newDimensions.height,
        });

        viewerData.layout     = newLayout;
        viewerData.dimensions = newDimensions;

        startViewer(viewerData, newOpts, function(err, newViewer) {
            if (loader) loader.remove();
            viewerData.reiniting = false;

            if (err) {
                showPdfError(container, 'Error reinitialising viewer: ' + err, config.pdf);
                return;
            }

            // Update the shared viewer reference — keyboard handler picks this up automatically
            viewerData.viewer = newViewer;

            if (config.showControls !== false) {
                addNavigationControls(viewerData);
            }

            // T026: restore reading position on the new viewer instance.
            if (savedPage > 1 && newViewer && newViewer.goToPage) {
                newViewer.goToPage(savedPage);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Keyboard navigation (T017, T018, T022)
    // -------------------------------------------------------------------------

    /**
     * Attach keyboard navigation to the container.
     *
     * T022: Uses viewerData.viewer (object property access) rather than closing over
     * a local `viewer` variable — this means responsive reinit only needs to update
     * viewerData.viewer for the handler to immediately use the new viewer.
     *
     * @param {string} containerId
     * @param {Object} viewerData
     */
    function setupKeyboardNavigation(containerId, viewerData) {
        const { container } = viewerData;

        if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '0');
        container.setAttribute('role', 'document');
        container.setAttribute('aria-label', 'PDF viewer, ' + (viewerData.bookWrapper ? viewerData.bookWrapper.numPages() : '') + ' pages');

        container.addEventListener('keydown', function(e) {
            if (currentFocusedViewer !== containerId) return;

            // T019: events originating inside the toolbar are handled by the toolbar's
            // own roving-focus / page-input logic — do not also flip pages here
            // (resolves the arrows-flip-pages conflict, research D6).
            if (e.target.closest && e.target.closest('.bws-pdf-viewer-controls')) return;

            const viewer = viewerData.viewer; // T022: read dynamically — survives reinit
            if (!viewer) return;

            switch (e.key) {
                // T017: ArrowDown added as alias for document-mode vertical navigation
                case 'ArrowRight':
                case 'ArrowDown':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    // Flipbook/native expose flip_forward; the image single-page viewer
                    // exposes only goToPage, so fall back to a ±1 page jump — otherwise
                    // arrow/space/pgdn silently no-op in mobile document mode.
                    if (viewer.flip_forward) {
                        viewer.flip_forward();
                        // T018: Announce page change to screen readers after navigation
                        // (page number update happens asynchronously via 'seen' event)
                    } else if (viewer.goToPage) {
                        viewer.goToPage((Number(viewer.currentPage) || 1) + 1);
                    }
                    break;

                // T017: ArrowUp added as alias for document-mode vertical navigation
                case 'ArrowLeft':
                case 'ArrowUp':
                case 'PageUp':
                    e.preventDefault();
                    if (viewer.flip_back) {
                        viewer.flip_back();
                    } else if (viewer.goToPage) {
                        viewer.goToPage((Number(viewer.currentPage) || 1) - 1);
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    if (viewer.goToPage) {
                        viewer.goToPage(1);
                        announcePageChange(container, 1, viewer.page_count);
                    }
                    break;

                case 'End':
                    e.preventDefault();
                    if (viewer.goToPage) {
                        viewer.goToPage(viewer.page_count);
                        announcePageChange(container, viewer.page_count, viewer.page_count);
                    }
                    break;
            }
        });
    }

    // -------------------------------------------------------------------------
    // Focus detection
    // -------------------------------------------------------------------------

    function setupFocusDetection(container, containerId) {
        container.addEventListener('focus', function() {
            currentFocusedViewer = containerId;
        });
        container.addEventListener('blur', function() {
            if (currentFocusedViewer === containerId) currentFocusedViewer = null;
        });
        container.addEventListener('click', function(e) {
            // Clicks on toolbar controls (page-jump input, buttons) must keep their
            // own focus — refocusing the container here would immediately steal focus
            // off a just-clicked input so it can't be typed into. Only grab focus for
            // clicks on the viewer surface itself (to enable keyboard paging).
            if (e.target.closest && e.target.closest('.bws-pdf-viewer-controls')) return;
            container.focus();
        });
    }

    // -------------------------------------------------------------------------
    // Screen reader announcements (T018)
    // -------------------------------------------------------------------------

    /**
     * Announce a page change to assistive technologies via an aria-live region.
     */
    function announcePageChange(container, pageNum, totalPages) {
        let announcer = container.querySelector('.bws-pdf-viewer-sr-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.className = 'bws-pdf-viewer-sr-announcer';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            container.appendChild(announcer);
        }
        announcer.textContent = 'Page ' + pageNum + ' of ' + totalPages;
    }

    // -------------------------------------------------------------------------
    // PDF loading
    // -------------------------------------------------------------------------

    /**
     * Load a PDF via PDF.js and return a book interface object.
     *
     * The book interface exposes:
     *   { numPages(), getPage(n, cb), pdf }
     *
     * Pages are rendered to <canvas> elements and cached by page number.
     * The book object is used by both the flipbook library (image mode) and
     * nativePageViewer (direct PDF.js rendering).
     *
     * @param {string}   pdfUrl
     * @param {Function} callback  (err, bookObj)
     */
    function loadPDF(pdfUrl, callback) {
        if (typeof pdfjsLib === 'undefined') {
            return callback('PDF.js library not loaded');
        }

        // PDF.js v6+ requires a parameter object (string argument removed)
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        loadingTask.promise.then(function(pdf) {
            const cache = {};
            const book = {
                pdf: pdf,
                numPages: function() { return pdf.numPages; },
                getPage: function(pageNum, cb) {
                    if (!pageNum || pageNum < 1 || pageNum > pdf.numPages) {
                        return cb(null, null);
                    }
                    if (cache[pageNum]) return cb(null, cache[pageNum]);

                    pdf.getPage(pageNum).then(function(page) {
                        const scale      = 1.5;
                        const viewport   = page.getViewport({ scale: scale });
                        const outputScale = window.devicePixelRatio || 1;

                        const canvas       = document.createElement('canvas');
                        canvas.width       = Math.floor(viewport.width  * outputScale);
                        canvas.height      = Math.floor(viewport.height * outputScale);
                        canvas.style.width  = Math.floor(viewport.width)  + 'px';
                        canvas.style.height = Math.floor(viewport.height) + 'px';

                        const transform     = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
                        const renderContext = {
                            canvasContext: canvas.getContext('2d'),
                            transform:     transform,
                            viewport:      viewport,
                        };

                        page.render(renderContext).promise.then(function() {
                            const img = new Image();
                            img.src = canvas.toDataURL();
                            img.addEventListener('load', function() {
                                cache[pageNum] = {
                                    img:    img,
                                    num:    pageNum,
                                    width:  img.width,
                                    height: img.height,
                                };
                                cb(null, cache[pageNum]);
                            }, false);
                        }).catch(function(err) { cb(err); });
                    }).catch(function(err) { cb(err); });
                },
            };

            callback(null, book);
        }).catch(function(err) {
            callback(err || 'PDF loading failed');
        });
    }

    // -------------------------------------------------------------------------
    // Book wrapper (traditional layout — page 1 shown alone as cover)
    // -------------------------------------------------------------------------

    /**
     * Wrap a book object to bridge the flipbook library's 0-based display slots
     * (showNdx*2, showNdx*2+1) to the raw book's 1-based PDF page numbers.
     *
     * In traditional mode: page 1 occupies the left half of spread 0 alone; the
     * right half of spread 0 is a blank page. But the lone cover only reads as a
     * cover when real spreads follow it — i.e. ≥3 pages. A 2-page book with the
     * cover offset becomes [p1|blank] + [p2|filler], showing each page alone with
     * an awkward flip between them (B22). So for exactly 2 pages we fall through to
     * the plain-spread mapping, drawing [p1|p2] as one spread.
     *
     * @param {Object}  bookObj
     * @param {boolean} useTraditionalLayout
     * @returns {Object} Wrapped book interface
     */
    function createBookWrapper(bookObj, useTraditionalLayout) {
        const traditional = useTraditionalLayout && bookObj.numPages() >= 3;

        let blankPageCache = null;
        const blankFor = function(cb) {
            if (blankPageCache) return cb(blankPageCache);
            bookObj.getPage(1, function(err, firstPage) {
                blankPageCache = createBlankPage(
                    firstPage ? firstPage.width  : undefined,
                    firstPage ? firstPage.height : undefined
                );
                cb(blankPageCache);
            });
        };

        const N = bookObj.numPages();

        return {
            pdf: bookObj.pdf,
            numPages: function() { return bookObj.numPages(); },

            // Number of spreads (views) the flipbook paginates over. The library's
            // next/prev guards and goToPage bound themselves on this, NOT on the raw
            // page count — the two differ whenever the display slots don't line up
            // 1:1 with PDF pages (B23):
            //   traditional — slots [p1, blank, p2, p3, …]: ceil((N+1)/2) spreads
            //                 (the leading blank pushes everything one slot right).
            //   plain spread — slots [p1, p2, p3, …] packed two-up: ceil(N/2) spreads.
            // A 2-page plain book is therefore ONE spread ([p1|p2]) — no phantom
            // trailing blank page to navigate to.
            numSpreads: function() {
                if (N <= 0) return 0;
                return traditional ? Math.ceil((N + 1) / 2) : Math.ceil(N / 2);
            },

            // Map a 0-based display slot to the real 1-based PDF page it draws (or 0
            // for a blank/filler slot). Consumed by the WP 'seen' handler so the page
            // counter tracks real pages regardless of layout convention.
            slotToPage: function(slot) {
                if (traditional) {
                    if (slot <= 0) return 1;      // slot 0 → cover (page 1)
                    if (slot === 1) return 0;     // slot 1 → blank right of cover
                    return slot > N ? 0 : slot;   // slot s (≥2) → page s
                }
                const page = slot + 1;            // packed: slot d → page d+1
                return page > N ? 0 : page;
            },

            // Map a 1-based real PDF page to the spread (view) that shows it. Inverse
            // of slotToPage at the spread granularity; used by goToPage.
            pageToSpread: function(pageNum) {
                if (traditional) return pageNum <= 1 ? 0 : Math.floor(pageNum / 2);
                return Math.floor((pageNum - 1) / 2);
            },

            getPage: function(displayNum, cb) {
                if (traditional) {
                    // displayNum 0 → page 1 (left, alone in spread 0)
                    // displayNum 1 → blank  (right of spread 0)
                    // displayNum 2 → page 2, 3 → page 3, … (later spreads)
                    if (displayNum === 1) return blankFor(function(p) { cb(null, p); });
                    const actualPage = (displayNum === 0) ? 1 : displayNum;
                    if (actualPage > N) return blankFor(function(p) { cb(null, p); });
                    return bookObj.getPage(actualPage, cb);
                }

                // Plain spread: display slot d → PDF page d+1 (0→p1, 1→p2, 2→p3, …).
                // Trailing odd slot past the last page → blank filler so the lone
                // final page centers (V21) instead of erroring.
                const actualPage = displayNum + 1;
                if (actualPage > N) return blankFor(function(p) { cb(null, p); });
                return bookObj.getPage(actualPage, cb);
            },
        };
    }

    function createBlankPage(width, height) {
        width  = width  || 600;
        height = height || 800;
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const img = new Image();
        img.src = canvas.toDataURL();
        return { img: img, num: 0, width: width, height: height };
    }

    // -------------------------------------------------------------------------
    // Dimension calculation
    // -------------------------------------------------------------------------

    /**
     * Calculate canvas width and height for the viewer.
     *
     * For flipbook mode the canvas spans both pages side-by-side, so the library
     * receives the full container width. For single-page (document) mode the same
     * value is used; height defaults to a sensible temporary value when 'auto'.
     *
     * @param {HTMLElement} container
     * @param {Object}      config
     * @param {Object}      bookObj
     * @param {string}      layout   'single' or 'double'
     * @returns {{ width: number, height: number }}
     */
    /*
     * B24: find the vertical ceiling an ancestor imposes on the flipbook, so a portrait
     * single-page canvas (as tall as its page) is capped to fit instead of overflowing a
     * wrapper/section that has a max-height. The container's own height is auto and simply
     * overflows such a cap (overflow:visible), so there is nothing to measure on our own
     * box — the constraint lives on an ancestor and must be read from its computed style.
     *
     * Walk from the container's parent up to <body>, reading each ancestor's computed
     * max-height and (fixed) height. Resolve px / vh / % to pixels; a % is only usable
     * when that ancestor's parent has a resolvable height, else it's indeterminate (CSS
     * ignores it too) and skipped. Return the SMALLEST resolved ceiling found, or null
     * when no ancestor constrains height (content grows freely — no cap needed). The
     * caller reserves toolbar room; this returns the raw ancestor ceiling.
     */
    function resolveCssLen(value, ancestor) {
        // value: a computed length string ('320px', '80vh', '50%', 'none', 'auto', '').
        if (!value || value === 'none' || value === 'auto') return null;
        if (value.slice(-2) === 'px') {
            const px = parseFloat(value);
            return isNaN(px) ? null : px;
        }
        if (value.slice(-2) === 'vh') {
            const vh = parseFloat(value);
            if (isNaN(vh)) return null;
            return vh / 100 * (window.innerHeight || 0);
        }
        if (value.slice(-1) === '%') {
            const pct = parseFloat(value);
            const parent = ancestor.parentElement;
            if (isNaN(pct) || !parent) return null;
            // % height resolves against the parent's content height only when that
            // parent itself has a determinate height. Reading clientHeight is a
            // pragmatic proxy: if the parent is auto-height this is the laid-out size,
            // which is the effective basis the browser used.
            const basis = parent.clientHeight;
            return basis > 0 ? pct / 100 * basis : null;
        }
        return null;
    }

    function availableHeight(container) {
        let cap = null;
        let el = container.parentElement;
        // Bound the walk at <body>/<html> so we don't read the viewport as a "cap".
        while (el && el !== document.body && el !== document.documentElement) {
            const cs = window.getComputedStyle(el);
            // Only max-height reliably signals an author-imposed ceiling. Computed
            // `height` is ALWAYS a resolved px value (the used height), even for an
            // auto-height box, so it can't distinguish "author set a fixed height" from
            // "browser laid this out" — reading it would treat every ancestor as a cap.
            // A fixed inline height is caught via el.style.height instead.
            const maxH = resolveCssLen(cs.maxHeight, el);
            const inlineH = el.style && el.style.height ? resolveCssLen(el.style.height, el) : null;
            const c = (maxH != null && inlineH != null) ? Math.min(maxH, inlineH)
                    : (maxH != null ? maxH : inlineH);
            if (c && c > 0 && (cap === null || c < cap)) cap = c;
            el = el.parentElement;
        }
        return cap;
    }

    function calculateDimensions(container, config, bookObj, layout, reserveHeight, pageAspect) {
        // Width: 'auto', '100%', empty, or any non-numeric value → fill the container.
        // A truly-empty width (admin field cleared, overriding the PHP '100%' default
        // via the option merge — B16) must NOT become parseInt('')===NaN → library's
        // 800px fallback; it means "fill container", same as '100%'/'auto'.
        let width;
        const explicitW = parseInt(config.width, 10);
        if (config.width === '100%' || config.width === 'auto' ||
            config.width === '' || config.width == null || isNaN(explicitW)) {
            width = container.offsetWidth;
        } else {
            width = explicitW;
        }
        // V22: in fullscreen, size the canvas to the real fullscreen box height so
        // the page scales up to fill the screen instead of keeping the small
        // width-derived height (leaving a black void below). Reserve room for the
        // toolbar so it stays docked and visible.
        const isFullscreen = (document.fullscreenElement === container ||
                              document.webkitFullscreenElement === container);

        // Aspect of the on-canvas content. CRITICAL (B17): the flipbook LIBRARY always
        // renders a TWO-page spread — the 'single'/'double' layout value is used only by
        // this dimension calc and the responsive ResizeObserver, NOT by the renderer,
        // which has no one-page-at-a-time mode. So the canvas is always a spread box
        // (pg.width*2, matching flipbookviewer.js calcLayoutParameters) EXCEPT a genuine
        // single-page book (numPages===1), which is forced to 'single' with the
        // traditional wrapper OFF and draws one page. Keying pagesAcross off `layout`
        // instead sized a tall single-page canvas for a wide spread just under the
        // breakpoint → the spread letterboxed with large vertical dead space.
        const singlePageBook = bookObj && typeof bookObj.numPages === 'function' &&
                               bookObj.numPages() === 1;
        function contentHeightForWidth(w) {
            if (!pageAspect) return null;
            const pagesAcross = singlePageBook ? 1 : 2;
            const spreadW = pageAspect.w * pagesAcross;
            return w * (pageAspect.h / spreadW);
        }

        let height;
        const explicitH = parseInt(config.height, 10);
        if (isFullscreen) {
            // Prefer a live toolbar; fall back to the height captured before reinit
            // removed it (reserveHeight), then a sane default so the bar never clips.
            const toolbar = container.querySelector('.bws-pdf-viewer-controls');
            const toolbarH = (toolbar && toolbar.offsetHeight) || reserveHeight || 48;
            // Clamp both dims to the screen box so neither overflows in fullscreen
            // (the aspect-derived width can otherwise exceed the physical screen).
            width  = Math.min(width, window.innerWidth || width);
            height = Math.max(0, (container.offsetHeight || window.innerHeight) - toolbarH);
        } else if (config.height === 'auto' || config.height === '' ||
                   config.height == null || isNaN(explicitH)) {
            // Derive an exact spread box from the page aspect so the canvas wraps the
            // content edge-to-edge (no letterbox, truly centered). Without an aspect
            // (page-1 fetch failed) fall back to the old temporary default.
            height = contentHeightForWidth(width) || 600;

            // B24: if an ancestor caps vertical space (e.g. a wrapper with max-height),
            // the aspect-derived height can overflow it — most visible for a portrait
            // single-page flipbook, whose canvas is as tall as the page. Cap the height
            // to what the container is actually allowed, then shrink the width to keep
            // the spread aspect so the page still fills the canvas width (no reintroduced
            // side whitespace — B22) and the box simply scales down to fit. Flipbook mode
            // only: document (native/image) modes scroll all pages, so a height cap there
            // would clip content, not fit it. Skipped in fullscreen (sized to the screen
            // box above) and when the aspect is unknown (nothing to preserve).
            if (!config.singlepage && !isFullscreen && pageAspect) {
                let capH = availableHeight(container);
                if (capH) {
                    // The docked toolbar (if shown) also lives inside the ancestor's
                    // ceiling; reserve room for it so canvas + toolbar fit, not just the
                    // canvas. The toolbar isn't built yet here, so use a conservative
                    // estimate matching its typical height.
                    if (config.showControls !== false) capH -= 48;
                    if (capH > 0 && height > capH) {
                        const derivedH = height;
                        height = capH;
                        width = width * (capH / derivedH);
                    }
                }
            }
        } else {
            height = explicitH;
        }

        return { width: width, height: height };
    }

    // -------------------------------------------------------------------------
    // Bootstrap
    // -------------------------------------------------------------------------

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initViewers);
    } else {
        initViewers();
    }

    // Expose for optional external use (e.g. reinit after AJAX content load)
    window.BwsPdfViewerWP = {
        initViewers:   initViewers,
        initFlipbooks: initViewers, // legacy alias
        activeViewers: activeViewers,
    };

})();
