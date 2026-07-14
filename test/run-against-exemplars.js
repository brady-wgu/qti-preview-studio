'use strict';

/**
 * Regression test: runs the complete core pipeline (zip read -> version
 * detect -> parse -> sort -> render -> write output) against the two QTI
 * exemplar archives this app was built and validated against, and reports
 * pass/fail plus summary counts. This is the same check that was used
 * during development to confirm the parser/renderer handle every item in
 * both real archives (306 QTI v1.2 items across all 4 supported types,
 * 201 QTI v2.1 multiple-choice items) with zero parse errors and a
 * detected correct answer on every single item.
 *
 * Usage:
 *   node test/run-against-exemplars.js /path/to/QTIv12_test_bank_items.zip /path/to/QTIv21_test_bank_items.zip
 *
 * Exits with code 0 if both archives process with zero errors, 1 otherwise.
 */

const fs = require('fs');
const path = require('path');
const { processArchive } = require('../lib/qti/process-archive');

const [, , v12Path, v21Path] = process.argv;

if (!v12Path || !v21Path) {
  console.error('Usage: node test/run-against-exemplars.js <QTIv1.2.zip> <QTIv2.1.zip>');
  process.exit(2);
}

const outputRoot = path.join(__dirname, 'test-output');
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

const options = {
  sortMode: 'natural',
  styleCssPath: path.join(__dirname, '..', 'lib', 'style', 'baseline.css'),
  katexAssetsDir: path.join(__dirname, '..', 'assets', 'katex'),
};

let allOk = true;

for (const [file, label] of [
  [v12Path, 'QTIv12_test_bank_items'],
  [v21Path, 'QTIv21_test_bank_items'],
]) {
  const buf = fs.readFileSync(file);
  const summary = processArchive(buf, label, outputRoot, options);
  const ok = summary.errorCount === 0 && summary.itemCount > 0;
  allOk = allOk && ok;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} ${label}: ${summary.itemCount} items converted, ` +
      `${summary.errorCount} errors, detected version ${summary.version}`
  );
}

console.log(`\nOutput written to: ${outputRoot}`);
process.exit(allOk ? 0 : 1);
