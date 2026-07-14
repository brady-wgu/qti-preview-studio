'use strict';

const { parseXML, findFirst, childElements, localName } = require('./xml-parser');

/**
 * Parses a single IMS QTI v2.1 <assessmentItem> XML string into the same
 * normalized item model produced by parse-qti12.js. The provided v2.1
 * exemplar only contains choiceInteraction (MC / MR) items, but this parser
 * is written generically enough to also handle the other 3 in-scope MVP
 * types if a future v2.1 input uses them; anything else degrades to
 * item_type "unknown" per the agreed MVP scope (best-effort fallback +
 * Log.txt note).
 */

function serializeChildren(el) {
  // QTI 2.1 mixes literal HTML-ish elements (p, sub, sup, span, table,
  // img...) directly into itemBody/prompt as REAL XML children (unlike
  // v1.2, which HTML-escapes the same content into text). We serialize the
  // inner XML back out as HTML, stripping the QTI namespace prefix so tags
  // like <p>, <sub>, <img> come out as plain HTML the renderer understands.
  let out = '';
  for (const child of el.children) {
    if (child.type === 'text') {
      out += child.value;
    } else if (child.type === 'element') {
      out += serializeElement(child);
    }
  }
  return out;
}

const VOID_TAGS = new Set(['img', 'br']);

function serializeElement(el) {
  const tag = localName(el);
  const attrString = Object.entries(el.attrs)
    .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
    .join('');
  if (VOID_TAGS.has(tag)) {
    return `<${tag}${attrString}/>`;
  }
  return `<${tag}${attrString}>${serializeChildren(el)}</${tag}>`;
}

function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function parseItem(xmlString, sourceFileName) {
  const root = parseXML(xmlString);
  // root itself should be assessmentItem
  const identifier = root.attrs.identifier;
  const label = root.attrs.label || null; // absent in the exemplar; kept generic
  const code = root.attrs.code || null; // absent in the exemplar; kept generic

  const itemBody = findFirst(root, 'itemBody');
  if (!itemBody) {
    throw new Error(`No <itemBody> element found in ${sourceFileName}`);
  }

  // Correct response(s) per responseIdentifier, from <correctResponse>.
  const correctByRespId = {};
  for (const rd of childElements(root, 'responseDeclaration')) {
    const respid = rd.attrs.identifier;
    const cr = findFirst(rd, 'correctResponse');
    if (!cr) continue;
    const values = childElements(cr, 'value').map((v) => (v.children[0] && v.children[0].value ? v.children[0].value.trim() : ''));
    correctByRespId[respid] = new Set(values);
  }

  const segments = [];
  let itemType = 'unknown';
  let itemSubtype = 'Unknown';
  let shuffle = false;

  const choiceInteraction = findDeep(itemBody, 'choiceInteraction');
  if (choiceInteraction) {
    const respident = choiceInteraction.attrs.responseIdentifier;
    const maxChoices = parseInt(choiceInteraction.attrs.maxChoices || '1', 10) || 1;
    shuffle = (choiceInteraction.attrs.shuffle || 'false').trim().toLowerCase() === 'true';
    itemType = maxChoices !== 1 ? 'multiple_response' : 'multiple_choice';
    itemSubtype = maxChoices !== 1 ? 'Multiple Response' : 'Multiple Choice';

    const promptEl = findFirst(choiceInteraction, 'prompt');
    if (promptEl) {
      const stemHtml = serializeChildren(promptEl);
      if (stemHtml.trim()) segments.push({ type: 'html', html: stemHtml });
    }

    const choices = [];
    for (const sc of childElements(choiceInteraction, 'simpleChoice')) {
      const choiceId = sc.attrs.identifier;
      const choiceHtml = serializeChildren(sc).trim();
      const isCorrect = !!(correctByRespId[respident] && correctByRespId[respident].has(choiceId));
      choices.push({ id: choiceId, html: choiceHtml, correct: isCorrect });
    }
    segments.push({ type: 'choices', layout: 'block', choices });
  }
  // else: other interaction types (textEntryInteraction, matchInteraction,
  // etc.) are out of MVP scope; itemType stays "unknown" so the renderer
  // shows a graceful fallback and Log.txt records it.

  return {
    sourceFormat: 'qti2.1',
    identifier,
    label,
    code,
    shuffle,
    itemType,
    itemSubtype,
    segments,
  };
}

/** Deep (any-depth) search for the first descendant element with a given local name. */
function findDeep(node, name) {
  const stack = [...node.children];
  while (stack.length) {
    const n = stack.shift();
    if (n.type === 'element') {
      if (localName(n) === name) return n;
      stack.unshift(...n.children);
    }
  }
  return null;
}

module.exports = { parseItem };
