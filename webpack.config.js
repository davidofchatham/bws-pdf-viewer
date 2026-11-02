'use strict'
const path = require('path')

const base = {
  entry: {
    // Bundle of all three viewer engines (flip + native + image), routed by
    // src/index.js. Named -engines to signal it is NOT flip-only; the UMD global
    // is still `flipbook` (legacy; renaming it is separate churn — see FW-6).
    'bws-viewer-engines': {
      import: './src/index.js',
      library: {
        name: 'flipbook',
        type: 'umd',
        umdNamedDefine: true,
      },
    },
    // PDF.js library with automatic worker setup (zero-config webpack approach).
    // Import `pdfjs-dist/webpack.mjs`, NOT `pdfjs-dist/build/pdf.mjs`: it sets
    // GlobalWorkerOptions.workerPort and emits the worker as the `pdf.worker.js`
    // chunk (output.chunkFilename below), so there is no "Setting up fake worker"
    // warning and no manual worker registration or enqueue. The `.mjs` rule below
    // (`javascript/auto`) is required for it.
    // https://github.com/mozilla/pdf.js/blob/master/examples/webpack/
    'pdf': {
      import: 'pdfjs-dist/webpack.mjs',
      library: {
        name: 'pdfjsLib',
        type: 'umd',
        umdNamedDefine: true,
      },
    },
    // Test book provider
    'book.pdf': {
      import: './test/book-pdf.js',
      library: {
        name: 'book',
        type: 'umd',
        umdNamedDefine: true,
      },
    },
  },
  output: {
    filename: '[name].js',
    chunkFilename: 'pdf.worker.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.js', '.mjs', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        loader: 'svg-inline-loader'
      },
      {
        test: /\.mjs$/,
        include: /node_modules/,
        type: 'javascript/auto'
      }
    ]
  }
}

const dev = Object.assign({}, base, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './test',
    allowedHosts: 'testing-page-flip.com',
  },

  entry: Object.assign({
    'test-imgs': './test/test-imgs.js',
    'test-pdf': './test/test-pdf.js',
    'test-pdf-sp': './test/test-pdf-sp.js',
  }, base.entry),

})

const prod = Object.assign({}, base, {
  mode: "production",
})

module.exports = env => {
  if(!env.production && env.development) return dev
  else return prod
}
