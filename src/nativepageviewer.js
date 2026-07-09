'use strict'
import { h } from '@tpp/htm-x';
import * as EventEmitter from 'events';
import {
  TextLayerBuilder,
  AnnotationLayerBuilder,
  PDFLinkService,
  EventBus,
} from 'pdfjs-dist/web/pdf_viewer.mjs';

/**
 * Native PDF.js Page Viewer
 *
 * Renders PDF pages using the official pdfjs-dist viewer components:
 * - Canvas layer for visual rendering (page.render)
 * - Text layer via TextLayerBuilder (selection + browser find)
 * - Annotation layer via AnnotationLayerBuilder (clickable links)
 * - Shared EventBus + PDFLinkService for internal/external link navigation
 * - Lazy loading via IntersectionObserver; memory cleanup for distant pages
 *
 * PDF.js 6.1.200 builder API (verified against
 * node_modules/pdfjs-dist/types/web/{text_layer_builder,annotation_layer_builder,pdf_link_service}.d.ts):
 *
 *   new TextLayerBuilder({ pdfPage })                       // builder auto-fetches text content
 *     .div                       -> HTMLDivElement (append yourself)
 *     .render({ viewport })      -> Promise<void>
 *     .cancel()
 *
 *   new AnnotationLayerBuilder({ pdfPage, linkService, renderForms })  // renderForms is required
 *     .div                       -> HTMLDivElement | null (populated after render)
 *     .render({ viewport, intent })  -> Promise<void>   // intent defaults to "display"
 *     .cancel()
 *
 *   new PDFLinkService({ eventBus, externalLinkTarget, externalLinkRel })
 *     .setDocument(pdf)          // required for internal-destination resolution
 *     .setViewer(shim)           // minimal shim below drives goToPage for internal links
 *
 * The builders auto-fetch getTextContent()/getAnnotations() from pdfPage — the old
 * hand-rolled getTextContent()/getAnnotations() calls and manual span/anchor positioning
 * (v5-era pdfjsLib.renderTextLayer / pdfjsLib.AnnotationLayer.render, both removed/changed
 * in v6) are gone. `--scale-factor` MUST be set on each page container or the text layer
 * mis-positions (classic v6 bug — research D4/D9).
 */

class NativePageViewer extends EventEmitter {
  constructor() {
    super();
    this.currentPage = 1;
    this.page_count = 0;
    this.loadedPages = new Set();
  }

  goToPage(pageNum) {
    if (pageNum < 1 || pageNum > this.page_count) return;

    const pageContainer = document.querySelector(`[data-page-number="${pageNum}"]`);
    if (pageContainer) {
      pageContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.currentPage = pageNum;
      this.emit('seen', pageNum);
    }
  }

  flip_forward() {
    if (this.currentPage < this.page_count) {
      this.goToPage(this.currentPage + 1);
    }
  }

  flip_back() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }
}

/**
 * Build a shared EventBus + PDFLinkService for the document.
 *
 * PDFLinkService resolves internal destinations against a "viewer"; we are not using the
 * full PDFViewer, so we hand it a minimal shim that satisfies the members the link service
 * touches for goToDestination and drives our own lazy-loaded goToPage. External links are
 * handled entirely by externalLinkTarget/externalLinkRel on the service.
 */
function createLinkService(viewer, pdf) {
  const eventBus = new EventBus();
  const linkService = new PDFLinkService({
    eventBus,
    externalLinkTarget: 2,                              // LinkTarget.BLANK — open in new tab
    externalLinkRel: 'noopener noreferrer nofollow',
  });

  // Minimal viewer shim: PDFLinkService.goToDestination / _goToDestinationHelper read
  // pagesCount, currentPageNumber and call scrollPageIntoView({ pageNumber }). We map that
  // onto our own goToPage so internal-destination links scroll to the target page.
  const viewerShim = {
    get pagesCount() { return viewer.page_count; },
    get currentPageNumber() { return viewer.currentPage; },
    set currentPageNumber(n) { /* driven via scrollPageIntoView below */ },
    getPageView(index) { return null; },               // per-page view not tracked in lazy mode
    scrollPageIntoView({ pageNumber }) {
      if (pageNumber) viewer.goToPage(pageNumber);
    },
    isInPresentationMode: false,
    focus() {},
  };
  linkService.setViewer(viewerShim);
  linkService.setDocument(pdf);

  return linkService;
}

