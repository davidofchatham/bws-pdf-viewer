#!/usr/bin/env node
/**
 * Build a WordPress-installable plugin zip locally — no repo release needed.
 *
 * Collects only runtime files and writes build/bws-pdf-viewer-<version>.zip with
 * every entry nested under a single `bws-pdf-viewer/` folder and named with
 * FORWARD slashes (the ZIP spec, APPNOTE 4.4.17, requires '/'; Windows tooling
 * that writes '\\' makes WordPress's unzip flatten the path → "Plugin file does
 * not exist"). Excludes all dev/spec/test/tooling files.
 *
 * Pure Node, store-only (no compression) — no PowerShell, no `zip` binary, no npm
 * archiver dependency, and no separate staging copy that a Drive/OneDrive sync
 * could lock mid-write. PDF assets barely compress, so store-only costs little.
 *
 * Usage: npm run package   (runs `npm run start` first via the npm script)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, crc32 } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slug = 'bws-pdf-viewer';
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;

const buildDir = join(root, 'build');
const zipPath = join(buildDir, `${slug}-${version}.zip`);

// Exact runtime file set — everything WordPress needs to run the plugin, nothing else.
// dist/*.map and dist/book.pdf.js (test artifact) are deliberately omitted.
const include = [
  'bws-pdf-viewer.php',
  'readme.txt',
  'LICENSE',
  'includes/admin.php',
  'includes/bws-pdf-viewer.js',
  'includes/bws-pdf-viewer.css',
  'dist/bws-viewer-engines.js',
  'dist/pdf.js',
  'dist/pdf.worker.js',
];

// Optional extras shipped only if present. A directory (e.g. languages/) is walked.
const optional = ['dist/pdf.worker.js.LICENSE.txt', 'languages'];

function fail(msg) {
  console.error(`\n✗ package failed: ${msg}\n`);
  process.exit(1);
}

// node:zlib exposes crc32 (Node 20.15+). Fall back to a local table impl if absent.
const crc =
  typeof crc32 === 'function'
    ? (buf) => crc32(buf) >>> 0
    : (() => {
        const table = Array.from({ length: 256 }, (_, n) => {
          let c = n;
          for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
          return c >>> 0;
        });
        return (buf) => {
          let c = 0xffffffff;
          for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
          return (c ^ 0xffffffff) >>> 0;
        };
      })();

// Expand the include+optional list into concrete { entryName, absPath } file records.
function collectFiles() {
  const files = [];
  const add = (rel, required) => {
    const abs = join(root, rel);
    if (!existsSync(abs)) {
      if (required) fail(`required file missing: ${rel} (did \`npm run start\` build dist/?)`);
      return;
    }
    if (statSync(abs).isDirectory()) {
      for (const child of readdirSync(abs)) add(posix.join(rel, child), false);
    } else {
      // entryName: slug/<rel>, forced to forward slashes.
      files.push({ entryName: `${slug}/${rel.split(/[\\/]/).join('/')}`, absPath: abs });
    }
  };
  include.forEach((rel) => add(rel, true));
  optional.forEach((rel) => add(rel, false));
  return files;
}

// Minimal ZIP writer (store or deflate per entry). Local headers + central directory.
function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n >>> 0); return b; };
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

  for (const { entryName, absPath } of files) {
    const data = readFileSync(absPath);
    const nameBuf = Buffer.from(entryName, 'utf8');
    const checksum = crc(data);

    // Deflate; fall back to store if it doesn't help.
    const deflated = deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    // Local file header
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(method),
      u16(0), u16(0),                 // mod time/date (0 — reproducible)
      u32(checksum), u32(body.length), u32(data.length),
      u16(nameBuf.length), u16(0), nameBuf,
    ]);
    chunks.push(local, body);

    // Central directory record for this entry
    central.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(method),
      u16(0), u16(0),
      u32(checksum), u32(body.length), u32(data.length),
      u16(nameBuf.length), u16(0), u16(0), u16(0), u16(0),
      u32(0),                         // external attrs
      u32(offset),                    // local header offset
      nameBuf,
    ]));

    offset += local.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0),
    u16(files.length), u16(files.length),
    u32(centralBuf.length), u32(offset), u16(0),
  ]);

  return Buffer.concat([...chunks, centralBuf, end]);
}

const files = collectFiles();

// Sanity: every required runtime file must be present in the entry list.
const missing = include.filter(
  (rel) => !files.some((f) => f.entryName === `${slug}/${rel.split(/[\\/]/).join('/')}`)
);
if (missing.length) fail(`missing required files: ${missing.join(', ')}`);

rmSync(buildDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
writeFileSync(zipPath, buildZip(files));

console.log(`\n✓ built ${slug}-${version}.zip  (${files.length} files)`);
files.forEach((f) => console.log(`    ${f.entryName}`));
console.log(`\n  ${zipPath}`);
console.log(`  install: wp-admin → Plugins → Add New → Upload Plugin → choose this zip\n`);
