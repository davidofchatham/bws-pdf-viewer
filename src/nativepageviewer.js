'use strict'
import { h } from '@tpp/htm-x';
import * as EventEmitter from 'events';

/**
 * Native PDF.js Page Viewer
 *
 * Renders PDF pages using native PDF.js with:
 * - Canvas layer for visual rendering
 * - Text layer for selection and search
 * - Annotation layer for clickable links
 * - Lazy loading for performance
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
 * Main entry point for native page viewer
 */
export function nativePageViewer(ctx, cb) {
  const viewer = new NativePageViewer();
  const pdf = ctx.book.pdf;

  if (!pdf) {
    return cb('Native viewer requires PDF.js document object');
  }

  viewer.page_count = pdf.numPages;

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

        if (!loaded) {
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

  pdf.getPage(pageNum).then(page => {
    const viewport = page.getViewport({ scale: ctx.scale });

    // Render canvas layer
    renderCanvas(container, page, viewport, err => {
      if (err) {
        console.error('Error rendering canvas:', err);
        return;
      }

      // Render text layer (for selection and search)
      page.getTextContent().then(textContent => {
        renderTextLayer(container, textContent, viewport);
      }).catch(err => {
        console.warn('Text layer rendering failed:', err);
      });

      // Render annotation layer (for links)
      page.getAnnotations().then(annotations => {
        renderAnnotationLayer(container, annotations, viewport, page);
      }).catch(err => {
        console.warn('Annotation layer rendering failed:', err);
      });

      container.dataset.loaded = 'true';
      viewer.loadedPages.add(pageNum);
      viewer.emit('page-loaded', pageNum);
    });
  }).catch(err => {
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
 * Render text layer (enables text selection and search)
 */
function renderTextLayer(container, textContent, viewport) {
  const textLayerDiv = h('div.textLayer');
  textLayerDiv.style.width = Math.floor(viewport.width) + 'px';
  textLayerDiv.style.height = Math.floor(viewport.height) + 'px';

  container.add(textLayerDiv);

  // Use PDF.js built-in text layer renderer if available
  if (typeof pdfjsLib !== 'undefined' && pdfjsLib.renderTextLayer) {
    pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: textLayerDiv,
      viewport: viewport,
      textDivs: [],
    });
  }
}

/**
 * Render annotation layer (enables clickable links)
 */
function renderAnnotationLayer(container, annotations, viewport, page) {
  if (!annotations || annotations.length === 0) return;

  const annotationLayerDiv = h('div.annotationLayer');
  annotationLayerDiv.style.width = Math.floor(viewport.width) + 'px';
  annotationLayerDiv.style.height = Math.floor(viewport.height) + 'px';

  container.add(annotationLayerDiv);

  // Use PDF.js built-in annotation layer renderer if available
  if (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationLayer) {
    pdfjsLib.AnnotationLayer.render({
      annotations: annotations,
      div: annotationLayerDiv,
      viewport: viewport.clone({ dontFlip: true }),
      page: page,
      linkService: createLinkService(),
      renderForms: false,
    });
  }
}

/**
 * Create a simple link service for annotations
 */
function createLinkService() {
  return {
    externalLinkTarget: 2, // Open in new tab
    externalLinkRel: 'noopener noreferrer',
    externalLinkEnabled: true,

    getDestinationHash: (dest) => {
      return '#';
    },

    getAnchorUrl: (hash) => {
      return hash;
    },

    executeNamedAction: (action) => {
      console.log('Named action:', action);
    },

    executeSetOCGState: (action) => {
      console.log('OCG state:', action);
    },
  };
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
      // Unload page to free memory
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
