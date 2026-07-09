'use strict'
import { h } from '@tpp/htm-x';
import * as EventEmitter from 'events';

class FlipbookViewer extends EventEmitter {};

const outputScale = window.devicePixelRatio || 1; // Support HiDPI-screens

/*    way/
 * pages drawn side-by-side in a spread: 2 normally, 1 for a genuine single-page
 * book (no second half exists). Keeps the box/layout/centering math consistent
 * so a 1-page book fills the box instead of drawing at half width (B22).
 */
function pagesAcross(ctx) {
  return (ctx.book && ctx.book.numPages() <= 1) ? 1 : 2;
}

/*    way/
 * number of spreads (views) to paginate over. The book wrapper knows how its
 * display slots pack into spreads (traditional inserts a leading blank; plain
 * packs two-up), so trust its numSpreads() when present. Fall back to the raw
 * two-up estimate for bare sources that don't wrap (test image books). Keying
 * the flip guards off spreads — not raw pages — is what stops a 2-page plain
 * book from flipping to a phantom trailing blank (B23).
 */
function numSpreads(ctx) {
  const b = ctx.book;
  if (b && typeof b.numSpreads === 'function') return b.numSpreads();
  const n = b ? b.numPages() : 0;
  return n <= 0 ? 0 : Math.ceil(n / 2);
}

/*    way/
 * set up the canvas and the toolbar, return the viewer,
 * then show the first page
 */
export function flipbookViewer(ctx, cb) {
  const viewer = new FlipbookViewer();
  viewer.page_count = ctx.book.numPages();

  setupCanvas(ctx, err => {
    if(err) return cb(err);

    calcLayoutParameters(ctx, err => {
      if(err) return cb(err);

      ctx.app.c(ctx.canvas.e);

      setupMouseHandler(ctx, viewer);

      ctx.zoom = 0;
      ctx.showNdx = 0;

      setupControls(ctx, viewer);

      cb(null, viewer);

      showPages(ctx, viewer);

    });

  });

}


function setupControls(ctx, viewer) {

  viewer.zoom = zoom => {
    zoom = Number(zoom);
    if(isNaN(zoom)) {
      zoom = ctx.zoom * 2 + 1;
      if(zoom > 4) zoom = 0;
    }
    if(!zoom) {
      ctx.zoom = 0;
      ctx.pan = null;
      showPages(ctx, viewer);
    } else {
      // Check if animations should be disabled
      if(ctx.shouldAnimate === false) {
        ctx.zoom = zoom;
        showPages(ctx, viewer);
      } else {
        animate({
          draw: curr => {
            ctx.zoom = curr.zoom;
            showPages(ctx, viewer);
          },
          duration: 500,
          from: { zoom: ctx.zoom },
          to: { zoom },
          timing: t => t * t * (3.0 - 2.0 * t),
        })
      }
    }
  }

  /*    way/
   * jump directly to a 1-based page with no flip animation.
   * Respects the in-flight-flip guard exactly as flip_forward does.
   * showPages renders spread `showNdx` as book.getPage(showNdx*2) and (showNdx*2+1).
   * Both layouts place page P in spread floor(P/2):
   *   traditional (wrapped): display 0→p1, 2→p2, 3→p3 …  → p1 in spread 0, p2/p3 spread 1
   *   spread (raw, 1-based):  getPage(0)=∅, 1=p1, 2=p2 … → p1 in spread 0, p2/p3 spread 1
   * so the single expression is correct for both — no layout branch needed.
   * showPages emits the 0-based 'seen' index itself, so we do not emit here
   * (preserves the payload convention — contracts/viewer-api.md).
   */
  viewer.goToPage = pageNum => {
    if(ctx.flipNdx || ctx.flipNdx === 0) return;
    const total = ctx.book.numPages();
    if(pageNum < 1 || pageNum > total) return;
    // Map the 1-based real page to its spread. The wrapper owns the packing
    // convention (traditional vs plain), so prefer its mapping; fall back to the
    // traditional floor(page/2) for bare sources. Clamp to the last spread (B23).
    const b = ctx.book;
    let ndx = (b && typeof b.pageToSpread === 'function')
      ? b.pageToSpread(pageNum)
      : Math.floor(pageNum / 2);
    const last = Math.max(0, numSpreads(ctx) - 1);
    ctx.showNdx = Math.min(ndx, last);
    showPages(ctx, viewer);
  }

  viewer.flip_forward = () => {
    if(ctx.flipNdx || ctx.flipNdx === 0) return;
    // Block at the last spread — guard on spread count, not raw pages, so a plain
    // 2-page book (one [p1|p2] spread) can't flip to a phantom trailing blank (B23).
    if(ctx.showNdx >= numSpreads(ctx) - 1) return;
    ctx.flipNdx = ctx.showNdx + 1;
    flip_1(ctx);
  }
  viewer.flip_back = () => {
    if(ctx.flipNdx || ctx.flipNdx === 0) return;
    if(ctx.book.numPages() <= 1) return;
    if(!ctx.showNdx) return;
    ctx.flipNdx = ctx.showNdx - 1;
    flip_1(ctx);
  }

  function flip_1(ctx) {
    // Check if animations should be disabled
    if(ctx.shouldAnimate === false) {
      // Instant page change without animation
      ctx.showNdx = ctx.flipNdx;
      ctx.flipNdx = null;
      showPages(ctx, viewer);
    } else {
      animate({
        draw: curr => {
          ctx.flipFrac = curr.flipFrac;
          showFlip(ctx, viewer);
        },
        duration: 1111,
        from: { flipFrac: 0 },
        to: { flipFrac: 1 },
        timing: t => t * t * (3.0 - 2.0 * t),
        ondone: () => {
          ctx.showNdx = ctx.flipNdx;
          ctx.flipNdx = null;
          showPages(ctx, viewer);
        }
      })
    }
  }
}


