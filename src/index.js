'use strict'
import { getH } from '@tpp/htm-x';

import { flipbookViewer } from "./flipbookviewer.js";
import { singlePageViewer } from "./singlepageviewer.js";
import { nativePageViewer } from "./nativepageviewer.js";
import pkg from '../package.json';

/*    way/
 * Resolve a color option to a paintable value.
 *  - undefined / null / "" -> fallback (no color set: bare-library use, or a
 *    legacy empty-string still in the DB; re-saving admin omits the key so the
 *    plugin's own default flows through instead)
 *  - any other value (hex / 'transparent') -> used as-is
 * The library does NOT materialize "" into 'transparent': that would freeze
 * today's meaning and stop a future default change from reaching those inputs.
 */
function normalizeColor(value, fallback) {
  if(fallback === undefined) fallback = "#353535";
  if(value === undefined || value === null || value === '') return fallback;
  return value;
}

/*    way/
 * set up the options and return the requested viewer
 */
export function init(book, id, opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if(!opts) opts = {};
  if(!cb) cb = () => 1;
  const app = getH(id);
  if(!app) {
    const emsg = ("bws-pdf-viewer: Failed to find container for viewer: " + id);
    console.error(emsg);
    cb(emsg);
    return;
  }

  if(opts.singlepage) {

    // Choose between native PDF.js viewer and image-based viewer
    if(opts.nativeMode && book.pdf) {
      // Native mode: direct PDF.js rendering with text/annotation layers
      nativePageViewer({ app, book, opts }, ret_1);
    } else {
      // Image mode: convert pages to images (mobile/fallback)
      singlePageViewer({ app, book }, ret_1);
    }

  } else {

    const ctx = {
      color: {
        // An empty string means "no color set" — treat it as transparent, not the
        // grey fallback. Only a truly-absent option (undefined) uses the default.
        bg: normalizeColor(opts.backgroundColor),
        bx: normalizeColor(opts.boxColor, normalizeColor(opts.backgroundColor)),
      },
      sz: {
        bx_border: opts.boxBorder || 0,
        boxw: opts.width || 800,
        boxh: opts.height || 600,
      },
      app,
      book,
      shouldAnimate: opts.shouldAnimate !== false, // Default to true
    };

    const margin = opts.margin || 1;
    if(opts.marginTop || opts.marginTop === 0) ctx.sz.marginTop = opts.marginTop;
    else ctx.sz.marginTop = margin;
    if(opts.marginLeft || opts.marginLeft === 0) ctx.sz.marginLeft = opts.marginLeft;
    else ctx.sz.marginLeft = margin;

    flipbookViewer(ctx, ret_1);
  }


  function ret_1(err, viewer) {
    if(opts.popup) history.pushState({}, "", "#");
    if(viewer) viewer.version = pkg.version;
    return cb(err, viewer);
  }
}
