'use strict';

/**
 * Comprehensive, self-contained feature-matrix test for the core pipeline.
 * Complements test/pipeline-crossplatform.test.js (which is the lean CI
 * regression suite) with deep, synthetic-fixture coverage of every parser
 * feature, item type, and edge case the app claims to support -- run on
 * demand for a full confidence pass (e.g. before/after a release).
 *
 * All fixtures are synthetic and non-sensitive (no real item-bank content).
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const { processArchive } = require('../lib/qti/process-archive');
const { sortItems } = require('../lib/qti/sort');
const { parseXML, childElements } = require('../lib/qti/xml-parser');

const failures = [];
let checkCount = 0;
function check(label, cond) {
  checkCount++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures.push(label);
}

const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qti-matrix-'));
const options = {
  sortMode: 'natural',
  styleCssPath: path.join(__dirname, '..', 'lib', 'style', 'baseline.css'),
  katexAssetsDir: path.join(__dirname, '..', 'assets', 'katex'),
};

function zipOf(files) {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}

console.log(`platform=${process.platform}  node=${process.version}\n`);

// ---------------------------------------------------------------------
// 1. v1.2 Multiple Response (multiple correct choices)
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="MR-1" label="MR item" code="MR.1">
    <itemmetadata><qmd_itemtype>Multiple Response Static</qmd_itemtype></itemmetadata>
    <presentation>
      <material><mattext texttype="text/html">&lt;p&gt;Pick both correct ones.&lt;/p&gt;</mattext></material>
      <response_lid ident="R1">
        <render_choice shuffle="No">
          <response_label ident="A"><material><mattext texttype="text/html">&lt;p&gt;Right 1&lt;/p&gt;</mattext></material></response_label>
          <response_label ident="B"><material><mattext texttype="text/html">&lt;p&gt;Wrong&lt;/p&gt;</mattext></material></response_label>
          <response_label ident="C"><material><mattext texttype="text/html">&lt;p&gt;Right 2&lt;/p&gt;</mattext></material></response_label>
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <respcondition><conditionvar><varequal respident="R1">A</varequal></conditionvar><setvar varname="SCORE" action="Add">1</setvar></respcondition>
      <respcondition><conditionvar><varequal respident="R1">C</varequal></conditionvar><setvar varname="SCORE" action="Add">1</setvar></respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>', 'MR-1.xml': item });
  const s = processArchive(zip, 'mr-v12', outRoot, options);
  const html = fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8');
  check('v1.2 Multiple Response: item converted, 0 errors', s.itemCount === 1 && s.errorCount === 0);
  check('v1.2 Multiple Response: itemType detected', new RegExp('multiple_response').test(fs.readFileSync(path.join(s.outDir, 'Log.txt'), 'utf8')));
  // Each item's HTML is duplicated into a `data-raw` attribute (that's what
  // powers the rendered/raw-LaTeX toggle), so every class name legitimately
  // appears twice per real occurrence: 2 correct choices x 2 copies = 4.
  const correctCount = (html.match(/qti-choice-correct-row/g) || []).length;
  check('v1.2 Multiple Response: BOTH correct choices marked', correctCount === 4);
  check('v1.2 Multiple Response: uses checkbox input', html.includes('type="checkbox"'));
}

// ---------------------------------------------------------------------
// 2. v1.2 Fill-in-the-blank (Answer Key box, multiple accepted answers)
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="FIB-1" label="FIB item" code="FIB.1">
    <itemmetadata><qmd_itemtype>Fill In Blanks Static</qmd_itemtype></itemmetadata>
    <presentation>
      <material><mattext texttype="text/html">&lt;p&gt;The capital of France is ____.&lt;/p&gt;</mattext></material>
      <response_str ident="R1"><render_fib maxchars="30"/></response_str>
    </presentation>
    <resprocessing>
      <respcondition><conditionvar><varequal respident="R1">Paris</varequal></conditionvar><setvar varname="SCORE" action="Add">1</setvar></respcondition>
      <respcondition><conditionvar><varequal respident="R1">paris</varequal></conditionvar><setvar varname="SCORE" action="Add">1</setvar></respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>', 'FIB-1.xml': item });
  const s = processArchive(zip, 'fib-v12', outRoot, options);
  const html = fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8');
  check('v1.2 Fill-in-blank: item converted, 0 errors', s.itemCount === 1 && s.errorCount === 0);
  check('v1.2 Fill-in-blank: Answer Key box present', html.includes('qti-answer-key'));
  check('v1.2 Fill-in-blank: both accepted answers listed', html.includes('Paris') && html.includes('paris'));
  check('v1.2 Fill-in-blank: blank placeholder rendered inline', html.includes('qti-fib-blank'));
}

// ---------------------------------------------------------------------
// 3. v1.2 Dropdown (Pull Down List) -- inline select + Answer Key listing
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="DD-1" label="Dropdown item" code="DD.1">
    <itemmetadata><qmd_itemtype>Pull Down List</qmd_itemtype></itemmetadata>
    <presentation>
      <response_lid ident="R1">
        <material><mattext texttype="text/html">&lt;p&gt;Water boils at&lt;/p&gt;</mattext></material>
        <render_choice shuffle="No">
          <response_label ident="A"><material><mattext texttype="text/html">90C</mattext></material></response_label>
          <response_label ident="B"><material><mattext texttype="text/html">100C</mattext></material></response_label>
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <respcondition><conditionvar><varequal respident="R1">B</varequal></conditionvar><setvar varname="SCORE" action="Set">1</setvar></respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>', 'DD-1.xml': item });
  const s = processArchive(zip, 'dropdown-v12', outRoot, options);
  const html = fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8');
  check('v1.2 Dropdown: item converted, 0 errors', s.itemCount === 1 && s.errorCount === 0);
  check('v1.2 Dropdown: renders an inline <select>', html.includes('qti-inline-select'));
  check('v1.2 Dropdown: material before dropdown renders inline (same stem)', /Water boils at[\s\S]{0,200}<select/.test(html));
  check('v1.2 Dropdown: Answer Key lists every option (not just correct)', html.includes('90C') && html.includes('100C'));
  check('v1.2 Dropdown: correct option marked in Answer Key', /qti-dropdown-answer-block[\s\S]*?qti-choice-correct-row/.test(html));
}

// ---------------------------------------------------------------------
// 4. v2.1 Multiple Response (maxChoices > 1)
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<assessmentItem identifier="MR21-1" title="v2.1 MR">
  <responseDeclaration identifier="RESPONSE" cardinality="multiple" baseType="identifier">
    <correctResponse><value>ChoiceA</value><value>ChoiceC</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="2" shuffle="false">
      <prompt>Pick two.</prompt>
      <simpleChoice identifier="ChoiceA">Right 1</simpleChoice>
      <simpleChoice identifier="ChoiceB">Wrong</simpleChoice>
      <simpleChoice identifier="ChoiceC">Right 2</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_item_xmlv2p1"/></manifest>', 'MR21-1.xml': item });
  const s = processArchive(zip, 'mr-v21', outRoot, options);
  const html = fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8');
  check('v2.1 Multiple Response: item converted, 0 errors', s.itemCount === 1 && s.errorCount === 0);
  // Same data-raw duplication as the v1.2 case above: 2 correct x 2 copies = 4.
  const correctCount21 = (html.match(/qti-choice-correct-row/g) || []).length;
  check('v2.1 Multiple Response: BOTH correct choices marked', correctCount21 === 4);
  check('v2.1 Multiple Response: uses checkbox input', html.includes('type="checkbox"'));
}

// ---------------------------------------------------------------------
// 5. Unsupported item type -> graceful fallback, not a crash
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="HOTSPOT-1" label="Unsupported item" code="HS.1">
    <itemmetadata><qmd_itemtype>Hot Spot</qmd_itemtype></itemmetadata>
    <presentation>
      <material><mattext texttype="text/html">&lt;p&gt;Click the spot.&lt;/p&gt;</mattext></material>
    </presentation>
  </item>
</questestinterop>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>', 'HOTSPOT-1.xml': item });
  const s = processArchive(zip, 'unsupported-type', outRoot, options);
  const html = fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8');
  const log = fs.readFileSync(path.join(s.outDir, 'Log.txt'), 'utf8');
  check('Unsupported item type: still counted as converted (not an error)', s.itemCount === 1 && s.errorCount === 0);
  check('Unsupported item type: fallback notice rendered', html.includes('qti-unsupported-type') && html.includes('not yet supported'));
  check('Unsupported item type: item ID/metadata still shown', html.includes('HOTSPOT-1'));
  check('Unsupported item type: logged as WARN, not ERROR', /\[WARN\].*Hot Spot/.test(log) && !/\[ERROR\]/.test(log));
}

// ---------------------------------------------------------------------
// 6. Malformed item XML mid-batch -> isolated failure, batch continues
// ---------------------------------------------------------------------
{
  const goodItem = `<?xml version="1.0"?>
<questestinterop>
  <item ident="GOOD-1" label="Good item" code="G.1">
    <itemmetadata><qmd_itemtype>Multiple Choice Static</qmd_itemtype></itemmetadata>
    <presentation>
      <material><mattext texttype="text/html">&lt;p&gt;2+2=?&lt;/p&gt;</mattext></material>
      <response_lid ident="R1"><render_choice shuffle="No">
        <response_label ident="A"><material><mattext texttype="text/html">4</mattext></material></response_label>
        <response_label ident="B"><material><mattext texttype="text/html">5</mattext></material></response_label>
      </render_choice></response_lid>
    </presentation>
    <resprocessing><respcondition><conditionvar><varequal respident="R1">A</varequal></conditionvar><setvar varname="SCORE" action="Set">1</setvar></respcondition></resprocessing>
  </item>
</questestinterop>`;
  // No <item> element at all -- parseItem throws "No <item> element found".
  const brokenItem = `<?xml version="1.0"?><questestinterop><notanitem/></questestinterop>`;
  const zip = zipOf({
    'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>',
    'GOOD-1.xml': goodItem,
    'BROKEN-1.xml': brokenItem,
  });
  const s = processArchive(zip, 'malformed-mid-batch', outRoot, options);
  const log = fs.readFileSync(path.join(s.outDir, 'Log.txt'), 'utf8');
  check('Malformed item: batch does not crash', s !== undefined);
  check('Malformed item: good item still converted', s.itemCount === 1);
  check('Malformed item: broken item counted as error, not silently dropped', s.errorCount === 1);
  check('Malformed item: error logged with reason', /\[ERROR\] BROKEN-1\.xml/.test(log));
  check('Malformed item: good item still appears in output HTML', fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8').includes('GOOD-1'));
}

// ---------------------------------------------------------------------
// 7. Nested AND/OR respcondition -- correct-answer walk must recurse
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="NEST-1" label="Nested cond" code="N.1">
    <itemmetadata><qmd_itemtype>Multiple Choice Static</qmd_itemtype></itemmetadata>
    <presentation>
      <material><mattext texttype="text/html">&lt;p&gt;Nested logic test&lt;/p&gt;</mattext></material>
      <response_lid ident="R1"><render_choice shuffle="No">
        <response_label ident="A"><material><mattext texttype="text/html">Right (nested)</mattext></material></response_label>
        <response_label ident="B"><material><mattext texttype="text/html">Wrong</mattext></material></response_label>
      </render_choice></response_lid>
    </presentation>
    <resprocessing>
      <respcondition>
        <conditionvar><and><or><varequal respident="R1">A</varequal></or></and></conditionvar>
        <setvar varname="SCORE" action="Set">1</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>', 'NEST-1.xml': item });
  const s = processArchive(zip, 'nested-and-or', outRoot, options);
  const html = fs.readFileSync(path.join(s.outDir, 'ITEM_PREVIEW.html'), 'utf8');
  check('Nested AND/OR: item converted, 0 errors', s.itemCount === 1 && s.errorCount === 0);
  check('Nested AND/OR: correct choice found despite nesting', /qti-choice-correct-row[\s\S]*?Right \(nested\)/.test(html));
}

// ---------------------------------------------------------------------
// 8. Natural vs String sort -- must produce genuinely different orders
// ---------------------------------------------------------------------
{
  const ids = ['item1', 'item2', 'item10'];
  const fakeItems = ids.map((id) => ({ identifier: id }));
  const natural = sortItems(fakeItems, 'natural').map((i) => i.identifier);
  const stringSort = sortItems(fakeItems, 'string').map((i) => i.identifier);
  check('Sort: Natural order is item1, item2, item10', JSON.stringify(natural) === JSON.stringify(['item1', 'item2', 'item10']));
  check('Sort: String order is item1, item10, item2 (differs from Natural)', JSON.stringify(stringSort) === JSON.stringify(['item1', 'item10', 'item2']));
  check('Sort: the two modes genuinely disagree (proves the toggle matters)', JSON.stringify(natural) !== JSON.stringify(stringSort));
}

// ---------------------------------------------------------------------
// 9. Directory-traversal guard on image src
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="TRAVERSAL-1" label="Traversal attempt" code="T.1">
    <itemmetadata><qmd_itemtype>Multiple Choice Static</qmd_itemtype></itemmetadata>
    <presentation>
      <material><mattext texttype="text/html">&lt;p&gt;&lt;img src=../../../evil.png&gt;&lt;/p&gt;</mattext></material>
      <response_lid ident="R1"><render_choice shuffle="No">
        <response_label ident="A"><material><mattext texttype="text/html">A</mattext></material></response_label>
      </render_choice></response_lid>
    </presentation>
  </item>
</questestinterop>`;
  const zip = zipOf({
    'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>',
    'TRAVERSAL-1.xml': item,
    'Resources/evil.png': Buffer.from('fake-png-bytes'),
  });
  const s = processArchive(zip, 'traversal-guard', outRoot, options);
  const log = fs.readFileSync(path.join(s.outDir, 'Log.txt'), 'utf8');
  const escapedPath = path.resolve(s.outDir, '..', '..', '..', 'evil.png');
  check('Directory traversal: processed without crashing', s.itemCount === 1);
  check('Directory traversal: unsafe image path rejected and logged', /\[WARN\] Skipped image with unsafe path/.test(log));
  check('Directory traversal: file NOT written outside the output folder', !fs.existsSync(escapedPath));
}

// ---------------------------------------------------------------------
// 10. Non-QTI / undetectable version zip -> graceful, no crash
// ---------------------------------------------------------------------
{
  const zip = zipOf({ 'readme.txt': 'this is not a QTI archive at all' });
  const s = processArchive(zip, 'non-qti-zip', outRoot, options);
  const log = fs.readFileSync(path.join(s.outDir, 'Log.txt'), 'utf8');
  check('Non-QTI zip: does not crash', s !== undefined);
  check('Non-QTI zip: version reported unknown', s.version === 'unknown');
  check('Non-QTI zip: zero items converted', s.itemCount === 0);
  check('Non-QTI zip: clear error logged', /\[ERROR\] Could not detect QTI version/.test(log));
  check('Non-QTI zip: HTML output still produced (no partial-write crash)', fs.existsSync(path.join(s.outDir, 'ITEM_PREVIEW.html')));
}

// ---------------------------------------------------------------------
// 11. Missing <presentation> element -- xml-parser null-safety regression
// ---------------------------------------------------------------------
{
  const item = `<?xml version="1.0"?>
<questestinterop>
  <item ident="NOPRES-1" label="No presentation" code="NP.1">
    <itemmetadata><qmd_itemtype>Multiple Choice Static</qmd_itemtype></itemmetadata>
  </item>
</questestinterop>`;
  const zip = zipOf({ 'imsmanifest.xml': '<manifest><resource type="imsqti_xmlv1p2"/></manifest>', 'NOPRES-1.xml': item });
  const s = processArchive(zip, 'missing-presentation', outRoot, options);
  check('Missing <presentation>: does not throw (childElements null-safe)', s.itemCount === 1 && s.errorCount === 0);
}

// ---------------------------------------------------------------------
// 12. File-level negative paths (not a valid zip at all, and an empty
// but structurally valid zip) -- must fail/degrade gracefully, not crash
// or hang, and must not affect other files in the same batch.
// ---------------------------------------------------------------------
{
  let threw = false;
  let msg = '';
  try {
    processArchive(Buffer.from('this is not a zip file at all'), 'garbage-not-a-zip', outRoot, options);
  } catch (e) {
    threw = true;
    msg = e.message;
  }
  check('Garbage (non-zip) bytes: throws a clear, specific error', threw && /Not a valid ZIP file/.test(msg));

  // Minimal valid ZIP structure with zero entries (End Of Central Directory only).
  const emptyZip = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const emptyResult = processArchive(emptyZip, 'empty-zip', outRoot, options);
  check('Empty (0-entry) valid zip: does not throw', emptyResult !== undefined);
  check('Empty valid zip: zero items, no crash', emptyResult.itemCount === 0 && emptyResult.version === 'unknown');

  // Simulates main.js's real per-file try/catch loop: one bad file in a
  // multi-file batch must not stop the others from processing.
  const batchResults = [];
  for (const f of [
    { name: 'bad', buf: Buffer.from('garbage') },
    { name: 'empty', buf: emptyZip },
  ]) {
    try {
      batchResults.push({ ...processArchive(f.buf, f.name, outRoot, options), ok: true });
    } catch (e) {
      batchResults.push({ archiveBaseName: f.name, ok: false, error: e.message });
    }
  }
  check('Batch resilience: a failing file is marked failed, not thrown to the caller', batchResults[0].ok === false);
  check('Batch resilience: the NEXT file in the same batch still processes', batchResults[1].ok === true);
}

// ---------------------------------------------------------------------
// 13. xml-parser unit checks (direct, no zip involved)
// ---------------------------------------------------------------------
{
  check('xml-parser: childElements(null, "x") returns [] instead of throwing', JSON.stringify(childElements(null, 'x')) === '[]');
  const tree = parseXML('<a><b>1</b><b>2</b></a>');
  check('xml-parser: basic parse + childElements works', childElements(tree, 'b').length === 2);
  const strayLt = parseXML('<a><b>f(1) &lt; g(1) but also f(1) < g(1)</b></a>');
  check('xml-parser: tolerates a stray literal "<" in text', childElements(strayLt, 'b').length === 1);
}

// cleanup
try { fs.rmSync(outRoot, { recursive: true, force: true }); } catch (e) { /* ignore */ }

console.log(`\n${failures.length === 0 ? `ALL ${checkCount} CHECKS PASSED` : failures.length + ' of ' + checkCount + ' CHECK(S) FAILED:\n  - ' + failures.join('\n  - ')}`);
process.exit(failures.length === 0 ? 0 : 1);
