'use strict';

/**
 * A small, dependency-free XML parser producing an order-preserving DOM-lite
 * tree: { type: 'element', name, attrs, children } and { type: 'text', value }
 * nodes. This is intentionally NOT a general-purpose XML parser -- it is
 * scoped to what IMS QTI v1.2 / v2.1 item files actually use:
 *   - elements with attributes (including namespaced attrs like xsi:...)
 *   - nested elements
 *   - text content (including HTML-escaped text, decoded once)
 *   - CDATA sections
 *   - comments and the <?xml ...?> declaration (both skipped)
 *
 * WHY NOT A LIBRARY (e.g. @xmldom/xmldom)? This app has exactly one other
 * runtime dependency (adm-zip, for reading the .zip QTI archives). Keeping
 * XML parsing in-house avoids taking on an additional third-party parser
 * dependency for a well-scoped, stable file format, and -- more importantly
 * for this project's process -- it meant this exact parser could be
 * unit-tested against the real exemplar archives during development,
 * whereas a newly-added dependency could not be installed/verified inside
 * the offline development sandbox this app was originally built in.
 * If a future maintainer prefers a battle-tested library instead, swapping
 * this module out is straightforward: everything downstream consumes the
 * { type, name, attrs, children } node shape, not this file's internals.
 */

const ENTITY_MAP = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

function decodeEntities(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      if (Number.isNaN(code)) return match;
      return String.fromCodePoint(code);
    }
    if (Object.prototype.hasOwnProperty.call(ENTITY_MAP, ent)) {
      return ENTITY_MAP[ent];
    }
    return match; // unknown entity, leave as-is
  });
}

function parseAttrs(attrString) {
  const attrs = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrString)) !== null) {
    const name = m[1];
    const value = m[3] !== undefined ? m[3] : m[4];
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/**
 * Parses an XML string into a single root element node.
 * Throws on malformed input (unbalanced tags).
 */
function parseXML(xmlString) {
  let i = 0;
  const len = xmlString.length;

  function skipDeclarationsAndComments() {
    for (;;) {
      // skip whitespace
      while (i < len && /\s/.test(xmlString[i])) i++;
      if (xmlString.startsWith('<?', i)) {
        const end = xmlString.indexOf('?>', i);
        i = end === -1 ? len : end + 2;
        continue;
      }
      if (xmlString.startsWith('<!--', i)) {
        const end = xmlString.indexOf('-->', i);
        i = end === -1 ? len : end + 3;
        continue;
      }
      if (xmlString.startsWith('<!DOCTYPE', i) || xmlString.startsWith('<!doctype', i)) {
        // naive skip to matching '>' (QTI files don't use internal subsets
        // with nested '[...]' in practice; if they ever do, this would need
        // bracket-depth tracking)
        const end = xmlString.indexOf('>', i);
        i = end === -1 ? len : end + 1;
        continue;
      }
      break;
    }
  }

  function parseElement() {
    // assumes xmlString[i] === '<'
    i++; // consume '<'
    const nameMatch = /^[a-zA-Z_:][-a-zA-Z0-9_:.]*/.exec(xmlString.slice(i));
    if (!nameMatch) throw new Error(`Malformed tag at position ${i}`);
    const name = nameMatch[0];
    i += name.length;

    const attrStart = i;
    // find end of tag, respecting quoted attribute values
    let inQuote = null;
    while (i < len) {
      const c = xmlString[i];
      if (inQuote) {
        if (c === inQuote) inQuote = null;
      } else if (c === '"' || c === "'") {
        inQuote = c;
      } else if (c === '>') {
        break;
      }
      i++;
    }
    const rawAttrs = xmlString.slice(attrStart, i);
    const selfClosing = rawAttrs.trim().endsWith('/');
    const attrs = parseAttrs(selfClosing ? rawAttrs.trim().slice(0, -1) : rawAttrs);
    i++; // consume '>'

    const node = { type: 'element', name, attrs, children: [] };

    if (selfClosing) return node;

    // parse children until matching close tag
    let textBuf = '';
    const flushText = () => {
      if (textBuf.length > 0) {
        node.children.push({ type: 'text', value: decodeEntities(textBuf) });
        textBuf = '';
      }
    };

    while (i < len) {
      if (xmlString.startsWith('<![CDATA[', i)) {
        const end = xmlString.indexOf(']]>', i);
        const raw = end === -1 ? xmlString.slice(i + 9) : xmlString.slice(i + 9, end);
        textBuf += raw; // CDATA content is literal, not entity-decoded
        i = end === -1 ? len : end + 3;
        continue;
      }
      if (xmlString.startsWith('<!--', i)) {
        const end = xmlString.indexOf('-->', i);
        i = end === -1 ? len : end + 3;
        continue;
      }
      if (xmlString.startsWith('</', i)) {
        flushText();
        const closeMatch = /^<\/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*>/.exec(xmlString.slice(i));
        if (!closeMatch) throw new Error(`Malformed closing tag at position ${i}`);
        if (closeMatch[1] !== name) {
          throw new Error(`Mismatched closing tag: expected </${name}> got </${closeMatch[1]}> at position ${i}`);
        }
        i += closeMatch[0].length;
        return node;
      }
      if (xmlString[i] === '<') {
        const next = xmlString[i + 1];
        const looksLikeTag = next && /[a-zA-Z_/!?]/.test(next);
        if (!looksLikeTag) {
          // Stray literal '<' in text (e.g. "f(1) < g(1)" inside inline math)
          // -- technically invalid XML, but real QTI exports contain it.
          // Treat as literal text rather than failing the whole file.
          textBuf += xmlString[i];
          i++;
          continue;
        }
        flushText();
        node.children.push(parseElement());
        continue;
      }
      textBuf += xmlString[i];
      i++;
    }
    flushText();
    return node; // ran off the end without a close tag; lenient return
  }

  skipDeclarationsAndComments();
  if (xmlString[i] !== '<') {
    throw new Error('Expected root element');
  }
  const root = parseElement();
  return root;
}

/** Depth-first search for the first descendant element with the given local name (namespace prefix ignored). */
function findFirst(node, localName) {
  if (!node) return null;
  const stack = [...node.children];
  while (stack.length) {
    const n = stack.shift();
    if (n.type === 'element') {
      const ln = n.name.includes(':') ? n.name.split(':').pop() : n.name;
      if (ln === localName) return n;
      stack.unshift(...n.children);
    }
  }
  return null;
}

/** Direct children only (not deep) matching a local name. */
function childElements(node, localName) {
  return node.children.filter((c) => {
    if (c.type !== 'element') return false;
    const ln = c.name.includes(':') ? c.name.split(':').pop() : c.name;
    return localName ? ln === localName : true;
  });
}

function localName(node) {
  return node.name.includes(':') ? node.name.split(':').pop() : node.name;
}

/** Concatenated direct text content of an element (non-recursive). */
function directText(node) {
  return node.children
    .filter((c) => c.type === 'text')
    .map((c) => c.value)
    .join('');
}

module.exports = { parseXML, decodeEntities, findFirst, childElements, localName, directText };
