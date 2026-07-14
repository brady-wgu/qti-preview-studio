# QTI Preview Studio

Preview a QTI item bank (`.zip`, v1.2 or v2.1) as offline HTML, without importing it into your assessment platform first.

Two views of every bank:

- **Item Preview:** one item at a time, like taking the test.
- **Print Preview:** every item on one scrollable page, good for scanning or printing an answer key.

Correct answers are highlighted, math is typeset (with a toggle for raw LaTeX), and images are included. Everything runs offline; no data leaves your machine.

## Download

Get the latest build from the [**Releases page**](https://github.com/brady-wgu/qti-preview-studio/releases/latest).

| File | What it is |
|------|-----------|
| `QTI Preview Studio <version>.exe` | Windows portable. Double-click to run, no install. **Easiest.** |
| `QTI Preview Studio Setup <version>.exe` | Windows installer, adds a Start-menu shortcut. |
| `QTI Preview Studio-<version>-arm64.dmg` | macOS (Apple Silicon). |

> **First launch:** the app is unsigned, so Windows shows "Windows protected your PC." Click **More info**, then **Run anyway**. Once per machine.

## Use it

1. **Select QTI Files:** one or more `.zip` archives (each gets its own output folder).
2. **Choose Output Location:** where the output folders are created.
3. **Options:** sort items by **Natural** order (`item2` before `item10`) or strict **String** order.
4. **Process Files.** Each archive then shows four buttons:

| Button | Action |
|--------|--------|
| Item Preview | Opens the one-item slideshow in your browser. |
| Print Preview | Opens all items stacked in your browser. |
| Log | Opens `Log.txt`, a summary of what converted. |
| Reveal Folder | Opens the output folder. |

Correct answers carry a green **✓ Correct** badge; fill-in and dropdown answers appear in an Answer Key box. The top-right button toggles typeset math and raw LaTeX. Full walkthrough: [`docs/QUICKSTART.md`](docs/QUICKSTART.md).

## Build from source

Requires [Node.js](https://nodejs.org) 18 or newer.

```sh
npm install          # one time
npm run dist:win     # Windows installer + portable
npm run dist:mac     # macOS build (run on a Mac)
```

Output lands in `release/`. Step-by-step guide: [`docs/BUILDING_THE_APP.md`](docs/BUILDING_THE_APP.md).

Prefer not to build locally? Push a version tag (`git tag v1.0.2 && git push origin v1.0.2`) and CI builds both platforms and publishes a Release. Every push also runs the cross-platform pipeline tests first.

## Notes

- Supported item types: multiple choice, multiple response, fill-in-the-blank, dropdown. Others appear with their metadata and a "not supported yet" note (see `Log.txt`).
- Re-processing an archive overwrites its previous output folder.
- The app is unsigned (see the first-launch note above).

Maintainer docs: [`docs/DEVELOPER.md`](docs/DEVELOPER.md) and [`docs/HANDOFF.md`](docs/HANDOFF.md).
