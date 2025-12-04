/**
 * WordPress integration for Flipbook Viewer
 * Handles initialization and enhanced features
 */

(function() {
    'use strict';

    // Track all active viewers for keyboard navigation
    const activeViewers = new Map();
    let currentFocusedViewer = null;

    /**
     * Initialize all flipbook containers on page load
     */
    function initFlipbooks() {
        const containers = document.querySelectorAll('.bws-pdf-viewer-container');
        containers.forEach(container => {
            const config = JSON.parse(container.dataset.config);
            initFlipbook(container, config);
        });
    }

    /**
     * Initialize a single flipbook instance
     */
    function initFlipbook(container, config) {
        const containerId = container.id;

        // Set up PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = bwsPdfViewerData.pluginUrl + 'dist/pdf.worker.js';
        }

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const shouldAnimate = config.enableAnimations && !prefersReducedMotion;

        // Load the PDF
        loadPDF(config.pdf, function(err, bookObj) {
            if (err) {
                container.innerHTML = '<p class="bws-pdf-viewer-error">Error loading PDF: ' + err + '</p>';
                console.error('Flipbook error:', err);
                return;
            }

            // Determine initial layout based on container width
            const containerWidth = container.offsetWidth;
            let layout = config.layout;

            if (layout === 'auto') {
                layout = containerWidth >= config.breakpoint ? 'double' : 'single';
            }

            // Adjust for traditional book layout
            const useTraditionalLayout = config.bookLayout === 'traditional';

            // Create book wrapper with traditional layout support
            const bookWrapper = createBookWrapper(bookObj, useTraditionalLayout);

            // Calculate dimensions
            const dimensions = calculateDimensions(container, config, bookObj, layout);

            // Prepare options for flipbook viewer
            const viewerOpts = {
                backgroundColor: config.backgroundColor,
                boxColor: config.boxColor,
                boxBorder: config.boxBorder,
                margin: config.margin,
                width: dimensions.width,
                height: dimensions.height,
                singlepage: config.singlepage,
                traditionallayout: useTraditionalLayout,
                shouldAnimate: shouldAnimate,
            };

            if (config.marginTop !== null) {
                viewerOpts.marginTop = config.marginTop;
            }
            if (config.marginLeft !== null) {
                viewerOpts.marginLeft = config.marginLeft;
            }

            // Initialize the viewer
            flipbook.init(bookWrapper, container, viewerOpts, function(err, viewer) {
                if (err) {
                    container.innerHTML = '<p class="bws-pdf-viewer-error">Error initializing viewer: ' + err + '</p>';
                    console.error('Flipbook initialization error:', err);
                    return;
                }

                // Store viewer instance
                const viewerData = {
                    viewer: viewer,
                    container: container,
                    config: config,
                    layout: layout,
                    dimensions: dimensions,
                    bookWrapper: bookWrapper,
                    shouldAnimate: shouldAnimate,
                };
                activeViewers.set(containerId, viewerData);

                // Set up responsive behavior
                setupResponsiveBehavior(containerId, viewerData);

                // Set up keyboard navigation
                setupKeyboardNavigation(containerId, viewerData);

                // Set up focus detection
                setupFocusDetection(container, containerId);

                console.log('Flipbook initialized:', containerId);
            });
        });
    }

    /**
     * Create a book wrapper that handles traditional layout
     */
    function createBookWrapper(bookObj, useTraditionalLayout) {
        if (!useTraditionalLayout) {
            return bookObj;
        }

        // Wrapper that adjusts page numbers for traditional layout
        // Page 1 is alone, then 2-3, 4-5, etc.
        return {
            numPages: function() {
                return bookObj.numPages();
            },
            getPage: function(displayNum, cb) {
                // displayNum 0 = page 1 (left side, alone)
                // displayNum 1 = page 1 (right side, empty for traditional)
                // displayNum 2 = page 2 (left side)
                // displayNum 3 = page 3 (right side)
                // etc.

                if (displayNum === 1) {
                    // Right side of first spread is empty in traditional layout
                    return cb(null, null);
                }

                let actualPage;
                if (displayNum === 0) {
                    actualPage = 1;
                } else {
                    actualPage = displayNum;
                }

                if (actualPage > bookObj.numPages()) {
                    return cb(null, null);
                }

                bookObj.getPage(actualPage, cb);
            }
        };
    }

    /**
     * Load PDF and create book object
     */
    function loadPDF(pdfUrl, callback) {
        if (typeof pdfjsLib === 'undefined') {
            return callback('PDF.js library not loaded');
        }

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        loadingTask.promise.then(function(pdf) {
            const cache = {};
            const book = {
                pdf: pdf,
                numPages: function() {
                    return pdf.numPages;
                },
                getPage: function(pageNum, cb) {
                    if (!pageNum || pageNum < 1 || pageNum > pdf.numPages) {
                        return cb(null, null);
                    }

                    // Check cache
                    if (cache[pageNum]) {
                        return cb(null, cache[pageNum]);
                    }

                    // Render page
                    pdf.getPage(pageNum).then(function(page) {
                        const scale = 1.5;
                        const viewport = page.getViewport({ scale: scale });
                        const outputScale = window.devicePixelRatio || 1;

                        const canvas = document.createElement('canvas');
                        canvas.width = Math.floor(viewport.width * outputScale);
                        canvas.height = Math.floor(viewport.height * outputScale);
                        canvas.style.width = Math.floor(viewport.width) + 'px';
                        canvas.style.height = Math.floor(viewport.height) + 'px';

                        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
                        const context = canvas.getContext('2d');

                        const renderContext = {
                            canvasContext: context,
                            transform: transform,
                            viewport: viewport,
                        };

                        page.render(renderContext).promise.then(function() {
                            const img = new Image();
                            img.src = canvas.toDataURL();
                            img.addEventListener('load', function() {
                                cache[pageNum] = {
                                    img: img,
                                    num: pageNum,
                                    width: img.width,
                                    height: img.height,
                                };
                                cb(null, cache[pageNum]);
                            }, false);
                        }).catch(function(err) {
                            cb(err);
                        });
                    }).catch(function(err) {
                        cb(err);
                    });
                }
            };

            callback(null, book);
        }).catch(function(err) {
            callback(err || 'PDF loading failed');
        });
    }

    /**
     * Calculate dimensions for viewer
     */
    function calculateDimensions(container, config, bookObj, layout) {
        let width, height;

        // Width
        if (config.width === '100%' || config.width === 'auto') {
            width = container.offsetWidth;
        } else {
            width = parseInt(config.width);
        }

        // Height - will be set after getting first page if 'auto'
        if (config.height === 'auto') {
            // Get first page to calculate aspect ratio
            height = 600; // Temporary default, will be updated
        } else {
            height = parseInt(config.height);
        }

        return { width, height };
    }

    /**
     * Set up responsive behavior using ResizeObserver
     */
    function setupResponsiveBehavior(containerId, viewerData) {
        const { container, config } = viewerData;

        if (config.layout !== 'auto') {
            return; // No responsive behavior needed
        }

        if (typeof ResizeObserver === 'undefined') {
            console.warn('ResizeObserver not supported, responsive behavior disabled');
            return;
        }

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const containerWidth = entry.contentRect.width;
                const newLayout = containerWidth >= config.breakpoint ? 'double' : 'single';

                if (newLayout !== viewerData.layout) {
                    viewerData.layout = newLayout;
                    console.log('Layout changed to:', newLayout);
                    // TODO: Reinitialize viewer with new layout if needed
                }
            }
        });

        resizeObserver.observe(container);
        viewerData.resizeObserver = resizeObserver;
    }

    /**
     * Set up keyboard navigation
     */
    function setupKeyboardNavigation(containerId, viewerData) {
        const { viewer, container, layout } = viewerData;

        // Make container focusable
        if (!container.hasAttribute('tabindex')) {
            container.setAttribute('tabindex', '0');
        }

        // Add keyboard event listener to container
        container.addEventListener('keydown', function(e) {
            if (currentFocusedViewer !== containerId) {
                return;
            }

            switch(e.key) {
                case 'ArrowRight':
                case 'PageDown':
                case ' ':
                    e.preventDefault();
                    if (viewer.flip_forward) {
                        viewer.flip_forward();
                    }
                    break;

                case 'ArrowLeft':
                case 'PageUp':
                    e.preventDefault();
                    if (viewer.flip_back) {
                        viewer.flip_back();
                    }
                    break;

                case 'Home':
                    e.preventDefault();
                    // TODO: Go to first page
                    break;

                case 'End':
                    e.preventDefault();
                    // TODO: Go to last page
                    break;
            }
        });
    }

    /**
     * Set up focus detection for keyboard navigation
     */
    function setupFocusDetection(container, containerId) {
        container.addEventListener('focus', function() {
            currentFocusedViewer = containerId;
        });

        container.addEventListener('blur', function() {
            if (currentFocusedViewer === containerId) {
                currentFocusedViewer = null;
            }
        });

        // Also handle click to set focus
        container.addEventListener('click', function() {
            container.focus();
        });
    }

    /**
     * Initialize when DOM is ready
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFlipbooks);
    } else {
        initFlipbooks();
    }

    // Expose for potential external use
    window.BwsPdfViewerWP = {
        initFlipbooks: initFlipbooks,
        activeViewers: activeViewers,
    };

})();
