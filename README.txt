QTI PREVIEW STUDIO
==================

WHAT THIS APP IS FOR
---------------------
QTI Preview Studio is an offline desktop application that converts IMS QTI
item bank archives (.zip files, QTI v1.2 or v2.1) into browser-viewable HTML
previews of the items they contain. It exists to serve two purposes:

1. PRE-IMPORT PREVIEW -- see how a QTI file's items will actually look
   before importing them into your assessment platform, to catch obvious
   formatting problems early and reduce QA/cleanup time after import.

2. POST-IMPORT VALIDATION -- after importing a QTI file into your item
   bank, use these same previews as a visual reference to confirm items
   came through without losing formatting or content fidelity.

The app works entirely offline: it does not access the network, and it does
not send data anywhere. It also does not modify or interact with your
assessment platform in any way -- it only reads QTI files you select and
writes HTML files to a folder you choose.

WHAT YOU SELECT
---------------
One or more QTI archive (.zip) files, each conforming to the QTI v1.2 or
QTI v2.1 specification, containing an imsmanifest.xml and one or more item
XML files (with any image assets used by those items in a Resources folder
inside the archive).

WHAT GETS CREATED
------------------
For each QTI file you process, the app creates one output folder (named
after that file, without the .zip extension) inside the output location you
choose. Each output folder contains:

  ITEM_PREVIEW.html
      All items in the archive, presented one at a time in a slideshow
      that approximates the online test-taking experience, with Next/
      Previous navigation. Above each item: its Item ID, Label, Code, and
      whether response shuffling is enabled. Correct answers are marked
      directly on the choice list (highlighted row + a checkmark badge);
      for fill-in-the-blank and dropdown items, accepted answers appear in
      a separate "Answer Key" box below the item. Items are ordered by
      identifier according to the sort mode (Natural or String) chosen at
      processing time. A button in the corner toggles between rendered
      math (LaTeX typeset properly) and raw LaTeX markup.

  PRINT_PREVIEW.html
      The same items and the same visual treatment as ITEM_PREVIEW.html,
      but laid out as one continuous scrollable/printable document, each
      item separated from the next by a light horizontal rule -- suitable
      for a quick scan or for printing a paper answer key. Includes the
      same rendered/raw LaTeX toggle.

  RESOURCES/
      Every image asset used by the items in this archive, plus the
      bundled KaTeX math-rendering library (so LaTeX renders correctly with
      no network access required) and the stylesheet in effect at the time
      of processing (styles.css, one level up from RESOURCES/ -- see
      below). Nothing here is shared with any other output folder, even if
      you process multiple QTI files in the same batch.

  styles.css
      A copy of the stylesheet used to generate this specific output
      (either the app's baseline style, or your saved custom override from
      the Style Editor, whichever was in effect at the time you clicked
      Process). Kept alongside the output so a given ITEM_PREVIEW.html /
      PRINT_PREVIEW.html pair always displays exactly as it did when it was
      generated, even if you later change your style settings in the app.

  Log.txt
      A plain-text record of the conversion: which QTI version was
      detected, every item that was converted (with its identifier and
      detected item type), any items that could not be parsed and why, any
      item types not supported by this version of the app, any image
      assets referenced by an item but missing from the archive, which
      sort mode was used, and final item counts. Use this to troubleshoot
      anything that looks wrong in the HTML output.

SUPPORTED ITEM TYPES (this version)
------------------------------------
Multiple Choice, Multiple Response, Fill-in-the-Blank, and Pull Down List
(dropdown) items are fully supported. Any other QTI item type still appears
in both previews with its Item ID/Label/Code visible, but with a visible
notice that its type isn't supported yet instead of its actual content;
Log.txt lists every such item.

MORE INFORMATION
-----------------
- docs/QUICKSTART.md -- a short walkthrough of using the app (also
  available from the Help menu inside the app).
- docs/BUILDING_THE_APP.md -- step-by-step instructions (no prior developer
  experience assumed) for turning the source code into an actual Mac or
  Windows application you can double-click to run.
- docs/DEVELOPER.md -- architecture, build instructions, and how to extend
  the app to new QTI item types, for anyone maintaining or modifying it.
