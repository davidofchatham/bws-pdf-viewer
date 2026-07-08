'use strict';
/**
 * ESLint flat config (ESLint v9+). Deliberately dependency-light: no `globals`
 * package — the small set of browser/node globals each area needs is declared
 * inline. Scope:
 *   - src/**      library source, ES modules, browser
 *   - includes/** WordPress integration, script-tag IIFE, browser + WP globals
 *   - test/**     verification scripts, CommonJS, node
 * dist/ and node_modules/ are built/vendored and not linted.
 */

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  history: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  requestAnimationFrame: 'readonly',
  IntersectionObserver: 'readonly',
  ResizeObserver: 'readonly',
  Image: 'readonly',
  Path2D: 'readonly',
  KeyboardEvent: 'readonly',
  AbortSignal: 'readonly',
};

const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  console: 'readonly',
};

const sharedRules = {
  'no-unused-vars': ['warn', { args: 'none' }],
  'no-undef': 'error',
  'no-console': 'off',
};

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'specs/**'],
  },
  {
    // Library source — ES modules bundled by webpack for the browser.
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: sharedRules,
  },
  {
    // WordPress integration — loaded via <script>, wrapped in an IIFE.
    files: ['includes/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...browserGlobals,
        // Globals provided at runtime by other enqueued scripts / WP.
        flipbook: 'readonly',
        pdfjsLib: 'readonly',
        bwsPdfViewerData: 'readonly',
      },
    },
    rules: sharedRules,
  },
  {
    // Verification scripts — CommonJS under node. They also embed browser code
    // inside playwright page.evaluate() closures, so browser globals are allowed.
    files: ['test/verify-*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...nodeGlobals, ...browserGlobals },
    },
    rules: sharedRules,
  },
  {
    // Webpack test entries — ES modules bundled for the browser.
    files: ['test/book-*.js', 'test/test-*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: sharedRules,
  },
  {
    // Build config — CommonJS run under node.
    files: ['webpack.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    rules: sharedRules,
  },
];
