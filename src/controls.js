'use strict'
import { h } from '@tpp/htm-x';

/**
 * Create navigation controls for PDF viewer
 *
 * Works with both flipbook and single-page viewers
 * Adapts to viewer API (flip_back/flip_forward or goToPage)
 *
 * @param {Object} viewer - Viewer instance with navigation methods
 * @param {Object} options - Configuration options
 * @returns {HTMLElement} Controls container
 */
export function createControls(viewer, options = {}) {
  const controls = h('div.bws-pdf-viewer-controls');

  // Previous button
  const prevBtn = h('button.bws-pdf-prev');
  prevBtn.textContent = options.prevText || '← Previous';
  prevBtn.attr({
    'aria-label': 'Previous page',
    'type': 'button',
  });

  prevBtn.on('click', () => {
    if (viewer.flip_back) {
      viewer.flip_back();
    } else if (viewer.goToPage && viewer.currentPage > 1) {
      viewer.goToPage(viewer.currentPage - 1);
    }
  });

  // Page counter
  const pageCounter = h('span.bws-pdf-viewer-page-counter');
  pageCounter.attr({ 'aria-live': 'polite', 'aria-atomic': 'true' });

  // Update counter function
  const updateCounter = () => {
    const current = viewer.currentPage || 1;
    const total = viewer.page_count || 0;
    pageCounter.textContent = `Page ${current} of ${total}`;

    // Update button states
    prevBtn.disabled = current <= 1;
    nextBtn.disabled = current >= total;

    // Visual feedback for disabled state
    if (current <= 1) {
      prevBtn.classList.add('disabled');
    } else {
      prevBtn.classList.remove('disabled');
    }

    if (current >= total) {
      nextBtn.classList.add('disabled');
    } else {
      nextBtn.classList.remove('disabled');
    }
  };

  // Next button
  const nextBtn = h('button.bws-pdf-next');
  nextBtn.textContent = options.nextText || 'Next →';
  nextBtn.attr({
    'aria-label': 'Next page',
    'type': 'button',
  });

  nextBtn.on('click', () => {
    if (viewer.flip_forward) {
      viewer.flip_forward();
    } else if (viewer.goToPage && viewer.currentPage < viewer.page_count) {
      viewer.goToPage(viewer.currentPage + 1);
    }
  });

  // Optional: First/Last buttons
  if (options.showFirstLast) {
    const firstBtn = h('button.bws-pdf-first');
    firstBtn.textContent = '⏮ First';
    firstBtn.attr({
      'aria-label': 'First page',
      'type': 'button',
    });
    firstBtn.on('click', () => {
      if (viewer.goToPage) {
        viewer.goToPage(1);
      }
    });

    const lastBtn = h('button.bws-pdf-last');
    lastBtn.textContent = 'Last ⏭';
    lastBtn.attr({
      'aria-label': 'Last page',
      'type': 'button',
    });
    lastBtn.on('click', () => {
      if (viewer.goToPage) {
        viewer.goToPage(viewer.page_count);
      }
    });

    controls.add(firstBtn);
    controls.add(prevBtn);
    controls.add(pageCounter);
    controls.add(nextBtn);
    controls.add(lastBtn);
  } else {
    // Standard layout: prev | counter | next
    controls.add(prevBtn);
    controls.add(pageCounter);
    controls.add(nextBtn);
  }

  // Listen to viewer events to update counter
  if (viewer.on) {
    viewer.on('seen', (pageNum) => {
      viewer.currentPage = pageNum;
      updateCounter();
    });

    viewer.on('page-loaded', () => {
      updateCounter();
    });
  }

  // Initial update
  updateCounter();

  // Keyboard shortcuts (if controls have focus)
  controls.on('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':
        if (!prevBtn.disabled) prevBtn.click();
        e.preventDefault();
        break;
      case 'ArrowRight':
        if (!nextBtn.disabled) nextBtn.click();
        e.preventDefault();
        break;
      case 'Home':
        if (viewer.goToPage) viewer.goToPage(1);
        e.preventDefault();
        break;
      case 'End':
        if (viewer.goToPage) viewer.goToPage(viewer.page_count);
        e.preventDefault();
        break;
    }
  });

  return controls;
}
