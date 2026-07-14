'use strict';

const fs = require('fs');
const path = require('path');

const { readEntries } = require('./zip-reader');
const qti12 = require('./parse-qti12');
const qti21 = require('./parse-qti21');
const { sortItems } = require('./sort');
const { buildItemPreviewHtml, buildPrintPreviewHtml } = require('./page-templates');

/**
 * Detects whether an archive is QTI v1.2 or v2.1 by sniffing the first
 * item XML file's root/child element names, rather than trusting
 * imsmanifest.xml's `type` attribute (present in both exemplars, but
 * cheaper and more robust to confirm from the actual item content). Falls
 * back to imsmanifest.xml's resource `type` attribute if no item files can
 * be sniffed (e.g. a manifest-only archive).
 */
function detectQtiVersion(entries) {
  const itemEntry = entries.find((e) => e.name.endsWith('.xml') && e.name.toLowerCase() !== 'imsmanifest.xml' && !e.isDirectory);
  if (itemEntry) {
    const text = itemEntry.getData().toString('utf8');
    if (/<assessmentItem[\s>]/.test(text)) return 'qti2.1';
    if (/<questestinterop[\s>]/.test(text) || /<item[\s>]/.test(text)) return 'qti1.2';
  }
  const manifestEntry = entries.find((e) => e.name.toLowerCase() === 'imsmanifest.xml');
  if (manifestEntry) {
    const text = manifestEntry.getData().toString('utf8');
    if (/imsqti_item_xmlv2p1/.test(text)) return 'qti2.1';
    if (/imsqti_xmlv1p2/.test(text)) return 'qti1.2';
  }
  return 'unknown';
}

function collectImageSrcs(item) {
  const srcs = [];
  // Match src attributes whether they are double-quoted, single-quoted, or
  // unquoted -- some source platforms export <img src=Resources/x.png ...>
  // with no quotes, which the previous double-quote-only pattern missed.
  const re = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  for (const seg of item.segments) {
    const htmls = [];
    if (seg.type === 'html') htmls.push(seg.html);
    if (seg.type === 'choices') htmls.push(...seg.choices.map((c) => c.html));
    for (const h of htmls) {
      let m;
      while ((m = re.exec(h)) !== null) srcs.push(m[1] || m[2] || m[3]);
    }
  }
  return srcs;
}

/**
 * Processes a single QTI zip archive buffer end-to-end, writing its output
 * folder (ITEM_PREVIEW.html, PRINT_PREVIEW.html, RESOURCES/, Log.txt) under
 * `outputRoot`, named after `archiveBaseName` (the input file name, minus
 * extension), per the spec. Returns a summary object for the UI/progress
 * list.
 *
 * @param {Buffer} zipBuffer
 * @param {string} archiveBaseName
 * @param {string} outputRoot
 * @param {{sortMode: 'natural'|'string', styleCssPath: string, katexAssetsDir: string}} options
 */
function processArchive(zipBuffer, archiveBaseName, outputRoot, options) {
  const log = [];
  const now = new Date().toISOString();
  log.push(`QTI Conversion Log -- ${archiveBaseName}`);
  log.push(`Generated: ${now}`);
  log.push('');

  const outDir = path.join(outputRoot, archiveBaseName);
  const resourcesDir = path.join(outDir, 'RESOURCES');
  fs.mkdirSync(resourcesDir, { recursive: true });

  const entries = readEntries(zipBuffer);
  const version = detectQtiVersion(entries);
  log.push(`Detected QTI version: ${version}`);

  const parser = version === 'qti2.1' ? qti21 : version === 'qti1.2' ? qti12 : null;

  const itemEntries = entries.filter(
    (e) => !e.isDirectory && e.name.endsWith('.xml') && e.name.toLowerCase() !== 'imsmanifest.xml' && !e.name.includes('/')
  );
  log.push(`Item XML files found: ${itemEntries.length}`);
  log.push('');

  const items = [];
  let errorCount = 0;

  if (!parser) {
    log.push('[ERROR] Could not detect QTI version (expected v1.2 or v2.1). No items were converted.');
  } else {
    for (const entry of itemEntries) {
      try {
        const xmlText = entry.getData().toString('utf8');
        const item = parser.parseItem(xmlText, entry.name);
        items.push(item);
        if (item.itemType === 'unknown') {
          log.push(`[WARN] ${item.identifier || entry.name} -> item type "${item.itemSubtype}" is not supported by this MVP tool; rendered with a fallback notice.`);
        } else {
          log.push(`[OK] ${item.identifier} -> ${item.itemType} (${item.itemSubtype})`);
        }
      } catch (e) {
        errorCount++;
        log.push(`[ERROR] ${entry.name} -> failed to parse: ${e.message}`);
      }
    }
  }

  const sortMode = options.sortMode === 'string' ? 'string' : 'natural';
  const sortedItems = sortItems(items, sortMode);

  log.push('');
  log.push(`Sort mode used: ${sortMode}`);
  log.push(`Items converted successfully: ${items.length}`);
  log.push(`Items failed to parse: ${errorCount}`);

  // Copy referenced image assets (only those actually used by the items we
  // successfully parsed) into the output folder, preserving the exact path
  // each item references so the generated HTML resolves the image on any
  // platform (case-sensitive filesystems included). We look the archive entry
  // up first by its full path, then fall back to matching on base filename.
  const entryByFullName = new Map();
  const entryByBaseName = new Map();
  for (const e of entries) {
    if (!e.isDirectory) {
      entryByFullName.set(e.name.replace(/\\/g, '/').toLowerCase(), e);
      entryByBaseName.set(path.basename(e.name).toLowerCase(), e);
    }
  }
  const copied = new Set();
  for (const item of sortedItems) {
    for (const src of collectImageSrcs(item)) {
      // Normalize the reference: forward slashes, drop any query/fragment.
      const ref = String(src).replace(/\\/g, '/').split(/[?#]/)[0];
      // Skip external, protocol-relative, and inline data URIs -- nothing to copy.
      if (!ref || /^(?:[a-z]+:|\/\/)/i.test(ref)) continue;
      const destPath = path.join(outDir, ref);
      // Guard against archive entries that would escape the output folder.
      const rel = path.relative(outDir, destPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        log.push(`[WARN] Skipped image with unsafe path: ${src}`);
        continue;
      }
      const key = destPath.toLowerCase();
      if (copied.has(key)) continue;
      const entry =
        entryByFullName.get(ref.toLowerCase()) ||
        entryByBaseName.get(path.basename(ref).toLowerCase());
      if (entry) {
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, entry.getData());
        copied.add(key);
      } else {
        log.push(`[WARN] Missing image asset referenced by an item: ${src}`);
      }
    }
  }

  // Copy stylesheet (current effective style: user override if present,
  // else baseline) and KaTeX assets into this output folder.
  fs.copyFileSync(options.styleCssPath, path.join(outDir, 'styles.css'));
  copyDirRecursive(options.katexAssetsDir, path.join(resourcesDir, 'katex'));

  fs.writeFileSync(path.join(outDir, 'ITEM_PREVIEW.html'), buildItemPreviewHtml(sortedItems, archiveBaseName));
  fs.writeFileSync(path.join(outDir, 'PRINT_PREVIEW.html'), buildPrintPreviewHtml(sortedItems, archiveBaseName));
  fs.writeFileSync(path.join(outDir, 'Log.txt'), log.join('\n') + '\n');

  return {
    archiveBaseName,
    outDir,
    itemCount: items.length,
    errorCount,
    version,
  };
}

function copyDirRecursive(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = { processArchive, detectQtiVersion };
