'use strict';

const { renderItemBody } = require('./render');

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const KATEX_DELIMITERS_JS = `[
  { left: "\\\\[", right: "\\\\]", display: true },
  { left: "\\\\(", right: "\\\\)", display: true }
]`;

function buildItemPreviewHtml(items, title) {
  const slides = items
    .map((item, i) => {
      const active = i === 0 ? ' qti-slide-active' : '';
      const bodyHtml = renderItemBody(item);
      const rawAttr = escapeAttr(bodyHtml);
      return (
        `<section class="qti-slide${active}" data-index="${i}">` +
        `<div class="qti-item-card qti-katex-target" data-raw="${rawAttr}">${bodyHtml}</div>` +
        `</section>`
      );
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeAttr(title)} -- Item Preview</title>
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="RESOURCES/katex/katex.min.css">
<script src="RESOURCES/katex/katex.min.js"></script>
<script src="RESOURCES/katex/auto-render.min.js"></script>
</head>
<body>
<div class="qti-app-header qti-item-preview-header">
  <span class="qti-header-brand">${escapeAttr(title)} &mdash; Item Preview</span>
  <span class="qti-header-status" id="qtiHeaderStatus">Item 1 of ${items.length}</span>
</div>
<button class="qti-latex-toggle" id="qtiLatexToggle" onclick="qtiToggleLatex()">Show: Rendered math (click for raw LaTeX)</button>
<div class="qti-slide-viewport">
${slides}
</div>
<div class="qti-nav-bar">
  <button class="qti-nav-btn" id="qtiPrev" onclick="qtiNav(-1)">&larr; Previous</button>
  <span class="qti-nav-counter"><span id="qtiCounter">1</span> of ${items.length}</span>
  <button class="qti-nav-btn" id="qtiNext" onclick="qtiNav(1)">Next &rarr;</button>
</div>
<script>
var qtiCurrent = 0;
var qtiSlides = document.querySelectorAll('.qti-slide');
var qtiDelimiters = ${KATEX_DELIMITERS_JS};
var qtiRendered = true;

function qtiRenderMathAll() {
  document.querySelectorAll('.qti-katex-target').forEach(function (el) {
    renderMathInElement(el, { delimiters: qtiDelimiters });
  });
}
function qtiToggleLatex() {
  qtiRendered = !qtiRendered;
  var btn = document.getElementById('qtiLatexToggle');
  document.querySelectorAll('.qti-katex-target').forEach(function (el) {
    el.innerHTML = el.getAttribute('data-raw');
  });
  if (qtiRendered) {
    qtiRenderMathAll();
    btn.textContent = 'Show: Rendered math (click for raw LaTeX)';
  } else {
    btn.textContent = 'Show: Raw LaTeX markup (click for rendered math)';
  }
}
function qtiRender() {
  qtiSlides.forEach(function (s, i) {
    s.classList.toggle('qti-slide-active', i === qtiCurrent);
  });
  document.getElementById('qtiCounter').textContent = qtiCurrent + 1;
  document.getElementById('qtiHeaderStatus').textContent = 'Item ' + (qtiCurrent + 1) + ' of ' + qtiSlides.length;
  document.getElementById('qtiPrev').disabled = qtiCurrent === 0;
  document.getElementById('qtiNext').disabled = qtiCurrent === qtiSlides.length - 1;
}
function qtiNav(delta) {
  var next = qtiCurrent + delta;
  if (next >= 0 && next < qtiSlides.length) {
    qtiCurrent = next;
    qtiRender();
  }
}
document.addEventListener('DOMContentLoaded', function () {
  qtiRenderMathAll();
  qtiRender();
});
</script>
</body>
</html>
`;
}

function buildPrintPreviewHtml(items, title) {
  const blocks = [];
  items.forEach((item, i) => {
    const bodyHtml = renderItemBody(item);
    const rawAttr = escapeAttr(bodyHtml);
    blocks.push(`<div class="qti-item-card qti-katex-target" data-raw="${rawAttr}">${bodyHtml}</div>`);
    if (i < items.length - 1) blocks.push('<hr class="qti-print-rule">');
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeAttr(title)} -- Print Preview</title>
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="RESOURCES/katex/katex.min.css">
<script src="RESOURCES/katex/katex.min.js"></script>
<script src="RESOURCES/katex/auto-render.min.js"></script>
</head>
<body>
<div class="qti-app-header qti-print-toolbar">${escapeAttr(title)} &mdash; Print Preview (scan / print answer key)</div>
<button class="qti-latex-toggle" id="qtiLatexToggle" onclick="qtiToggleLatex()">Show: Rendered math (click for raw LaTeX)</button>
${blocks.join('\n')}
<script>
var qtiRendered = true;
var qtiDelimiters = ${KATEX_DELIMITERS_JS};

function qtiRenderMathAll() {
  document.querySelectorAll('.qti-katex-target').forEach(function (el) {
    renderMathInElement(el, { delimiters: qtiDelimiters });
  });
}
function qtiToggleLatex() {
  qtiRendered = !qtiRendered;
  var btn = document.getElementById('qtiLatexToggle');
  document.querySelectorAll('.qti-katex-target').forEach(function (el) {
    el.innerHTML = el.getAttribute('data-raw');
  });
  if (qtiRendered) {
    qtiRenderMathAll();
    btn.textContent = 'Show: Rendered math (click for raw LaTeX)';
  } else {
    btn.textContent = 'Show: Raw LaTeX markup (click for rendered math)';
  }
}
document.addEventListener('DOMContentLoaded', qtiRenderMathAll);
</script>
</body>
</html>
`;
}

module.exports = { buildItemPreviewHtml, buildPrintPreviewHtml };