/*    way/
 * set up a canvas element with some width
 * and height and use the first page to
 * calculate the display.
 */
function setupCanvas(ctx, cb) {
  const canvas = {
    e: h("canvas")
  };

  canvas.ctx = canvas.e.getContext('2d');
  canvas.e.width = Math.floor(ctx.sz.boxw * outputScale);
  canvas.e.height = Math.floor(ctx.sz.boxh * outputScale);
  canvas.e.style.width = Math.floor(ctx.sz.boxw) + "px";
  canvas.e.style.height = Math.floor(ctx.sz.boxh) + "px";

  ctx.canvas = canvas;
  cb();
}

/*    way/
 * use the first page to calculate enough space
 * for showing a double-page view.
 */
function calcLayoutParameters(ctx, cb) {
  const w = ctx.sz.boxw * outputScale;
  const h = ctx.sz.boxh * outputScale;

  ctx.book.getPage(1, (err, pg) => {
    if(err) return cb(err);

    // B22: a genuine 1-page book has no second half. The renderer otherwise assumes a
    // 2-page spread everywhere (pg.width*2, then centeredHalf halves it), which — against
    // a box the WP layer sized one page wide (V24) — draws the lone page at half width
    // with dead space beside it. Key the across-factor off the real page count so the box,
    // the layout, and centeredHalf all agree.
    const across = pagesAcross(ctx);
    const usableH = 1 - (ctx.sz.marginTop/100);
    let height = h * usableH;
    const usableW = 1 - (ctx.sz.marginLeft/100);
    let width = (pg.width * across) * (height / pg.height);
    const maxwidth = w * usableW;
    if(width > maxwidth) {
      width = maxwidth;
      height = (pg.height) * (width / (pg.width * across));
    }

    ctx.layout = {
      top: (h - height) / 2,
      left: (w - width) / 2,
      mid: w / 2,
      width: width,
      height,
    };

    cb();
  });
}

/*    way/
 * capture mouse events, passing them to the
 * actual handlers if set up
 */
function setupMouseHandler(ctx, viewer) {
  const handlers = [
    setupPanning(ctx, viewer),
  ];

  const events = [
    "onmouseenter", "onmouseleave",
    "onmousemove",
    "onclick",
    "onmousedown", "onmouseup",
  ];

  const attr = {};
  events.map(e => {
    attr[e] = evt => {
      handlers.map(h => {
        if(h[e]) h[e](evt);
      })
    }
  })

  ctx.app.attr(attr);
}

/*    way/
 * set up the ctx.pan offsets (only when zooming),
 * starting on the first mouse click and ending when
 * mouse up or we leave the box
 */
function setupPanning(ctx, viewer) {
  let start;

  function onmouseleave(evt) {
    start = null;
  }

  function onmousedown(evt) {
    if(!ctx.zoom) return;
    start = mousePt(ctx, evt);
    if(ctx.pan) {
      start.x -= ctx.pan.x;
      start.y -= ctx.pan.y;
    }
  }

  function onmouseup(evt) {
    start = null;
  }

  function onmousemove(evt) {
    const pt = mousePt(ctx, evt);
    if(start && inBox(ctx, pt)) {
      ctx.pan = {
        x: (pt.x - start.x),
        y: (pt.y - start.y),
      };
      showPages(ctx, viewer);
    } else {
      start = null;
    }
  }

  return {
    onmouseleave,
    onmousedown,
    onmouseup,
    onmousemove,
  };

}

