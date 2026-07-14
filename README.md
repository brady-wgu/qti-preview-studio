# QTI Preview Studio

Preview a QTI item bank (`.zip`, v1.2 or v2.1) as offline web pages, without importing it into your assessment platform first.

You get two views of every bank:

- **Item Preview:** one item at a time, like taking the test.
- **Print Preview:** every item on one scrollable page, good for scanning or printing an answer key.

Correct answers are highlighted, math is displayed properly (with a button to switch to the raw math markup), and images are included. Everything runs on your own computer; nothing is sent anywhere.

## Download and install (Windows)

1. Open the [**Releases page**](https://github.com/brady-wgu/qti-preview-studio/releases/latest).
2. Under **Assets**, click one of these to download it (the version number, such as `1.0.1`, is part of the file name):
   - The `.exe` **without** "Setup" in its name: the **portable** version. Nothing to install, just double-click it to run. **This is the easiest option.**
   - The `.exe` **with** "Setup" in its name: the **installer**. Installs the app and adds a Start-menu shortcut, like a normal program.
3. On a Mac, download the `.dmg` file instead, then drag the app to Applications.

> **A warning on first launch is normal and safe to allow.** Because this app isn't signed with a paid certificate, Windows shows a blue "Windows protected your PC" screen the first time. Click **More info**, then **Run anyway**. You only do this once per computer.

## How to use it

1. Click **Select QTI Files…** and choose one or more `.zip` archives. Each one becomes its own output folder.
2. Click **Choose Output Location…** and pick the folder where the results should go.
3. Under **Options**, pick how items are sorted: **Natural** (so `item2` comes before `item10`) or **String** (strict character-by-character).
4. Click **Process Files**. When it finishes, each bank shows four buttons:

| Button | What it does |
|--------|--------------|
| **Item Preview** | Opens the one-item-at-a-time view in your web browser. |
| **Print Preview** | Opens the all-items-on-one-page view in your web browser. |
| **Log** | Opens a plain-text summary of what was converted. |
| **Reveal Folder** | Opens the results folder on your computer. |

In either preview, correct answers have a green **✓ Correct** badge (fill-in and dropdown answers show in an Answer Key box), and the button in the top-right corner switches between properly displayed math and the raw math markup.

Need more detail? See the [full guide](docs/QUICKSTART.md).

## For developers (optional)

Most people can ignore this section and just download the app above. To rebuild it from source you need [Node.js](https://nodejs.org) 18 or newer:

```sh
npm install          # one time
npm run dist:win     # Windows installer + portable
npm run dist:mac     # macOS build (run on a Mac)
```

The finished files land in the `release/` folder. Full instructions are in [`docs/BUILDING_THE_APP.md`](docs/BUILDING_THE_APP.md), and maintainer notes are in [`docs/DEVELOPER.md`](docs/DEVELOPER.md) and [`docs/HANDOFF.md`](docs/HANDOFF.md).

You can also let GitHub build both versions for you: push a version tag (for example `git tag v1.0.2 && git push origin v1.0.2`) and the automated build publishes a new release. Cross-platform tests run first on every change.

## Good to know

- Supported item types: multiple choice, multiple response, fill-in-the-blank, and dropdown. Any other type still shows its basic details plus a "not supported yet" note (check the Log).
- Running the same bank again replaces its previous results folder.
- The app works entirely offline and never sends your data anywhere.