/**
 * Main entry point for native page viewer
 */
export function nativePageViewer(ctx, cb) {
  const viewer = new NativePageViewer();
  const pdf = ctx.book.pdf;

  if (!pdf) {
    return cb('Native viewer requires PDF.js document object');
  }

  viewer.page_count = pdf.numPages;

  // Shared link service for all annotation layers (internal + external links)
  ctx.linkService = createLinkService(viewer, pdf);

  setupContainer(ctx, pdf, (err, scale) => {
    if (err) return cb(err);

    ctx.scale = scale;

    createPageContainers(ctx, viewer, err => {
      if (err) return cb(err);

      setupIntersectionObserver(ctx, viewer);
      setupPageTracking(ctx, viewer);

      cb(null, viewer);
    });
  });
}

/**
 * Set up container and calculate scale
 */
function setupContainer(ctx, pdf, cb) {
  pdf.getPage(1).then(page => {
    const viewport = page.getViewport({ scale: 1 });
    const containerWidth = ctx.app.getBoundingClientRect().width;

    // Calculate scale to fit container (with some margin)
    const scale = (containerWidth - 40) / viewport.width;

    cb(null, scale);
  }).catch(err => cb(err));
}

/**
 * Create placeholder containers for all pages
 */
function createPageContainers(ctx, viewer, cb) {
  ctx.pageContainers = [];

  for (let pageNum = 1; pageNum <= viewer.page_count; pageNum++) {
    const container = createPageContainer(pageNum);
    ctx.pageContainers.push(container);
    ctx.app.add(container);
  }

  cb(null);
}

/**
 * Create individual page container
 */
function createPageContainer(pageNum) {
  const container = h('div.page-container');
  container.attr({
    'data-page-number': pageNum,
    'data-loaded': 'false',
    'id': `page-container-${pageNum}`
  });

  return container;
}

/**
 * Set up IntersectionObserver for lazy loading
 */
function setupIntersectionObserver(ctx, viewer) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        const pageNum = parseInt(container.dataset.pageNumber);
        const loaded = container.dataset.loaded === 'true';
        const loading = container.dataset.loading === 'true';

        // Guard against the observer re-firing during fast scroll (200px rootMargin)
        // before the async render completes — a second concurrent renderPage would
        // duplicate the canvas/text/annotation layers and orphan builder references.
        if (!loaded && !loading) {
          renderPage(ctx, container, pageNum, viewer);
        }
      }
    });
  }, {
    root: null,
    rootMargin: '200px', // Pre-load 200px before visible
    threshold: 0.01,
  });

  ctx.pageContainers.forEach(container => observer.observe(container));
  ctx.observer = observer;
}

/**
 * Track which page is currently visible
 */
function setupPageTracking(ctx, viewer) {
  const trackObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
        const pageNum = parseInt(entry.target.dataset.pageNumber);
        if (viewer.currentPage !== pageNum) {
          viewer.currentPage = pageNum;
          viewer.emit('seen', pageNum);

          // Clean up distant pages
          cleanupDistantPages(ctx, pageNum, viewer);
        }
      }
    });
  }, {
    root: null,
    threshold: 0.5, // Page is "seen" when 50% visible
  });

  ctx.pageContainers.forEach(container => trackObserver.observe(container));
  ctx.trackObserver = trackObserver;
}

/**
 * Render a single page with all layers
 */
