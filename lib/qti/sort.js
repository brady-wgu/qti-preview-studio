'use strict';

/**
 * Two sort strategies for ordering items by identifier, exposed as a user
 * preference (see the Options panel in the renderer) since identifier
 * conventions vary across QTI sources -- v1.2 GUIDs, v2.1 free-text
 * identifiers, or anything a future source might use. Neither strategy
 * assumes any particular identifier format.
 */

/** 'Natural' sort: splits into digit / non-digit runs so 'item2' < 'item10'. */
function naturalSortKey(s) {
  return String(s)
    .split(/(\d+)/)
    .map((part) => (part.length && /^\d+$/.test(part) ? part.padStart(20, '0') : part.toLowerCase()));
}

/** Plain case-insensitive lexicographic sort. */
function stringSortKey(s) {
  return String(s).toLowerCase();
}

function compareArrays(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] === undefined ? '' : a[i];
    const bv = b[i] === undefined ? '' : b[i];
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/**
 * Sorts an array of normalized items in place-safe fashion (returns a new
 * sorted array) by `identifier`, using either 'natural' or 'string' mode.
 */
function sortItems(items, mode) {
  const copy = items.slice();
  if (mode === 'natural') {
    copy.sort((a, b) => compareArrays(naturalSortKey(a.identifier), naturalSortKey(b.identifier)));
  } else {
    copy.sort((a, b) => {
      const ak = stringSortKey(a.identifier);
      const bk = stringSortKey(b.identifier);
      if (ak < bk) return -1;
      if (ak > bk) return 1;
      return 0;
    });
  }
  return copy;
}

module.exports = { naturalSortKey, stringSortKey, sortItems };