/*    way/
 * return true if the point is in the current box
 */
function inBox(ctx, pt) {
  const rt = currBox(ctx);
  return (rt.top <= pt.y && rt.bottom >= pt.y &&
          rt.left <= pt.x && rt.right >= pt.x);
}

/*    way/
 * return the location of the mouse relative to the app area
 */
function mousePt(ctx, evt) {
  const rect = ctx.app.getBoundingClientRect();
  return {
    x: evt.clientX - rect.x,
    y: evt.clientY - rect.y
  };
}

/*    way/
 * return the current rectangle
 */
function currBox(ctx) {
  const l = calcLayout(ctx);
  return {
    top: l.top,
    left: l.left,
    bottom: l.top + l.height,
    right: l.left + l.width,
  };
}

/*    understand/
 * return the layout, adjusted for zoom and panning
 */
function calcLayout(ctx) {
  let layout = ctx.layout;

  if(ctx.zoom > 0) {
    layout = Object.assign({}, layout);
    if(ctx.zoom) {
      const zoom = ctx.zoom * 0.5;
      layout.left = layout.left - layout.width * zoom / 2;
      layout.top = layout.top - layout.height * zoom / 2;
      layout.width = layout.width * (1 + zoom);
      layout.height = layout.height * (1 + zoom);
    }
    if(ctx.pan) {
      layout.left += ctx.pan.x;
      layout.top += ctx.pan.y;
      layout.mid += ctx.pan.x;
    }
  }

  return layout;
}

/*    way/
 * show the background and the pages on the viewer
 */
function showPages(ctx, viewer) {
  const canvas = ctx.canvas;
  const left_ = ctx.showNdx * 2;
  const right_ = left_ + 1;
  canvas.ctx.save();
  show_bg_1();
  ctx.book.getPage(left_, (err, left) => {
    if(err) return console.error(err);
    if(!ctx.flipNdx && ctx.flipNdx !== 0 && left) viewer.emit('seen', left_);
    ctx.book.getPage(right_, (err, right) => {
      if(err) return console.error(err);
      if(!ctx.flipNdx && ctx.flipNdx !== 0 && right) viewer.emit('seen', right_);
      show_pgs_1(left, right, () => canvas.ctx.restore());
    })
  })

  /*    way/
   * get the current layout and, if no zoom, show the
   * surrounding box. Otherwise show the left and right
   * pages on the correct positions
   */
  function show_pgs_1(left, right, cb) {
    const layout = calcLayout(ctx);

    // V21: when exactly one side is a real page (traditional cover, or a trailing
    // odd page), center that lone page instead of pinning it to its half with a
    // blank adjacent slot. The traditional book wrapper fills the empty half with a
    // BLANK page object (num===0), not null — so absence is `!pg || pg.num===0`,
    // not just `!pg`. A full spread (both real) draws normally.
    const leftReal  = isRealPage(left);
    const rightReal = isRealPage(right);
    if(leftReal && !rightReal) {
      const loc = centeredHalf(layout);
      if(ctx.zoom == 0) show_bx_1(loc);
      show_pg_1(left, loc);
    } else if(rightReal && !leftReal) {
      const loc = centeredHalf(layout);
      if(ctx.zoom == 0) show_bx_1(loc);
      show_pg_1(right, loc);
    } else {
      if(ctx.zoom == 0) show_bx_1(layout);
      const page_l = Object.assign({}, layout);
      const page_r = Object.assign({}, layout);
      page_l.width /= 2;
      page_r.width /= 2;
      page_r.left = layout.mid;
      if(left) show_pg_1(left, page_l);
      if(right) show_pg_1(right, page_r);
    }
    cb();
  }

  function show_pg_1(pg, loc) {
    canvas.ctx.drawImage(pg.img, loc.left, loc.top, loc.width, loc.height);
  }

  /*    way/
   * V21: a page is "real" (occupies its slot) unless it's the traditional
   * wrapper's blank filler, which carries num===0. Sources that don't tag pages
   * with a numeric `num` are always treated as real.
   */
  function isRealPage(pg) {
    return !!pg && pg.num !== 0;
  }

  /*    way/
   * V21: a single page occupies one half-width, centered in the full spread box.
   */
  function centeredHalf(layout) {
    // For a multi-page spread this is one half (traditional cover / trailing odd page).
    // For a 1-page book the layout box is already one page wide, so keep full width and
    // don't offset — halving here is what left the lone page at 50% with dead space (B22).
    const across = pagesAcross(ctx);
    const loc = Object.assign({}, layout);
    loc.width = layout.width / across;
    loc.left = layout.left + (layout.width - loc.width) / 2;
    return loc;
  }

  function show_bx_1(loc) {
    // Transparent box → draw nothing (the page itself still paints over it).
    if(!ctx.color.bx || ctx.color.bx === 'transparent') return;
    canvas.ctx.fillStyle = ctx.color.bx;
    const border = ctx.sz.bx_border;
    canvas.ctx.fillRect(loc.left - border, loc.top-border, loc.width+border*2, loc.height+2*border);
  }

  function show_bg_1() {
    const w = ctx.sz.boxw * outputScale;
    const h = ctx.sz.boxh * outputScale;
    // Always clear first so the previous flip frame doesn't smear.
    canvas.ctx.clearRect(0, 0, w, h);
    // A transparent bg lets the host page show through around/beside the pages;
    // any other color paints an opaque fill as before.
    if(ctx.color.bg && ctx.color.bg !== 'transparent') {
      canvas.ctx.fillStyle = ctx.color.bg;
      canvas.ctx.fillRect(0, 0, w, h);
    }
  }
}

