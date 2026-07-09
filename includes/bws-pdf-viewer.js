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
            fullscreen:          i18n.fullscreen          || 'Fullscreen',
            fullscreenLabel:     i18n.fullscreenLabel     || 'Enter fullscreen',
            exitFullscreen:      i18n.exitFullscreen      || 'Exit Fullscreen',
            exitFullscreenLabel: i18n.exitFullscreenLabel || 'Exit fullscreen',
            print:               i18n.print               || 'Print',
            printLabel:          i18n.printLabel          || 'Print PDF',
        };
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

        controlsDiv.addEventListener('keydown', function(e) {
            // Let the page input own Left/Right (and Home/End) for text editing.
            if (e.target.classList.contains('bws-pdf-page-input') &&
                (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                 e.key === 'Home' || e.key === 'End')) {
                return;
            }

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
        // pages stacked/scrolled) or a single-page file (nothing to page through).
        // Flipbook multi-page is the only case that shows nav. Fullscreen/print are
        // unaffected and still render per their own gating.
        const pageCount = viewerData.bookWrapper ? viewerData.bookWrapper.numPages() : 0;
        const showPageNav = !config.singlepage && pageCount > 1;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'bws-pdf-viewer-controls';
        // T010: WAI-ARIA toolbar semantics (toolbar-dom.md invariant 2)
        controlsDiv.setAttribute('role', 'toolbar');
        controlsDiv.setAttribute('aria-label', t.toolbarLabel);

        // --- Previous button ---
        const prevBtn = document.createElement('button');
        prevBtn.className = 'bws-pdf-prev';
        prevBtn.textContent = '\u2190 ' + t.prev;
        prevBtn.setAttribute('aria-label', t.prevLabel);
        prevBtn.setAttribute('type', 'button');

        prevBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.flip_back) viewer.flip_back();
            else if (viewer && viewer.goToPage) {
                const cur = Number(viewer.currentPage) || 1;
                if (cur > 1) viewer.goToPage(cur - 1);
            }
        });

        // --- Page-nav group: editable page-jump input + display-only counter ---
        // T011: net-new page-jump control (the only net-new control this feature adds).
        const pageNav = document.createElement('span');
        pageNav.className = 'bws-pdf-viewer-page-nav';

        const pageInput = document.createElement('input');
        pageInput.className = 'bws-pdf-page-input';
        pageInput.setAttribute('type', 'text');
        pageInput.setAttribute('inputmode', 'numeric');
        pageInput.setAttribute('pattern', '[0-9]*');
        pageInput.setAttribute('aria-label', t.pageNumberLabel);

        // Display-only "of N" counter. No longer aria-live; announcements come from
        // the dedicated SR live region (toolbar-dom.md invariants 8 and 10).
        const pageCounter = document.createElement('span');
        pageCounter.className = 'bws-pdf-viewer-page-counter';
        pageCounter.setAttribute('aria-hidden', 'true');

        pageNav.appendChild(pageInput);
        pageNav.appendChild(pageCounter);

        // --- Next button ---
        const nextBtn = document.createElement('button');
        nextBtn.className = 'bws-pdf-next';
        nextBtn.textContent = t.next + ' \u2192';
        nextBtn.setAttribute('aria-label', t.nextLabel);
        nextBtn.setAttribute('type', 'button');

        nextBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.flip_forward) viewer.flip_forward();
            else if (viewer && viewer.goToPage) {
                const cur = Number(viewer.currentPage) || 1;
                if (cur < viewer.page_count) viewer.goToPage(cur + 1);
            }
        });

        // --- Page-jump commit state machine (data-model.md) ---
        // `editing` guards updateCounter from clobbering the field mid-type.
        let editing = false;

        function restorePageInput() {
            const viewer = viewerData.viewer;
            pageInput.value = (viewer && viewer.currentPage) || 1;
        }

        function commitPageInput() {
            const viewer = viewerData.viewer;
            editing = false;
            if (!viewer || !viewer.goToPage) { restorePageInput(); return; }

            const raw = pageInput.value.trim();
            const n = parseInt(raw, 10);
            if (raw === '' || isNaN(n)) {
                // non-numeric / empty -> restore current page, no navigation
                restorePageInput();
                return;
            }
            const total = viewer.page_count || 1;
            const clamped = Math.max(1, Math.min(n, total));
            viewer.goToPage(clamped);
            // The 'seen' -> onSeen -> updateCounter path refreshes the field to the
            // landed page; set it now too in case goToPage is a no-op (already there).
            pageInput.value = clamped;
        }

        pageInput.addEventListener('focus', function() { editing = true; });
        pageInput.addEventListener('blur', commitPageInput);
        pageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitPageInput();
                pageInput.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                editing = false;
                restorePageInput();
                pageInput.blur();
            }
        });

        // Counter update: reads from viewerData.viewer each call so it stays correct
        // after responsive reinit replaces the viewer instance.
        function updateCounter() {
            if (!showPageNav) return; // nav hidden — nothing to sync
            const viewer = viewerData.viewer;
            const current = (viewer && viewer.currentPage) || 1;
            const total   = (viewer && viewer.page_count) || 0;
            if (!editing) pageInput.value = current;
            pageCounter.textContent = t.of + ' ' + total;
            prevBtn.disabled = current <= 1;
            nextBtn.disabled = current >= total;
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
            const page = slot < 1 ? 1 : slot; // slot 0 → cover (page 1); else slot == page
            return Math.min(page, total);     // clamp trailing blank/over-count slots
        }

        function onSeen(displayIndexOrPageNum) {
            const viewer = viewerData.viewer;
            if (!viewer) return;

            if (config.singlepage) {
                // Document / native mode: event already emits 1-based page number
                viewer.currentPage = displayIndexOrPageNum;
            } else {
                // Flipbook mode: event emits a 0-based display-slot index.
                viewer.currentPage = slotToPage(displayIndexOrPageNum);
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
                fsBtn.textContent = startFs ? t.exitFullscreen : t.fullscreen;
                fsBtn.setAttribute('aria-label', startFs ? t.exitFullscreenLabel : t.fullscreenLabel);

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
                    fsBtn.textContent      = isFs ? t.exitFullscreen : t.fullscreen;
                    fsBtn.setAttribute('aria-label', isFs ? t.exitFullscreenLabel : t.fullscreenLabel);
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

        // --- Print button ---
        if (config.showPrint !== false) {
            const printBtn = document.createElement('button');
            printBtn.className = 'bws-pdf-print';
            printBtn.textContent = t.print;
            printBtn.setAttribute('aria-label', t.printLabel);
            printBtn.setAttribute('type', 'button');
            printBtn.addEventListener('click', function() { window.print(); });
            controlsDiv.appendChild(printBtn);
        }

        // T015: Assemble in order: prev | page-nav (input + counter) | next [| fullscreen] [| print].
        // fullscreen/print were appended above; prepend the leading three in reverse so the
        // final order is prev, pageNav, next, fullscreen, print.
        // V6: page-nav group only when navigation is meaningful (flipbook multi-page).
        if (showPageNav) {
            controlsDiv.insertBefore(nextBtn, controlsDiv.firstChild);
            controlsDiv.insertBefore(pageNav, controlsDiv.firstChild);
            controlsDiv.insertBefore(prevBtn, controlsDiv.firstChild);
        }

        // Nothing to show (nav hidden + fullscreen/print both off/unsupported) —
        // skip the empty bar rather than render a bare dark strip.
        if (!controlsDiv.firstChild) return null;

        // T018: roving tabindex — first control focusable, rest -1; arrows move focus.
        setupToolbarRovingFocus(controlsDiv);

        container.appendChild(controlsDiv);
        updateCounter();

        return controlsDiv;
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
        const onFullscreenRelayout = function() {
            const isFs = (document.fullscreenElement === container ||
                          document.webkitFullscreenElement === container);
            const wasFs = (document.fullscreenElement || document.webkitFullscreenElement);
            // Only act on transitions involving THIS container (enter its own fs, or
            // exit while it was the fs element). Other containers' events are ignored.
            if (!isFs && wasFs) return;

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
        container.addEventListener('click', function() {
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
     * Wrap a book object to implement the traditional layout.
     * In traditional mode: page 1 occupies the left half of spread 0 alone;
     * the right half of spread 0 is a blank page.
     *
     * @param {Object}  bookObj
     * @param {boolean} useTraditionalLayout
     * @returns {Object} Wrapped book interface
     */
    function createBookWrapper(bookObj, useTraditionalLayout) {
        if (!useTraditionalLayout) return bookObj;

        let blankPageCache = null;

        return {
            pdf: bookObj.pdf,
            numPages: function() { return bookObj.numPages(); },
            getPage: function(displayNum, cb) {
                // displayNum 0 → page 1 (left, alone in spread 0)
                // displayNum 1 → blank  (right of spread 0)
                // displayNum 2 → page 2 (left of spread 1)
                // displayNum 3 → page 3 (right of spread 1)
                // …

                if (displayNum === 1) {
                    // Right half of first spread is blank in traditional layout
                    if (blankPageCache) return cb(null, blankPageCache);
                    bookObj.getPage(1, function(err, firstPage) {
                        blankPageCache = createBlankPage(
                            firstPage ? firstPage.width  : undefined,
                            firstPage ? firstPage.height : undefined
                        );
                        cb(null, blankPageCache);
                    });
                    return;
                }

                const actualPage = (displayNum === 0) ? 1 : displayNum;
                if (actualPage > bookObj.numPages()) {
                    if (!blankPageCache) blankPageCache = createBlankPage();
                    return cb(null, blankPageCache);
                }
                bookObj.getPage(actualPage, cb);
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
