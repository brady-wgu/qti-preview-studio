# Handoff notes (Windows build)

These notes cover the Windows build of **QTI Preview Studio** that was produced
and validated for handoff, plus a couple of things worth knowing.

## What you get

Two ready-to-run Windows files (both x64, unsigned):

| File | What it is | Best for |
|------|------------|----------|
| `QTI Preview Studio 1.0.0.exe` | **Portable** — runs straight from where it sits, no install | Sending to colleagues who just want to double-click and go |
| `QTI Preview Studio Setup 1.0.0.exe` | **Installer** — installs to Program Files, adds a Start-menu shortcut, lets you pick the install folder | People who want it "installed" like a normal app |

Get them either from the project's **GitHub Releases** page (a plain download
link, no account needed) or directly from whoever built this for you.

## First launch: the SmartScreen warning

Because the app isn't signed with a paid code-signing certificate, Windows
SmartScreen will likely show a blue **"Windows protected your PC"** screen the
first time you run either file. This is expected for any unsigned app.

To proceed: click **More info**, then **Run anyway**. You only need to do this
once per machine.

## What it does (quick reminder)

Pick one or more QTI archives (`.zip`, v1.2 or v2.1), pick an output folder, and
it generates offline HTML previews — an **Item Preview** (one item at a time)
and a **Print Preview** (all items stacked, with a correct-answer key). Works
entirely offline; nothing is sent anywhere. See `docs/QUICKSTART.md` for the
full walkthrough.

## Validation performed

Built and validated on Windows 11 against a real QTI v1.2 export
(`2067-bank-ES-export-test.zip`, 100 items):

- 100 / 100 items parsed, **0 errors**, version auto-detected as QTI v1.2.
- Correct answers highlighted with the green "✓ Correct" badge.
- Math typesets correctly via bundled KaTeX (offline).
- All referenced images resolve and display.
- App launches cleanly; bundled resources (`lib/`, `assets/katex/`, `adm-zip`)
  verified inside the packaged app.

## One code fix was made during validation — please note

The test bank referenced images with **unquoted** HTML attributes
(`<img src=Resources/x.png ...>`). The image-copy logic in
`lib/qti/process-archive.js` previously:

1. only matched double-quoted `src="..."`, so those images were never copied
   into the output (they showed as broken); and
2. copied images into a fixed `RESOURCES/` folder that didn't match the path
   the generated HTML actually referenced (would break on case-sensitive
   filesystems such as macOS).

Both were fixed: `src` matching is now quote-agnostic, and each image is copied
to the exact path the HTML references. This is worth folding into your source of
truth (and into the planned web-app rewrite), since real banks clearly use the
unquoted form.

## If you ever rebuild on another Windows laptop

On a locked-down Windows machine (no admin, Developer Mode off), `npm run
dist:win` can fail while extracting electron-builder's `winCodeSign` package —
it contains two macOS symlinks that Windows refuses to create without the
symlink privilege. Those symlinks are irrelevant to a Windows build. Workaround:
pre-extract the archive into the electron-builder cache, skipping the two
symlink entries, then rebuild. (The GitHub Actions runners are admin, so CI does
not hit this.)
