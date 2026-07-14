# QTI Preview Studio -- Developer Documentation

## What this app does

Converts IMS QTI v1.2 or v2.1 item bank archives (`.zip`) into two static,
offline HTML previews per archive:

- **ITEM_PREVIEW.html** -- one item at a time, slideshow-style, approximating
  the online test-taking experience.
- **PRINT_PREVIEW.html** -- all items stacked vertically with a rule between
  each, suitable for scanning or printing as an answer key.

Both files are fully self-contained (styles, images, and a bundled KaTeX math
renderer all live alongside them in a `RESOURCES/` folder) and work fully
offline -- no network calls are made by the app or by the generated output.

## IMPORTANT: this sandbox could not produce the final .app / .exe binaries

This project was built inside a sandboxed development environment with **no
internet access**. That means:

- Every module in `lib/` and the core QTI parsing/rendering logic **was
  fully written and tested** against the real exemplar archives (all 306
  QTI v1.2 items across all 4 supported types, and all 201 QTI v2.1 items) --
  see "Testing" below for exactly what was verified and how to re-verify it.
- The renderer UI (`src/renderer/`) **was smoke-tested** in a real Chromium
  browser via Playwright with a mocked `qtiApp` bridge (see
  `test/smoke-test-renderer.js`), since Electron itself could not be
  installed in that sandbox (no network access to fetch the Electron
  runtime).
- The Electron **main process** (`src/main/main.js`) and **preload script**
  (`src/preload/preload.js`) are syntactically valid and were carefully
  written against Electron's documented, stable APIs, but could not be
  executed end-to-end inside Electron itself in that environment. Do a
  quick manual pass (see "First build" below) before relying on it.
- Producing the actual `.dmg`/`.zip` (mac) and `.exe`/portable (Windows)
  binaries requires running `electron-builder` on a machine with internet
  access (to download Electron's prebuilt runtime binaries for each
  platform). This is a completely standard part of any Electron project --
  nothing unusual was skipped, it just couldn't happen inside that specific
  sandbox.

## Architecture

```
qti-preview-studio/
  package.json            electron-builder config + npm scripts
  lib/qti/                 Core, Electron-independent QTI processing logic.
                            Pure Node.js -- no Electron APIs used here, so
                            it's fully unit-testable with plain `node`.
    xml-parser.js           Dependency-free, order-preserving XML parser
                            scoped to what QTI files actually use.
    zip-reader.js            Dependency-free ZIP reader (central directory +
                            stored/deflate entries) using only Node's zlib.
    parse-qti12.js           Parses a QTI v1.2 <item> into the normalized
                            item model (see "Normalized item model" below).
    parse-qti21.js           Parses a QTI v2.1 <assessmentItem> into the same
                            normalized item model.
    render.js                Renders one normalized item into the HTML used
                            inside a .qti-item-card (shared between both
                            preview experiences).
    page-templates.js        Wraps rendered items into the full
                            ITEM_PREVIEW.html / PRINT_PREVIEW.html documents,
                            including the KaTeX include + rendered/raw
                            LaTeX toggle.
    sort.js                  Natural vs. string identifier sort.
    process-archive.js       Orchestrates one archive end-to-end: read zip ->
                            detect version -> parse every item -> sort ->
                            copy image assets + KaTeX + stylesheet -> write
                            the 4 output files.
  lib/style/
    baseline.css              Bundled default stylesheet for generated output
                            (derived from the source assessment platform's
                            CSS -- see its own header comment).
    style-manager.js           Baseline vs. user-override CSS: get/save/reset,
                            and exposes the on-disk override file path.
  assets/katex/              Vendored KaTeX (JS + CSS from the user's own
                            platform export, standard KaTeX font files) --
                            bundled into every output's RESOURCES/katex/ so
                            math renders fully offline.
  src/main/main.js           Electron main process: window, menu, IPC.
  src/preload/preload.js      contextBridge API surface exposed to the
                            renderer (no direct Node access in the renderer).
  src/renderer/                The UI: file picker, output location, sort
                            option, process button + results, Style Editor.
  test/                       Regression + smoke tests (see "Testing").
  docs/                       This file, the Quick Start guide, the original
                            prompt transcript, and the LLM reproduction
                            prompt.
```

### Normalized item model

Both `parse-qti12.js` and `parse-qti21.js` produce the same shape, so
`render.js` and everything downstream is completely version-agnostic:

```js
{
  sourceFormat: 'qti1.2' | 'qti2.1',
  identifier: string,
  label: string | null,
  code: string | null,
  shuffle: boolean,
  itemType: 'multiple_choice' | 'multiple_response' | 'fill_in_blank' | 'dropdown' | 'unknown',
  itemSubtype: string,   // original QTI type name, for the Log.txt / fallback notice
  segments: [
    { type: 'html', html: string },
    { type: 'choices', layout: 'block' | 'inline', choices: [{ id, html, correct }] },
    { type: 'blank', respident, correct: string[], maxchars },
  ]
}
```

`segments` preserves the item's original document order, which is what lets
Fill-in-the-Blank and Pull-Down-List items reconstruct their blank/dropdown
in the right place within the surrounding sentence.

### Why two dependency-free modules (xml-parser.js, zip-reader.js)?

This app has exactly one runtime npm dependency it *could* have had zero of
were it not for convenience: none, actually -- **`adm-zip` was deliberately
NOT used**; `zip-reader.js` is a small, from-scratch ZIP central-directory
reader built on Node's built-in `zlib`. Likewise, `xml-parser.js` is a small
from-scratch XML parser rather than a dependency like `@xmldom/xmldom`. Both
decisions were made for the same two reasons:

