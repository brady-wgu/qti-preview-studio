'use strict';

/**
 * Renders a single normalized item (see parse-qti12.js / parse-qti21.js)
 * into the HTML markup used inside a .qti-item-card, shared between
 * ITEM_PREVIEW and PRINT_PREVIEW so an item looks identical in both. Ported
 * from the Python prototype's render.py, WITH the changes from both client
 * review rounds already incorporated:
 *   - choices render as a real <table> (closer to the source platform's
 *     #tblChoice markup) with correct rows marked THREE ways (bold+underline
 *     text, green row highlight, checkmark badge) so marking survives
 *     regardless of choice content type (text vs. image)
 *   - FIB blanks show only the blank placeholder inline; accepted answers
 *     move to a below-item "Answer Key" block
 *   - Dropdown fields render a genuinely interactive (non-disabled) inline
 *     <select> AND list all options in the Answer Key using the same
 *     choice-table treatment, so Print Preview (where a native <select>
 *     can only show its current value on paper) still shows every option
 */

function renderMetaHeader(item) {
  const shuffleLabel = item.shuffle ? 'Yes' : 'No';
  const shuffleClass = item.shuffle ? 'qti-shuffle-on' : 'qti-shuffle-off';
  const label = item.label ? escapeHtml(item.label) : '<em>(not specified)</em>';
  const code = item.code ? escapeHtml(item.code) : '<em>(not specified)</em>';
  return `
    <div class="qti-item-meta">
      <span><span class="qti-meta-label">Item ID:</span> ${escapeHtml(item.identifier)}</span>
      <span><span class="qti-meta-label">Label:</span> ${label}</span>
      <span><span class="qti-meta-label">Code:</span> ${code}</span>
      <span><span class="qti-meta-label">Shuffle:</span> <span class="${shuffleClass}">${shuffleLabel}</span></span>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderChoicesBlock(seg, inputType) {
  const rows = seg.choices
    .map((choice) => {
      const rowCls = choice.correct ? 'qti-choice-correct-row' : '';
      const textCls = choice.correct ? 'qti-choice-correct-text' : '';
      const badge = choice.correct ? '<span class="qti-correct-badge">&#10003; Correct</span>' : '';
      return (
        `<tr class="${rowCls}">` +
        `<td class="qti-choice-input-cell"><input type="${inputType}" disabled></td>` +
        `<td class="qti-choice-text-cell"><span class="${textCls}">${choice.html}</span>${badge}</td>` +
        `</tr>`
      );
    })
    .join('');
  return `<table class="qti-choice-table">${rows}</table>`;
}

function renderChoicesInline(seg) {
  const options = seg.choices.map((c) => `<option>${c.html}</option>`).join('');
  return `<select class="qti-inline-select">${options}</select>`;
}

function renderBlank() {
  return '<span class="qti-fib-blank">&nbsp;</span>';
}

function renderAnswerKey(item) {
  const totalBlanks = item.segments.filter((s) => s.type === 'blank').length;
  const totalDropdowns = item.segments.filter((s) => s.type === 'choices' && s.layout === 'inline').length;

  const blankEntries = [];
  const dropdownBlocks = [];
  let blankN = 0;
  let dropdownN = 0;

  for (const seg of item.segments) {
    if (seg.type === 'blank') {
      blankN += 1;
      const answers = seg.correct || [];
      const answerText = answers.length ? answers.map(escapeHtml).join(', ') : '(not specified)';
      const label = totalBlanks === 1 ? 'Blank' : `Blank ${blankN}`;
      blankEntries.push(`${label} \u2014 accepted answer(s): ${answerText}`);
    } else if (seg.type === 'choices' && seg.layout === 'inline') {
      dropdownN += 1;
      const label = totalDropdowns === 1 ? 'Dropdown options' : `Dropdown ${dropdownN} options`;
      const table = renderChoicesBlock(seg, 'radio');
      dropdownBlocks.push(
        `<div class="qti-dropdown-answer-block"><span class="qti-dropdown-answer-label">${label}</span>${table}</div>`
      );
    }
  }

  if (!blankEntries.length && !dropdownBlocks.length) return '';

  const parts = ['<div class="qti-answer-key"><span class="qti-answer-key-title">Answer Key</span>'];
  if (blankEntries.length) {
    parts.push(`<ul>${blankEntries.map((e) => `<li>${e}</li>`).join('')}</ul>`);
  }
  parts.push(...dropdownBlocks);
  parts.push('</div>');
  return parts.join('');
}

function renderItemBody(item) {
  if (item.itemType === 'unknown') {
    const note =
      `<div class="qti-unsupported-type">This item type ` +
      `("${escapeHtml(item.itemSubtype || 'Unknown')}") is not yet supported ` +
      `by this MVP tool. Raw item metadata is shown above; see Log.txt for details.</div>`;
    return renderMetaHeader(item) + note;
  }

  const parts = [renderMetaHeader(item)];
  let stemOpen = false;
  const openStem = () => {
    if (!stemOpen) {
      parts.push('<div class="qti-item-stem">');
      stemOpen = true;
    }
  };

  for (const seg of item.segments) {
    if (seg.type === 'html') {
      openStem();
      parts.push(seg.html);
    } else if (seg.type === 'blank') {
      openStem();
      parts.push(renderBlank());
    } else if (seg.type === 'choices' && seg.layout === 'inline') {
      openStem();
      parts.push(renderChoicesInline(seg));
    }
  }
  if (stemOpen) parts.push('</div>');

  // Block-layout choice lists (MC / Multiple Response) render *below* the
  // stem, matching the source platform's radio-table-under-the-question
  // layout.
  for (const seg of item.segments) {
    if (seg.type === 'choices' && seg.layout === 'block') {
      const inputType = item.itemType === 'multiple_response' ? 'checkbox' : 'radio';
      parts.push(renderChoicesBlock(seg, inputType));
    }
  }

  parts.push(renderAnswerKey(item));

  return parts.join('');
}

module.exports = { renderItemBody };