/*    way/
 * show the current pages, then overlay the current flip
 */
function showFlip(ctx, viewer) {
  showPages(ctx, viewer);

  const canvas = ctx.canvas;
  const left = ctx.flipNdx * 2;
  const right = left + 1;
  const layout = calcLayout(ctx);
  const strength = 0.5 - Math.abs(0.5 - ctx.flipFrac);
  canvas.ctx.save();

  ctx.book.getPage(left, (err, left) => {
    if(err) return console.error(err);
    ctx.book.getPage(right, (err, right) => {
      if(err) return console.error(err);
      show_flip_1(left, right, ctx.flipFrac, () => canvas.ctx.restore());
    })
  })


  function show_flip_1(left, right, frac, cb) {
    let loc, show, width, region, xloc, oheight, otop, controlpt, endpt;

    if(ctx.showNdx < ctx.flipNdx) {

      loc = Object.assign({}, layout);
      loc.width /= 2;
      loc.left = layout.mid;
      show = loc.left + (1 - frac) * loc.width;
      width = loc.width * frac;
      xloc = xpand_rect_1(ctx, loc);
      canvas.ctx.save();
      region = new Path2D();
      region.rect(show, xloc.top-5, width, xloc.height+10);
      canvas.ctx.clip(region);
      if(right) {
        canvas.ctx.drawImage(right.img, loc.left, loc.top, loc.width, loc.height);
      } else {
        show_empty_1(ctx.color.bg, xloc);
      }
      canvas.ctx.restore();

      loc = Object.assign({}, layout);
      loc.left += (1 - frac) * loc.width;
      loc.width /= 2;
      width = loc.width * frac;

      oheight = loc.height;
      otop = loc.top;
      loc.height *= (1 + strength * 0.1);
      loc.top -= (loc.height-oheight)/2;

      canvas.ctx.save();
      region = new Path2D();
      region.moveTo(loc.left, otop);
      region.lineTo(loc.left, otop + oheight);
      controlpt = {
        x: loc.left + width / 2,
        y: loc.top + loc.height,
      };
      endpt = {
        x: loc.left + width,
        y: otop + oheight,
      };
      region.quadraticCurveTo(controlpt.x, controlpt.y, endpt.x, endpt.y);
      region.lineTo(endpt.x, otop);
      controlpt = {
        x: loc.left + width,
        y: loc.top
      };
      endpt = {
        x: loc.left,
        y: otop,
      };
      region.quadraticCurveTo(controlpt.x, controlpt.y, endpt.x, endpt.y);
      canvas.ctx.clip(region);
      canvas.ctx.drawImage(left.img, loc.left, loc.top, loc.width, loc.height);
      canvas.ctx.restore();


      canvas.ctx.save();
      const shadowsz = (loc.width / 2) * Math.max(Math.min(strength, 0.5), 0);

      // Draw a sharp shadow on the left side of the page
      canvas.ctx.strokeStyle = 'rgba(0,0,0,'+(0.1 * strength)+')';
      canvas.ctx.lineWidth = 30 * strength;
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(loc.left, otop);
      canvas.ctx.lineTo(loc.left, otop + oheight);
      canvas.ctx.stroke();

      // Right side drop shadow
      let gradient = canvas.ctx.createLinearGradient(loc.left + width, otop, loc.left+width+shadowsz, otop);
      gradient.addColorStop(0, 'rgba(0,0,0,'+ (0.3*strength)+')');
      gradient.addColorStop(0.8, 'rgba(0,0,0,0.0)');
      canvas.ctx.fillStyle = gradient;
      canvas.ctx.fillRect(loc.left + width, otop, width + shadowsz, oheight);

      canvas.ctx.restore();

    } else {

      loc = Object.assign({}, layout);
      loc.width /= 2;
      width = loc.width * frac + ctx.sz.bx_border;
      xloc = xpand_rect_1(ctx, loc);
      canvas.ctx.save();
      region = new Path2D();
      region.rect(xloc.left, xloc.top-5, width, xloc.height+10);
      canvas.ctx.clip(region);
      if(left) {
        canvas.ctx.drawImage(left.img, loc.left, loc.top, loc.width, loc.height);
      } else {
        show_empty_1(ctx.color.bg, loc);
      }
      canvas.ctx.restore();


      loc = Object.assign({}, layout);
      loc.width /= 2;
      show = loc.left + frac * loc.width;
      loc.left = show - (1 - frac) * loc.width;
      width = loc.width * frac;

      oheight = loc.height;
      otop = loc.top;
      loc.height *= (1 + strength * 0.1);
      loc.top -= (loc.height-oheight)/2;

      canvas.ctx.save();
      region = new Path2D();
      region.moveTo(show, otop);
      region.lineTo(show, otop + oheight);
      controlpt = {
        x: show + width / 2,
        y: loc.top + loc.height,
      };
      endpt = {
        x: show + width,
        y: otop + oheight,
      };
      region.quadraticCurveTo(controlpt.x, controlpt.y, endpt.x, endpt.y);
      region.lineTo(endpt.x, otop);
      controlpt = {
        x: show + width,
        y: loc.top
      };
      endpt = {
        x: show,
        y: otop,
      };
      region.quadraticCurveTo(controlpt.x, controlpt.y, endpt.x, endpt.y);
      canvas.ctx.clip(region);
      canvas.ctx.drawImage(right.img, loc.left, loc.top, loc.width, loc.height);
      canvas.ctx.restore();


      canvas.ctx.save();
      const shadowsz = (loc.width / 2) * Math.max(Math.min(strength, 0.5), 0);

      // Draw a sharp shadow on the right side of the page
      canvas.ctx.strokeStyle = 'rgba(0,0,0,'+(0.1 * strength)+')';
      canvas.ctx.lineWidth = 30 * strength;
      canvas.ctx.beginPath();
      canvas.ctx.moveTo(show + width, otop);
      canvas.ctx.lineTo(show + width, otop + oheight);
      canvas.ctx.stroke();

      // Left side drop shadow
      let gradient = canvas.ctx.createLinearGradient(show, otop, show-shadowsz, otop);
      gradient.addColorStop(0, 'rgba(0,0,0,'+ (0.3*strength)+')');
      gradient.addColorStop(0.8, 'rgba(0,0,0,0.0)');
      canvas.ctx.fillStyle = gradient;
      canvas.ctx.fillRect(show-shadowsz, otop, shadowsz, oheight);

      canvas.ctx.restore();

    }

    cb();
  }

  function show_empty_1(fillStyle, loc) {
    // Transparent → leave the slot empty (host page shows through during a flip).
    if(!fillStyle || fillStyle === 'transparent') return;
    canvas.ctx.fillStyle = fillStyle;
    const border = ctx.sz.bx_border;
    canvas.ctx.fillRect(loc.left - border, loc.top-border-5, loc.width+border*2, loc.height+2*border+10);
  }

  function xpand_rect_1(ctx, loc) {
    const border = ctx.sz.bx_border;
    return {
      left: loc.left - border,
      top: loc.top - border,
      width: loc.width + border * 2,
      height: loc.height + border * 2,
    };
  }

}

/*    understand/
 * animate the properties {from -> to} , calling ondone when ends
 */
function animate({ draw, duration, from, to, timing, ondone }) {
  if(!ondone) ondone = () => 1;
  if(!timing) timing = t => t;

  const start = Date.now();

  animate_1();

  function animate_1() {
    let frac = (Date.now() - start) / duration;
    if(frac > 1) frac = 1;
    const curr = progress_1(frac);
    draw(curr);
    if(frac === 1) ondone();
    else requestAnimationFrame(animate_1);
  }

  function progress_1(frac) {
    frac = timing(frac);
    const ret = Object.assign({}, from);
    for(let k in from) {
      const s = Number(from[k]);
      const e = Number(to[k]);
      ret[k] = s + (e - s) * frac;
    }
    return ret;
  }
}
