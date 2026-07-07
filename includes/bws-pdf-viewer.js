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
            isMobile:    (navigator.maxTouchPoints > 0 && window.innerWidth <= 767) || window.innerWidth <= 767,
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

            // Calculate canvas dimensions
            const dimensions = calculateDimensions(container, config, bookObj, effectiveLayout);

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

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'bws-pdf-viewer-controls';

        // --- Previous button ---
        const prevBtn = document.createElement('button');
        prevBtn.className = 'bws-pdf-prev';
        prevBtn.textContent = '\u2190 Previous';
        prevBtn.setAttribute('aria-label', 'Previous page');
        prevBtn.setAttribute('type', 'button');

        prevBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.flip_back) viewer.flip_back();
            else if (viewer && viewer.goToPage && viewer.currentPage > 1) viewer.goToPage(viewer.currentPage - 1);
        });

        // --- Page counter ---
        const pageCounter = document.createElement('span');
        pageCounter.className = 'bws-pdf-viewer-page-counter';
        pageCounter.setAttribute('aria-live', 'polite');
        pageCounter.setAttribute('aria-atomic', 'true');

        // --- Next button ---
        const nextBtn = document.createElement('button');
        nextBtn.className = 'bws-pdf-next';
        nextBtn.textContent = 'Next \u2192';
        nextBtn.setAttribute('aria-label', 'Next page');
        nextBtn.setAttribute('type', 'button');

        nextBtn.addEventListener('click', function() {
            const viewer = viewerData.viewer;
            if (viewer && viewer.flip_forward) viewer.flip_forward();
            else if (viewer && viewer.goToPage && viewer.currentPage < viewer.page_count) viewer.goToPage(viewer.currentPage + 1);
        });

        // Counter update — reads from viewerData.viewer each call so it stays correct
        // after responsive reinit replaces the viewer instance.
        function updateCounter() {
            const viewer = viewerData.viewer;
            const current = (viewer && viewer.currentPage) || 1;
            const total   = (viewer && viewer.page_count) || 0;
            pageCounter.textContent = 'Page ' + current + ' of ' + total;
            prevBtn.disabled = current <= 1;
            nextBtn.disabled = current >= total;
        }

        // T021: Flipbook viewer emits a 0-based display index via the 'seen' event.
        // Map it to a 1-based page number for the counter.
        // Traditional layout: display 0 → page 1; display 2 → page 2; display 3 → page 3, etc.
        // Conversion: keep the display index unless it is 0 (first spread left), which maps to page 1.
        function onSeen(displayIndexOrPageNum) {
            const viewer = viewerData.viewer;
            if (!viewer) return;

            if (config.singlepage) {
                // Document / native mode: event already emits 1-based page number
                viewer.currentPage = displayIndexOrPageNum;
            } else {
                // Flipbook mode: event emits 0-based display index.
                // We always show the left-page number of the current spread.
                const idx = displayIndexOrPageNum;
                const isLeft = (idx % 2 === 0);
                let pageNum;
                if (isLeft) {
                    pageNum = (idx === 0) ? 1 : idx;
                } else {
                    // Right-page event — resolve to same spread's left page number
                    pageNum = (idx === 1) ? 1 : (idx - 1);
                }
                viewer.currentPage = pageNum;
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
                fsBtn.textContent = 'Fullscreen';
                fsBtn.setAttribute('aria-label', 'Enter fullscreen');
                fsBtn.setAttribute('type', 'button');

                fsBtn.addEventListener('click', function() {
                    if (document.fullscreenElement || document.webkitFullscreenElement) {
                        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
                    } else {
                        (container.requestFullscreen || container.webkitRequestFullscreen).call(container);
                    }
                });

                // T016: Update button label when fullscreen state changes
                var onFsChange = function() {
                    const isFs = (document.fullscreenElement === container || document.webkitFullscreenElement === container);
                    fsBtn.textContent      = isFs ? 'Exit Fullscreen' : 'Fullscreen';
                    fsBtn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Enter fullscreen');
                };
                document.addEventListener('fullscreenchange', onFsChange);
                document.addEventListener('webkitfullscreenchange', onFsChange);

                controlsDiv.appendChild(fsBtn);
            }
        }

        // --- Print button (T015) ---
        if (config.showPrint !== false) {
            const printBtn = document.createElement('button');
            printBtn.className = 'bws-pdf-print';
            printBtn.textContent = 'Print';
            printBtn.setAttribute('aria-label', 'Print PDF');
            printBtn.setAttribute('type', 'button');
            printBtn.addEventListener('click', function() { window.print(); });
            controlsDiv.appendChild(printBtn);
        }

        // Assemble: prev | counter | next [| fullscreen] [| print]
        controlsDiv.insertBefore(prevBtn, controlsDiv.firstChild);
        controlsDiv.insertBefore(pageCounter, controlsDiv.children[1] || null);
        controlsDiv.insertBefore(nextBtn, controlsDiv.children[2] || null);

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
     * Only relevant for flipbook mode with layout='auto'. In document (native) mode
     * the page canvases are block elements that reflow via CSS max-width: 100%.
     *
     * @param {string} containerId
     * @param {Object} viewerData
     * @param {Object} initialOpts  Original viewerOpts used during first init.
     */
    function setupResponsiveBehavior(containerId, viewerData, initialOpts) {
        const { container, config } = viewerData;

        if (config.layout !== 'auto') return; // fixed layout — nothing to do

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

        // Remove existing canvas (flipbook renders into a <canvas> element)
        const oldCanvas = container.querySelector('canvas');
        if (oldCanvas) oldCanvas.remove();

        // Remove existing controls bar — new one will be added after reinit
        const oldControls = container.querySelector('.bws-pdf-viewer-controls');
        if (oldControls) oldControls.remove();

        // Temporarily re-show loading indicator
        let loader = container.querySelector('.bws-pdf-viewer-loading');
        if (!loader) {
            loader = document.createElement('div');
            loader.className = 'bws-pdf-viewer-loading';
            loader.innerHTML = '<span>Loading\u2026</span>';
            container.appendChild(loader);
        }

        // Recalculate dimensions for the new layout
        const newDimensions = calculateDimensions(container, config, viewerData.bookWrapper, newLayout);

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

            const viewer = viewerData.viewer; // T022: read dynamically — survives reinit
            if (!viewer) return;

            switch (e.key) {
                // T017: ArrowDown added as alias for document-mode vertical navigation
                case 'ArrowRight':
                case 'ArrowDown':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    if (viewer.flip_forward) {
                        viewer.flip_forward();
                        // T018: Announce page change to screen readers after navigation
                        // (page number update happens asynchronously via 'seen' event)
                    }
                    break;

                // T017: ArrowUp added as alias for document-mode vertical navigation
                case 'ArrowLeft':
                case 'ArrowUp':
                case 'PageUp':
                    e.preventDefault();
                    if (viewer.flip_back) {
                        viewer.flip_back();
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
    function calculateDimensions(container, config, bookObj, layout) {
        let width;
        if (config.width === '100%' || config.width === 'auto') {
            width = container.offsetWidth;
        } else {
            width = parseInt(config.width, 10);
        }

        let height;
        if (config.height === 'auto') {
            height = 600; // temporary default; viewer adjusts after first page renders
        } else {
            height = parseInt(config.height, 10);
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
