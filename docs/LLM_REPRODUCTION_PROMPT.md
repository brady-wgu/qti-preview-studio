# Reproduction Prompt for QTI Preview Studio

Paste this to Claude (or another capable LLM with code-execution and
file-creation tools), along with the same three input files described below,
to reproduce this application.

---

## Required input files

1. A QTI v1.2 archive (.zip) with `imsmanifest.xml` and item XML files at
   its root, and a `Resources/` folder containing any image assets the
   items use.
2. A QTI v2.1 archive (.zip) with the same structure.
3. A zip of a "Save Page As -> Webpage, complete" export of your assessment
   platform's item preview screen (HTML + its associated `_files` folder of
   CSS/JS/images). This will not contain live item content, but provides the
   real DOM structure, CSS classes, and navigation chrome to derive the
   visual design from.

## The task

Build a lightweight, offline, cross-platform (macOS + Windows) desktop
application that:

1. Lets the user select one or more QTI archive (.zip) files conforming to
   QTI v1.2 or v2.1.
2. Lets the user choose an output location.
3. Processes each selected archive into its own output folder (named after
   the input file, minus the `.zip` extension), containing:
   - **ITEM_PREVIEW.html** -- all items in the archive, presented one at a
     time in a slideshow (Previous/Next navigation), approximating an online
     test-taking experience. Above every item, clearly labeled: its
     identifier (`<item ident="...">` for QTI v1.2, `<assessmentItem
     identifier="...">` for QTI v2.1), its label attribute, its code
     attribute, and whether shuffle is enabled. All item content (stem,
     choices, blanks, etc.) rendered as faithfully as possible to the
     source platform's real formatting/CSS. Correct answer(s) indicated
     directly on the item. Any image assets rendered correctly. Items
     ordered by identifier, ascending, with a user-selectable sort mode:
     "natural" (numeric-aware, so `item2` sorts before `item10`) or
     "string" (strict character-by-character).
   - **PRINT_PREVIEW.html** -- the same items, same visual treatment, but
     laid out as one continuous document (not a slideshow), each item
     separated from the next by a light horizontal rule -- suitable for
     scanning or printing as an answer key.
   - **RESOURCES/** -- every image asset the archive's items use, plus
     anything else needed to make the two HTML files fully self-contained
     and viewable offline (see "Math rendering" below).
   - **Log.txt** -- a plain-text summary of what was converted, any parse
     errors, any unsupported item types encountered, any missing image
     assets, the sort mode used, and final item counts.
4. Lets the user view the CSS stylesheet currently used for generated
   output, edit it in an in-app editor, save it as a persistent override
   (used for all future processing until reset), reset it back to the
   app's baseline default, AND access the raw override CSS file on disk
   directly (support BOTH an in-app editor and raw file access, not just
   one).
5. Works fully offline: no network calls, no data sent anywhere, produces
   no output beyond what's specified above.
6. Produces the same output structure/experience regardless of whether the
   input was QTI v1.2 or v2.1 -- normalize both into one shared internal
   item representation before rendering.

## Scope decisions already made (do not re-litigate unless the user does)

- **Build technology: Electron.** Chosen because the output format is
  itself HTML/CSS/JS, making Electron a close match; also lets the same
  rendering code run inside the app's own UI.
- **Item type scope: MVP supports exactly 4 types** -- Multiple Choice,
  Multiple Response, Fill-in-the-Blank, and Pull Down List (dropdown) --
  matching whatever the QTI v1.2 exemplar actually contains. Any other item
  type should render with a visible "not supported" fallback notice (ID/
  Label/Code still shown) rather than crashing, and be noted in Log.txt.
  Do NOT build out additional item types speculatively for the MVP.
- **Style Editor: both** an in-app text editor AND direct access to the
  underlying CSS file on disk (a "reveal in Finder/Explorer" style action),
  not just one or the other.
- **Sort order: user-toggleable** between natural and string sort at
  processing time; do not hardcode one. Whatever identifier format a given
  QTI source uses, read it generically -- don't assume GUIDs, dotted
  strings, or any other particular convention.
- **Correct-answer detection heuristic (QTI v1.2):** any `<respcondition>`
  whose `<setvar>` assigns a POSITIVE number to `SCORE` marks the value(s)
  tested by its `<varequal>` (search at any nesting depth, to catch
  `<and>`/`<or>` wrapping) as correct. This covers single-answer MC/
  dropdown, multi-answer Multiple Response (per-choice `Set`), and
  Fill-in-Blank (`Add` branches). For QTI v2.1, correctness comes directly
  from `<responseDeclaration><correctResponse>`.
- **Correct-answer display, per item type:**
  - Multiple Choice / Multiple Response: mark the correct choice(s)
    directly, using THREE redundant signals so marking survives regardless
    of choice content type (text vs. image): bold+underline on the choice
    text (no-op for images, but satisfies the literal "bold and underline"
    requirement for text), a green highlighted row/border (works for any
    content type), AND an explicit checkmark badge (unambiguous even in
    black-and-white printouts).
  - Fill-in-the-Blank: render ONLY the blank placeholder inline (no inline
    answer text -- gets unwieldy with many/long accepted variants); list
    accepted answer(s) in a separate "Answer Key" block below the item.
  - Pull Down List / dropdown: render a genuinely interactive (NOT
    disabled) `<select>` inline, so it can be browsed like a real test item
    -- AND ALSO list every option in the below-item Answer Key using the
    same choice-table treatment as MC/MR (correct one highlighted), because
    a native `<select>` on a printed page only ever shows its current
    value, not its full option list.
- **Math rendering (KaTeX):** if the assessment platform's own formatting
  export includes KaTeX JS/CSS, vendor those EXACT files (not a fresh
  download) so rendering behavior matches the source platform precisely;
  supplement with the standard open-source KaTeX distribution's font files
  if the platform export didn't capture them (verify filenames match
  before assuming compatibility). Both generated HTML files should include
  a permanent, user-facing toggle button to switch between rendered math
  and raw LaTeX markup -- this is a property of every generated file, NOT a
  pre-generation setting, and it must auto-hide via `@media print` so it
  doesn't appear on an actual printout.
- **Visual chrome:** derive ITEM_PREVIEW's header/navigation chrome fairly
  closely from the real source platform export (e.g. a solid dark header
  bar matching its actual header color, a fixed bottom nav strip for
  Previous/Next matching its real footer, rather than inventing a generic
  look) -- but do NOT reproduce a live/functional countdown timer, since
  this is a static reference tool, not a timed test session.
- **Batch processing:** one output folder per input archive; resources are
  NOT shared or deduplicated across different archives' output folders,
  even within the same batch run.

## Engineering approach that worked well

- Build and validate a lightweight prototype (a scripting language you're
  comfortable iterating in quickly is fine) BEFORE writing the final
  Electron app, using a hand-picked subset of real items covering every
  supported type (with and without images) from both exemplars. Get
  explicit sign-off on the visual treatment through 2-3 review rounds
  before writing the production app -- this catches real design problems
  (e.g. bold/underline being invisible on image choices) far more cheaply
  than discovering them after the full app is built.
- When porting the validated prototype into the final app, prefer
  dependency-free implementations of small, well-scoped, stable-format
  parsers (XML parsing, ZIP reading) over adding third-party npm packages,
  IF doing so lets you actually execute and test that exact code against
  the real input files during development (e.g. inside a sandbox without
  internet access to install new packages). This trades a small amount of
  extra code for materially higher confidence that the shipped logic
  actually works, and reduces the app's long-term dependency surface.
  Node's built-in `zlib` (for DEFLATE) is sufficient to write a small ZIP
  central-directory reader without any external zip library.
- Test the CORE logic (parsing + rendering, no UI) against the complete
  real exemplar archives, not just a hand-picked subset -- confirm zero
  parse errors and zero items with an undetected correct answer across
  every item in both archives before considering the core logic done.
- If Electron itself cannot be installed/run in your environment, use a
  real browser automation tool (e.g. Playwright, if available) to
  smoke-test the renderer's HTML/CSS/JS in isolation, with a mocked version
  of whatever API the preload script would normally expose. This catches
  real wiring bugs (e.g. event listener setup order, DOM query typos) that
  static syntax-checking alone won't.
- Be upfront, before building, if your environment cannot actually produce
  the final compiled installer/binary artifacts (e.g. no internet access to
  download a runtime like Electron) -- explain exactly what you can still
  fully build and test versus what the user's own machine/CI needs to do to
  produce the final binaries, rather than silently under-delivering or
  overclaiming.

## Deliverables expected

- Full application source code (main process, preload, renderer UI, and a
  clearly separated core library of QTI-parsing/rendering logic that has no
  Electron dependency and can be unit-tested on its own).
- Inline comments on any non-obvious decision, explaining the reasoning
  (especially: the correct-answer heuristic, the dependency-free parser
  choices, the KaTeX vendoring approach, the Style Editor's baseline/
  override file model).
- Developer documentation covering architecture, build/run instructions,
  what was and wasn't able to be tested in the development environment, and
  how to extend the app to new QTI item types.
- A build configuration (e.g. electron-builder) targeting both macOS and
  Windows installers/binaries.
- An end-user Quick Start guide.
- A top-level README describing the app's purpose and every output file it
  produces.
- A verbatim transcript of the prompt session that produced the app.
- This reproduction prompt itself, kept in the deliverable.
