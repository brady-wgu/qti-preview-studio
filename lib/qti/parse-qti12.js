'use strict';

const { parseXML, findFirst, childElements, localName, directText, decodeEntities } = require('./xml-parser');

/**
 * Parses a single IMS QTI v1.2 <questestinterop> item XML string into the
 * normalized item model shared with the v2.1 parser (see parse-qti21.js for
 * the identical output shape). Ported from the Python prototype's
 * parse_qti12.py -- see that file's history for the original design notes;
 * key decisions are re-documented here since this is the version that ships.
 */

const TYPE_MAP = {
  'Multiple Choice Static': 'multiple_choice',
  'Multiple Response Static': 'multiple_response',
  'Fill In Blanks Static': 'fill_in_blank',
  'Pull Down List': 'dropdown',
};

function decodeMattext(mattextEl) {
  // <mattext texttype="text/html"> contains HTML-escaped markup as literal
  // text (e.g. "&lt;p&gt;...&lt;/p&gt;"). directText() already ran entity
  // decoding once during XML parsing, so by this point it's already real
  // HTML -- no further unescaping needed (that would double-decode).
  return directText(mattextEl);
}

function parseItem(xmlString, sourceFileName) {
  const root = parseXML(xmlString);
  const itemEl = findFirst(root, 'item');
  if (!itemEl) {
    throw new Error(`No <item> element found in ${sourceFileName}`);
  }

  const identifier = itemEl.attrs.ident;
  const label = itemEl.attrs.label || null;
  const code = itemEl.attrs.code || null;

  const itemMetadata = findFirst(itemEl, 'itemmetadata');
  const itemTypeEl = itemMetadata ? findFirst(itemMetadata, 'qmd_itemtype') : null;
  const itemSubtype = itemTypeEl ? directText(itemTypeEl).trim() : 'Unknown';

  const presentation = findFirst(itemEl, 'presentation');

  // Gather correct-answer value(s) per response ident from <resprocessing>.
  // Heuristic (matches every case in the exemplar): any <respcondition>
  // whose <setvar> assigns a POSITIVE number to SCORE marks the value(s)
  // tested by its <varequal> as correct. Covers single-answer MC/dropdown,
  // multi-answer Multiple Response (per-choice Set), and FIB (Add branches).
  const correctValues = {}; // respident -> Set<string>
  const resprocessing = findFirst(itemEl, 'resprocessing');
  if (resprocessing) {
    for (const cond of childElements(resprocessing, 'respcondition')) {
      const setvar = findFirst(cond, 'setvar');
      if (!setvar) continue;
      const raw = directText(setvar).trim();
      const val = parseFloat(raw);
      if (Number.isNaN(val) || val <= 0) continue;
      // varequal can appear nested inside <and>/<or>; walk all descendants.
      const stack = [...cond.children];
      while (stack.length) {
        const n = stack.shift();
        if (n.type !== 'element') continue;
        if (localName(n) === 'varequal') {
          const respident = n.attrs.respident;
          const value = directText(n).trim();
          if (!correctValues[respident]) correctValues[respident] = new Set();
          correctValues[respident].add(value);
        }
        stack.push(...n.children);
      }
    }
  }

  let shuffle = null;
  const segments = [];

  function renderChoiceSegment(renderChoiceEl, respident, layout) {
    const shuffleAttr = (renderChoiceEl.attrs.shuffle || 'No').trim().toLowerCase();
    const isShuffle = shuffleAttr === 'yes';
    const choices = [];
    for (const labelEl of childElements(renderChoiceEl, 'response_label')) {
      const choiceId = labelEl.attrs.ident;
      const mattext = findFirst(labelEl, 'mattext');
      const choiceHtml = mattext ? decodeMattext(mattext) : '';
      const isCorrect = !!(correctValues[respident] && correctValues[respident].has(choiceId));
      choices.push({ id: choiceId, html: choiceHtml, correct: isCorrect });
    }
    return { isShuffle, segment: { type: 'choices', layout, choices } };
  }

  for (const child of childElements(presentation)) {
    const tag = localName(child);
    if (tag === 'material') {
      const mattext = findFirst(child, 'mattext');
      if (mattext) {
        const content = decodeMattext(mattext);
        if (content.trim()) segments.push({ type: 'html', html: content });
      }
    } else if (tag === 'response_lid') {
      const respident = child.attrs.ident;
      // material appearing *inside* response_lid (used by "Pull Down List"
      // items) is the sentence fragment right before the dropdown and must
      // render inline, not as a separate paragraph.
      for (const inner of childElements(child)) {
        const innerTag = localName(inner);
        if (innerTag === 'material') {
          const mattext = findFirst(inner, 'mattext');
          if (mattext) {
            const content = decodeMattext(mattext);
            if (content.trim()) segments.push({ type: 'html', html: content });
          }
        } else if (innerTag === 'render_choice') {
          const layout = itemSubtype === 'Pull Down List' ? 'inline' : 'block';
          const { isShuffle, segment } = renderChoiceSegment(inner, respident, layout);
          if (shuffle === null) shuffle = isShuffle;
          segments.push(segment);
        }
      }
    } else if (tag === 'response_str') {
      const respident = child.attrs.ident;
      const renderFib = findFirst(child, 'render_fib');
      const maxChars = renderFib ? renderFib.attrs.maxchars : undefined;
      segments.push({
        type: 'blank',
        respident,
        correct: correctValues[respident] ? Array.from(correctValues[respident]).sort() : [],
        maxchars: maxChars,
      });
    }
  }

  const normType = TYPE_MAP[itemSubtype] || 'unknown';

  return {
    sourceFormat: 'qti1.2',
    identifier,
    label,
    code,
    shuffle: shuffle === null ? false : shuffle,
    itemType: normType,
    itemSubtype,
    segments,
  };
}

module.exports = { parseItem };
