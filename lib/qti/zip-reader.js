'use strict';

const zlib = require('zlib');

/**
 * Minimal, dependency-free ZIP reader covering what standard QTI archive
 * exports use: a central directory listing "stored" (method 0) and
 * "deflate" (method 8) entries. No zip64 support (not needed for QTI item
 * bank archives, which are well under the 4GB/65535-entry classic-ZIP
 * limits) -- if a future archive ever needs zip64, this module will throw
 * a clear error rather than silently truncating data.
 *
 * WHY NOT A LIBRARY (e.g. adm-zip)? Same reasoning as xml-parser.js: one
 * fewer runtime dependency, and -- the bigger reason -- it meant this exact
 * module could be run against the real uploaded QTIv1.2/v2.1 archives
 * during development inside an offline sandbox where installing a new npm
 * package wasn't possible. If a future maintainer wants to swap in a
 * library instead, only this file needs to change: it exposes a single
 * `readEntries(buffer) -> [{ name, isDirectory, getData() }]` function.
 */

const EOCD_SIG = 0x06054b50;
const CENTRAL_DIR_SIG = 0x02014b50;
const LOCAL_FILE_SIG = 0x04034b50;

function findEndOfCentralDirectory(buf) {
  // EOCD is at the end of the file, but may be preceded by a variable-length
  // comment, so scan backward for the signature (max comment length 65535).
  const maxScan = Math.min(buf.length, 65535 + 22);
  const start = buf.length - maxScan;
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      return i;
    }
  }
  throw new Error('Not a valid ZIP file (End Of Central Directory record not found)');
}

function readEntries(buf) {
  const eocdOffset = findEndOfCentralDirectory(buf);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);

  if (centralDirOffset === 0xffffffff || totalEntries === 0xffff) {
    throw new Error('This ZIP file uses ZIP64 extensions, which are not supported by this reader.');
  }

  const entries = [];
  let ptr = centralDirOffset;

  for (let i = 0; i < totalEntries; i++) {
    const sig = buf.readUInt32LE(ptr);
    if (sig !== CENTRAL_DIR_SIG) {
      throw new Error(`Malformed ZIP central directory entry at offset ${ptr}`);
    }
    const generalPurposeFlag = buf.readUInt16LE(ptr + 8);
    const method = buf.readUInt16LE(ptr + 10);
    const compressedSize = buf.readUInt32LE(ptr + 20);
    const uncompressedSize = buf.readUInt32LE(ptr + 24);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localHeaderOffset = buf.readUInt32LE(ptr + 42);
    const nameStart = ptr + 46;
    const isUtf8 = (generalPurposeFlag & 0x0800) !== 0;
    const rawName = buf.slice(nameStart, nameStart + nameLen);
    const name = isUtf8 ? rawName.toString('utf8') : rawName.toString('latin1');
    const isDirectory = name.endsWith('/');

    entries.push({
      name,
      isDirectory,
      _method: method,
      _compressedSize: compressedSize,
      _uncompressedSize: uncompressedSize,
      _localHeaderOffset: localHeaderOffset,
      getData() {
        return extractEntryData(buf, this);
      },
    });

    ptr = nameStart + nameLen + extraLen + commentLen;
  }

  return entries;
}

function extractEntryData(buf, entry) {
  if (entry.isDirectory) return Buffer.alloc(0);
  const off = entry._localHeaderOffset;
  const sig = buf.readUInt32LE(off);
  if (sig !== LOCAL_FILE_SIG) {
    throw new Error(`Malformed ZIP local file header for "${entry.name}" at offset ${off}`);
  }
  const nameLen = buf.readUInt16LE(off + 26);
  const extraLen = buf.readUInt16LE(off + 28);
  const dataStart = off + 30 + nameLen + extraLen;
  const compressed = buf.slice(dataStart, dataStart + entry._compressedSize);

  if (entry._method === 0) {
    return compressed; // stored, no compression
  }
  if (entry._method === 8) {
    return zlib.inflateRawSync(compressed);
  }
  throw new Error(`Unsupported ZIP compression method (${entry._method}) for entry "${entry.name}"`);
}

module.exports = { readEntries };