1. Fewer runtime dependencies to audit/maintain long-term for a stable,
   narrowly-scoped file format.
2. It meant both modules could be **fully tested against the real uploaded
   QTI archives** during development, inside a sandbox that had no internet
   access to install a new npm package.

If a future maintainer prefers standard libraries instead, both are isolated,
single-file modules with a narrow, documented interface -- swapping either
out does not require touching any other file.

### Correct-answer detection heuristic

QTI v1.2's `<resprocessing>` can express scoring in fairly open-ended ways.
This app uses one heuristic, confirmed against every item in both exemplar
archives (0 items with an undetected correct answer, across 306 + 201 = 507
items): **any `<respcondition>` whose `<setvar>` assigns a positive number to
`SCORE` marks the value(s) tested by its `<varequal>` (searched at any
nesting depth, to catch `<and>`/`<or>` wrapping) as correct.** For QTI v2.1,
correctness comes directly from `<responseDeclaration><correctResponse>`,
which is unambiguous.

If a future QTI source uses a resprocessing pattern outside this heuristic
(e.g. genuinely partial-credit scoring with no single "correct" answer, or
negative marking schemes), this is the one place (`parse-qti12.js`'s
`correctValues` logic) to revisit.

## Building

**If you want the full step-by-step walkthrough (checking for Node.js,
navigating a terminal, what to do about the "unidentified developer" /
SmartScreen warnings on first launch, etc.), see `docs/BUILDING_THE_APP.md`
instead of this section.** The commands themselves:

```bash
npm install         # requires internet access (downloads Electron + electron-builder)
npm start           # runs the app in development mode
npm run test:core   # re-verifies the parsing/rendering pipeline against real archives
npm run dist:mac    # produces mac .dmg/.zip in release/ (run on a Mac, or via CI)
npm run dist:win    # produces Windows installer + portable .exe in release/
npm run dist:all    # both (electron-builder supports cross-building in some CI setups;
                    # for guaranteed results, build mac on a Mac and Windows on Windows/CI)
```

### First build -- what to double check

Since the Electron main process / preload / renderer trio couldn't be run
together in the original development sandbox, budget a little time on the
very first `npm start` to click through: select files -> choose output
folder -> Process -> open each result link -> open the Style Editor -> save
an override -> reset. Everything downstream of that (the actual QTI parsing
and HTML generation) has already been verified at full scale.

## Testing

- **`npm run test:core -- /path/to/QTIv1.2.zip /path/to/QTIv2.1.zip`** --
  runs the complete core pipeline against two real archives and reports
  pass/fail with item counts. This is the same check used during
  development against this project's exemplar files (306 v1.2 items across
  all 4 supported types + 201 v2.1 multiple-choice items, 0 parse errors,
  0 items with an undetected correct answer).
- **`npm run test:ui`** (requires `playwright` installed separately --
  `npm install playwright && npx playwright install chromium`, since it's a
  dev-only tool and not worth bundling into every install) -- smoke-tests
  the renderer UI's wiring (file selection, output dir selection, Process
  button enabling, results rendering, Style Editor open/populate) inside a
  real Chromium browser with a mocked `qtiApp` bridge standing in for
  Electron's preload.

## Extending to more QTI item types

Per the agreed MVP scope, only 4 item types are supported (Multiple Choice,
Multiple Response, Fill-in-the-Blank, Pull Down List / dropdown); anything
else parses with `itemType: 'unknown'` and renders a fallback notice (visible
in both previews and noted in Log.txt) rather than crashing. To add a new
type (e.g. Matching, Essay, Hot Spot):

1. In `parse-qti12.js` / `parse-qti21.js`: map its QTI subtype name/element
   to a new `itemType` string, and produce whatever new `segments` entry
   type makes sense for it.
2. In `render.js`: add a case for the new segment type in `renderItemBody`
   (and in `renderAnswerKey` if its correct answer needs a below-item
   callout the way Fill-in-Blank/dropdown do).
3. Add the new choice/segment CSS to `lib/style/baseline.css`.
4. Add a fixture item and extend `test/run-against-exemplars.js` (or add a
   small dedicated unit test) to cover it.

## The Style Editor and baseline.css

`lib/style/baseline.css` is the bundled default. The Style Editor's "Save"
button writes a **separate** override file at
`<Electron userData dir>/style-override.css` (e.g.
`~/Library/Application Support/QTI Preview Studio/style-override.css` on
mac, `%APPDATA%\QTI Preview Studio\style-override.css` on Windows) --
`baseline.css` itself is never modified. "Reset to Baseline" deletes that
override file rather than overwriting it, so a future app update that
changes the bundled baseline is picked up cleanly for anyone who hasn't
customized their styles. The "Reveal File on Disk" button opens the user's
file manager directly at that override file, per the project decision to
support both an in-app editor and raw file access.

## Known limitations / things a future developer should know

- Only 4 QTI item types are supported (see above); this was an explicit MVP
  scope decision, not an oversight.
- QTI v2.1's `label`/`code` metadata is simply absent from the provided
  exemplar (empty `<metadata/>` in the manifest, no attributes on
  `<assessmentItem>`), so the app shows "(not specified)" for those fields
  on v2.1 items rather than guessing.
- The bundled ZIP reader does not support Zip64 (not needed for QTI item
  bank archives, which are far under the classic-ZIP size/entry-count
  limits) -- it will throw a clear error rather than silently truncating
  data if it ever encounters one.
- The correct-answer heuristic (see above) is confirmed against the two
  provided exemplars but is a heuristic, not a QTI-spec guarantee; revisit
  if a future source uses an unusual resprocessing pattern.
