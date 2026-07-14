# QTI Preview Studio -- Quick Start Guide

*(Looking for how to turn the source code into an actual installable app?
See `docs/BUILDING_THE_APP.md` instead -- this guide assumes the app is
already installed and running.)*

## What it's for

QTI Preview Studio turns a QTI item bank archive (`.zip`, v1.2 or v2.1) into
two browser-viewable HTML previews, without needing to import the items into
your assessment platform first:

- **Item Preview** -- one item at a time, like taking the actual test.
- **Print Preview** -- all items stacked on one scrollable page, good for a
  quick scan or for printing an answer key.

Both work completely offline once generated -- you can email the output
folder, put it on a shared drive, or open it straight from your Desktop.

## Using the app

1. **Select QTI Files.** Click "Select QTI Files…" and choose one or more
   `.zip` archives. You can select more than one at a time -- each gets its
   own output folder.
2. **Choose Output Location.** Pick the folder where you want the output
   folders created. Each input file gets a folder named after it (minus the
   `.zip`).
3. **Options.** Choose how items should be sorted by their identifier:
   - **Natural** -- treats numbers as numbers, so `item2` sorts before
     `item10`.
   - **String** -- strict character-by-character sort.
4. **Process Files.** Click the button. When each archive finishes, you'll
   see the item count and buttons to open:
   - **Item Preview** -- opens in your default browser.
   - **Print Preview** -- opens in your default browser.
   - **Log** -- a plain text summary of what was converted and any warnings.
   - **Reveal Folder** -- opens the output folder in Finder/Explorer.

## Reading the output

Above every item you'll see its **Item ID**, **Label**, **Code**, and
whether **Shuffle** is on. Correct answers are marked with a green highlight
and a "✓ Correct" badge directly on the choice. For fill-in-the-blank and
dropdown items, the accepted answer(s) appear in a green **Answer Key** box
below the item instead (dropdown items also show every option there, since a
printed page can't show what's inside a collapsed dropdown).

In the top-right corner of both previews, a button lets you switch between
**rendered math** (LaTeX typeset properly, matching your assessment
platform) and **raw LaTeX markup** (useful if you specifically want to
review the underlying markup rather than the typeset result).

## The Style Editor

Click **Style Editor** in the header (or **View > Style Editor** in the menu)
to see the CSS that controls how generated pages look. You can:

- Edit it directly and click **Save** -- this becomes your personal override
  and is used for every future run, until you reset it.
- Click **Reset to Baseline** to go back to the app's default styling.
- Click **Reveal File on Disk** to open the actual `style-override.css` file
  in Finder/Explorer, if you'd rather edit it in your own text editor. The
  app picks up your changes the next time you generate output, or
  immediately if you click **Reload from Disk** in the Style Editor.

## Notes

- The app works entirely offline. It does not send any data anywhere.
- Re-processing the same archive overwrites its previous output folder.
- If an item's type isn't one this MVP version supports, it still appears in
  the preview with its ID/Label/Code visible and a note that its type isn't
  supported yet -- check Log.txt for a full list.
