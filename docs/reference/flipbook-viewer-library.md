# Underlying Flipbook Viewer Library

> **Reference only — not the shipped API.**
>
> This documents the small underlying `flipbook-viewer` JavaScript library that
> `src/` wraps. It is **not** how the BWS PDF Viewer WordPress plugin is used —
> for that, see the `[bws_pdf]` shortcode in the main [README](../../README.md).
>
> Kept as provenance for the original engine interface: the `numPages`/`getPage`
> book contract, the `singlepage` option, and the `seen` event are still what the
> plugin's `src/` code builds on, so this is useful when working on the core.

## Usage

Below shows the flip `book` on the given `div` with the id `div-id`:

```js
'use strict'

import { init as flipbook } from 'flipbook-viewer';

...

flipbook(book, 'div-id', (err, viewer) => {
  if(err) console.error(err);

  console.log('Number of pages: ' + viewer.page_count);
  viewer.on('seen', n => console.log('page number: ' + n));

  next.onclick = () => viewer.flip_forward();
  prev.onclick = () => viewer.flip_back();
  zoom.onclick = () => viewer.zoom();

});
```

The viewer can show *any* flip book. All you need to do is provide a book interface:

```js
{
  numPages: () => {
    /* return number of pages */
  },
  getPage: (num, cb) => {
    /* return page number 'num'
     * in the callback 'cb'
     * as any CanvasImageSource:
     * (CSSImageValue, HTMLImageElement, 
     *  SVGImageElement, HTMLVideoElement,
     *  HTMLCanvasElement, ImageBitmap,
     *  OffscreenCanvas)
     */
  }
}
```

## Options

An optional `opts` parameter can be passed in to change the UI:

```js
const opts = {
  backgroundColor: "#353535",
  boxColor: "#353535",
  width: 800,
  height: 600,
}

flipbook(book, 'div-id', opts, (err, viewer) => ...
```

## Events

You can listen on the `viewer` for which pages were seen:

```js
viewer.on('seen', n => ...)
```

## Programmatic API

The returned viewer can be used to programmatically control the viewer:

```js
viewer.flip_forward()
viewer.flip_back()
viewer.zoom()
```

## Single Page View

Finally, sometimes it makes sense to just show the book as a simple, scrollable view. To pass in only a `singlepage:true` option:

```js
flipbook(book, 'div-id', {singlepage:true}, (err, viewer) => ...
```

This generates canvases with `class="flipbook__page"` and `id="flipbook__pgnum_<n>"`
for CSS styling, and raises the same `seen` event as the flipbook viewer.

> This library-level single-page path is the simple, image-based viewer. The
> WordPress plugin's `document` mode adds the native PDF.js path (text/links,
> lazy loading, memory management) on top — see the main [README](../../README.md).