function renderPage(ctx, container, pageNum, viewer) {
  const pdf = ctx.book.pdf;

  // In-flight marker: cleared on completion (loaded='true') or on error below.
  container.dataset.loading = 'true';

  pdf.getPage(pageNum).then(page => {
    const viewport = page.getViewport({ scale: ctx.scale });

    // v6 requires --scale-factor on the page container so the text-layer spans
    // (sized in scale-relative units) position correctly (research D4/D9).
    container.style.setProperty('--scale-factor', viewport.scale);

    // Render canvas layer
    renderCanvas(container, page, viewport, err => {
      if (err) {
        console.error('Error rendering canvas:', err);
        return;
      }

      // Text layer (selection + browser find) via TextLayerBuilder
      renderTextLayer(container, page, viewport).catch(err => {
        console.warn('Text layer rendering failed:', err);
      });

      // Annotation layer (links) via AnnotationLayerBuilder + shared linkService
      renderAnnotationLayer(container, page, viewport, ctx.linkService).catch(err => {
        console.warn('Annotation layer rendering failed:', err);
      });

      container.dataset.loaded = 'true';
      delete container.dataset.loading;
      viewer.loadedPages.add(pageNum);
      viewer.emit('page-loaded', pageNum);
    });
  }).catch(err => {
    delete container.dataset.loading;
    console.error('Error loading page:', err);
    container.innerHTML = `<p class="pdf-page-error">Error loading page ${pageNum}</p>`;
  });
}

/**
 * Render canvas layer
 */
function renderCanvas(container, page, viewport, cb) {
  const outputScale = window.devicePixelRatio || 1;

  const canvas = h('canvas.pdf-canvas');
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = Math.floor(viewport.width) + 'px';
  canvas.style.height = Math.floor(viewport.height) + 'px';

  const transform = outputScale !== 1
    ? [outputScale, 0, 0, outputScale, 0, 0]
    : null;

  const context = canvas.getContext('2d');
  const renderContext = {
    canvasContext: context,
    transform: transform,
    viewport: viewport,
  };

  container.add(canvas);

  page.render(renderContext).promise.then(() => {
    cb(null);
  }).catch(err => {
    cb(err);
  });
}

/**
 * Render text layer via the official TextLayerBuilder (selection + browser find).
 * The builder creates and populates its own `.div` (class "textLayer"); we append it
 * and store the builder on the container for lazy-unload cleanup.
 */
function renderTextLayer(container, page, viewport) {
  const builder = new TextLayerBuilder({ pdfPage: page });
  container._textBuilder = builder;
  container.add(builder.div);
  return builder.render({ viewport });
}

/**
 * Render annotation layer via the official AnnotationLayerBuilder (clickable links).
 * Uses the shared PDFLinkService so internal destinations and external links both work.
 * The builder populates `.div` during render; we append it after and store the builder
 * for cleanup.
 */
function renderAnnotationLayer(container, page, viewport, linkService) {
  const builder = new AnnotationLayerBuilder({
    pdfPage: page,
    linkService,
    renderForms: false,
  });
  container._annotationBuilder = builder;

  return builder.render({ viewport, intent: 'display' }).then(() => {
    if (builder.div) container.add(builder.div);
  });
}

/**
 * Clean up pages that are far from current view
 */
function cleanupDistantPages(ctx, currentPageNum, viewer) {
  const distanceThreshold = 5;

  ctx.pageContainers.forEach((container, index) => {
    const pageNum = index + 1;
    const distance = Math.abs(pageNum - currentPageNum);

    if (distance > distanceThreshold && container.dataset.loaded === 'true') {
      // Cancel PDF.js builders so they release their rendering resources
      if (container._textBuilder) {
        container._textBuilder.cancel();
        container._textBuilder = null;
      }
      if (container._annotationBuilder) {
        container._annotationBuilder.cancel();
        container._annotationBuilder = null;
      }

      // Unload DOM layers to free memory
      const canvas = container.querySelector('.pdf-canvas');
      const textLayer = container.querySelector('.textLayer');
      const annotationLayer = container.querySelector('.annotationLayer');

      if (canvas) canvas.remove();
      if (textLayer) textLayer.remove();
      if (annotationLayer) annotationLayer.remove();

      container.dataset.loaded = 'false';
      viewer.loadedPages.delete(pageNum);
    }
  });
}
