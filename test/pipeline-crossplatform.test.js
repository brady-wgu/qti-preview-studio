'use strict';

/**
 * Self-contained, cross-platform regression test for the core conversion
 * pipeline (zip read -> version detect -> parse -> sort -> render -> write).
 *
 * It builds tiny SYNTHETIC QTI archives in memory (no external fixture files,
 * and deliberately no real item-bank content) covering:
 *   - QTI v1.2 multiple-choice with a detected correct answer
 *   - an UNQUOTED <img src=Resources/...> reference (the form real exports use)
 *   - inline LaTeX math
 *   - QTI v2.1 choiceInteraction with a detected correct answer
 *
 * It runs the real processArchive() and asserts the output. Crucially it
 * checks that each referenced image is written to the EXACT path (including
 * letter case) the generated HTML points at -- this is what guarantees images
 * resolve on case-sensitive filesystems (macOS/Linux), the main cross-platform
 * risk for this app. Runs identically on Windows and macOS in CI.
 *
 * Exit code 0 = all assertions pass, 1 = failure. No browser / no Electron.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const { processArchive } = require('../lib/qti/process-archive');

// 1x1 transparent PNG.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);

const V12_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<questestinterop>
  <item ident="SYN-12-001" label="Synthetic MC" code="SYN.1.2">
    <itemmetadata><qmd_itemtype>Multiple Choice Static</qmd_itemtype></itemmetadata>
    <presentation>
      <material>
        <mattext texttype="text/html">&lt;p&gt;Evaluate \\(x^2\\) for the diagram below.&lt;br /&gt;&lt;img src=Resources/diagram.png height=100 width=100 alt=diagram&gt;&lt;/p&gt;</mattext>
      </material>
      <response_lid ident="RESP1">
        <render_choice shuffle="No">
          <response_label ident="A"><material><mattext texttype="text/html">&lt;p&gt;Right answer&lt;/p&gt;</mattext></material></response_label>
          <response_label ident="B"><material><mattext texttype="text/html">&lt;p&gt;Wrong one&lt;/p&gt;</mattext></material></response_label>
          <response_label ident="C"><material><mattext texttype="text/html">&lt;p&gt;Wrong two&lt;/p&gt;</mattext></material></response_label>
        </render_choice>
      </response_lid>
    </presentation>
    <resprocessing>
      <respcondition>
        <conditionvar><varequal respident="RESP1">A</varequal></conditionvar>
        <setvar varname="SCORE" action="Set">1</setvar>
      </respcondition>
    </resprocessing>
  </item>
</questestinterop>`;

const V21_ITEM = `<?xml version="1.0" encoding="UTF-8"?>
<assessmentItem identifier="SYN-21-001" title="Synthetic v21 MC">
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="identifier">
    <correctResponse><value>ChoiceA</value></correctResponse>
  </responseDeclaration>
  <itemBody>
    <p>Pick the correct option.</p>
    <choiceInteraction responseIdentifier="RESPONSE" maxChoices="1" shuffle="false">
      <prompt>Which is right?</prompt>
      <simpleChoice identifier="ChoiceA">Correct choice</simpleChoice>
      <simpleChoice identifier="ChoiceB">Incorrect choice</simpleChoice>
    </choiceInteraction>
  </itemBody>
</assessmentItem>`;

function buildV12Zip() {
  const zip = new AdmZip();
  zip.addFile('imsmanifest.xml', Buffer.from('<manifest><resource type="imsqti_xmlv1p2"/></manifest>'));
  zip.addFile('SYN-12-001.xml', Buffer.from(V12_ITEM));
  zip.addFile('Resources/diagram.png', PNG_1x1);
  return zip.toBuffer();
}

function buildV21Zip() {
  const zip = new AdmZip();
  zip.addFile('imsmanifest.xml', Buffer.from('<manifest><resource type="imsqti_item_xmlv2p1"/></manifest>'));
  zip.addFile('SYN-21-001.xml', Buffer.from(V21_ITEM));
  return zip.toBuffer();
}

const failures = [];
function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) failures.push(label);
}

const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'qti-xplat-'));
const options = {
  sortMode: 'natural',
  styleCssPath: path.join(__dirname, '..', 'lib', 'style', 'baseline.css'),
  katexAssetsDir: path.join(__dirname, '..', 'assets', 'katex'),
};

console.log(`platform=${process.platform}  node=${process.version}`);
console.log(`output root: ${outRoot}\n`);

// ---- QTI v1.2 ----
const s12 = processArchive(buildV12Zip(), 'syn-v12', outRoot, options);
const dir12 = s12.outDir;
const item12 = fs.readFileSync(path.join(dir12, 'ITEM_PREVIEW.html'), 'utf8');
const print12 = fs.readFileSync(path.join(dir12, 'PRINT_PREVIEW.html'), 'utf8');
const log12 = fs.readFileSync(path.join(dir12, 'Log.txt'), 'utf8');

check('v1.2 detected as qti1.2', s12.version === 'qti1.2');
check('v1.2 one item converted', s12.itemCount === 1);
check('v1.2 zero errors', s12.errorCount === 0);
check('v1.2 log clean (no ERROR)', !/\[ERROR\]/.test(log12));
check('v1.2 correct answer badge present', item12.includes('qti-correct-badge'));
check('v1.2 the RIGHT choice is the one marked correct',
  /qti-choice-correct-row[\s\S]*?Right answer/.test(item12));
check('v1.2 ITEM_PREVIEW references katex', item12.includes('RESOURCES/katex/katex.min.css'));
check('v1.2 PRINT_PREVIEW references katex', print12.includes('RESOURCES/katex/katex.min.css'));
check('v1.2 item references the image', /<img[^>]*src=Resources\/diagram\.png/.test(item12));
// The Mac/Linux-critical assertion: the image is written to the EXACT path
// (case included) the HTML points at, so it resolves on case-sensitive FS.
check('v1.2 image written at exact-case path Resources/diagram.png',
  fs.existsSync(path.join(dir12, 'Resources', 'diagram.png')));
check('v1.2 styles.css written', fs.existsSync(path.join(dir12, 'styles.css')));
check('v1.2 katex asset actually copied',
  fs.existsSync(path.join(dir12, 'RESOURCES', 'katex', 'katex.min.css')));

// ---- QTI v2.1 ----
const s21 = processArchive(buildV21Zip(), 'syn-v21', outRoot, options);
const dir21 = s21.outDir;
const item21 = fs.readFileSync(path.join(dir21, 'ITEM_PREVIEW.html'), 'utf8');
const log21 = fs.readFileSync(path.join(dir21, 'Log.txt'), 'utf8');

check('v2.1 detected as qti2.1', s21.version === 'qti2.1');
check('v2.1 one item converted', s21.itemCount === 1);
check('v2.1 zero errors', s21.errorCount === 0);
check('v2.1 log clean (no ERROR)', !/\[ERROR\]/.test(log21));
check('v2.1 correct answer badge present', item21.includes('qti-correct-badge'));
check('v2.1 the correct choice is the one marked',
  /qti-choice-correct-row[\s\S]*?Correct choice/.test(item21));

// cleanup best-effort
try { fs.rmSync(outRoot, { recursive: true, force: true }); } catch (e) { /* ignore */ }

console.log(`\n${failures.length === 0 ? 'ALL CHECKS PASSED' : failures.length + ' CHECK(S) FAILED: ' + failures.join('; ')}`);
process.exit(failures.length === 0 ? 0 : 1);
