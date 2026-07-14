# QTI Preview Studio

Turn a **QTI item-bank archive** (`.zip`, v1.2 or v2.1) into clean, offline HTML
previews you can open in any browser — **without importing the items into your
assessment platform first**.

It produces two views of every item bank:

- **Item Preview** — one item at a time, like taking the test (with Previous / Next).
- **Print Preview** — every item stacked on one scrollable page, great for a quick
  scan or for printing an answer key.

Correct answers are highlighted; math is typeset properly (with a toggle to see the
raw LaTeX); referenced images are included. Everything works **100% offline** — the
app never sends your data anywhere, and the generated output folder can be emailed,
dropped on a shared drive, or opened straight from your desktop.

---

## Just want to use it? (no technical setup)

### 1. Download

Go to the [**Releases**](https://github.com/brady-wgu/qti-preview-studio/releases/latest)
page and download **one** of these:

| File | What it is |
|------|-----------|
| `QTI Preview Studio <version>.exe` | **Portable** — just double-click to run. No installation. *(easiest)* |
| `QTI Preview Studio Setup <version>.exe` | **Installer** — installs the app and adds a Start-menu shortcut. |

> **First-launch warning is normal.** The app isn't signed with a paid certificate,
> so Windows SmartScreen will show a blue **"Windows protected your PC"** screen the
> first time. Click **More info → Run anyway**. You only do this once per machine.

### 2. Use it

1. **Select QTI Files…** — pick one or more `.zip` archives (you can select several;
   each gets its own output folder).
2. **Choose Output Location…** — pick the folder where the output should be created.
3. **Options** — choose how items are sorted by their identifier:
   - **Natural** — treats numbers as numbers, so `item2` comes before `item10`.
   - **String** — strict character-by-character sort.
4. **Process Files** — click it. When each archive finishes you'll see the item count
   and four buttons:

   | Button | What it does |
   |--------|--------------|
   | **Item Preview** | Opens the one-item-at-a-time slideshow in your browser. |
   | **Print Preview** | Opens the all-items-stacked page in your browser. |
   | **Log** | Opens `Log.txt` — a plain-text summary of what converted and any warnings. |
   | **Reveal Folder** | Opens the output folder in File Explorer. |

### 3. Read the output

- Above each item: its **Item ID**, **Label**, **Code**, and whether **Shuffle** is on.
- **Correct answers** are marked with a green highlight and a **✓ Correct** badge. For
  fill-in-the-blank and dropdown items, accepted answers appear in a green **Answer Key**
  box below the item.
- Top-right of both previews is a button to switch between **rendered math** (typeset,
  matching your assessment platform) and **raw LaTeX markup**.

The full end-user guide is in [`docs/QUICKSTART.md`](docs/QUICKSTART.md).

---

## Building it yourself (from source)

You only need this if you want to build the app rather than download it.

**Prerequisites:** [Node.js](https://nodejs.org) 18 or newer (`node --version` to check).

```sh
npm install            # one time — downloads Electron + build tools
npm run dist:win       # build the Windows installer + portable .exe
# or:
npm run dist:mac       # build the macOS .dmg + .zip (must run on a Mac)
```

Output lands in the `release/` folder. Full step-by-step (including screenshots-level
detail for non-developers) is in [`docs/BUILDING_THE_APP.md`](docs/BUILDING_THE_APP.md).

> **Windows, no admin rights?** `npm run dist:win` may fail extracting the
> `winCodeSign` package (it contains macOS symlinks Windows won't create without admin
> or Developer Mode). Those files aren't needed for a Windows build — pre-extract the
> archive into electron-builder's cache, skipping the two symlink entries, then rebuild.
> The GitHub Actions build (below) runs as admin and never hits this.

---

## Getting fresh builds without a local setup (GitHub Actions)

This repo has a CI workflow (`.github/workflows/build.yml`) that builds **both Windows
and macOS** on GitHub's servers — no local toolchain needed.

- **Push a version tag** (e.g. `git tag v1.0.2 && git push origin v1.0.2`) → it builds
  both platforms and publishes them to a **GitHub Release** (a plain download link,
  no account required).
- Or use **Actions → "Build desktop apps" → Run workflow** to build on demand; the
  binaries appear as downloadable workflow artifacts.

---

## Notes & limitations

- Works entirely offline; no data leaves your machine.
- Re-processing the same archive overwrites its previous output folder.
- Supported item types (this version): multiple choice, multiple response,
  fill-in-the-blank, and dropdown. Any other type still appears with its metadata and a
  note that it isn't supported yet — check `Log.txt` for the list.
- The app is **unsigned** (see the first-launch note above).

## For maintainers

Architecture, the item data model, and how the parser/renderer fit together are
documented in [`docs/DEVELOPER.md`](docs/DEVELOPER.md). Windows build/handoff specifics
are in [`docs/HANDOFF.md`](docs/HANDOFF.md).
