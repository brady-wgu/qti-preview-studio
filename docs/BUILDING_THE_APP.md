# Building the Actual App (Step by Step)

This walks through turning the source code into a real, double-clickable
application on Mac or Windows. You only need to do this once per machine
you want to build on (or once per release, if you change the code later).

You do **not** need to be a developer to follow this -- just comfortable
copy-pasting commands into a terminal window.

---

## On macOS

### 1. Get the project onto disk
Unzip the source zip somewhere convenient, e.g. your Desktop. You should end
up with a folder called `qti-preview-studio` containing `package.json`,
`src/`, `lib/`, etc.

### 2. Make sure you have Node.js installed
Open **Terminal** (Applications -> Utilities -> Terminal, or search for it
with Spotlight/Cmd+Space) and type:
```
node --version
```
You want v18 or newer. If you see "command not found", install Node first:
go to https://nodejs.org, download the macOS installer, run it, then open a
**new** Terminal window and check `node --version` again.

### 3. Navigate into the project folder
```
cd ~/Desktop/qti-preview-studio
```
(adjust the path if you unzipped it somewhere else -- if you're not sure of
the exact path, type `cd ` with a trailing space, then drag the
`qti-preview-studio` folder from Finder directly into the Terminal window;
it will auto-fill the correct path, then press Enter)

### 4. Install dependencies
```
npm install
```
This requires internet access -- it downloads Electron, electron-builder,
and the project's couple of small libraries. Takes a minute or two the
first time.

### 5. Build the Mac app
```
npm run dist:mac
```
This takes a bit longer (Electron's runtime is sizable). When it finishes,
look inside the new `release/` folder inside the project -- you'll find
`QTI Preview Studio-1.0.0.dmg` and a `.zip` version. The `.dmg` is what you
double-click to install it (drag to Applications), like any other Mac app.

### 6. First launch: bypassing the "unidentified developer" warning
Since this app isn't code-signed with a paid Apple Developer certificate,
macOS Gatekeeper will block it the first time with an "unidentified
developer" warning. To open it anyway: **right-click the app -> Open ->
confirm in the dialog that appears.** You only need to do this once; after
that it opens normally.

---

## On Windows

### 1. Get the project onto disk
Unzip the source zip somewhere convenient, e.g. your Desktop. You should end
up with a folder called `qti-preview-studio` containing `package.json`,
`src\`, `lib\`, etc.

### 2. Make sure you have Node.js installed
Open **PowerShell** or **Command Prompt** (search "PowerShell" in the Start
menu) and type:
```
node --version
```
You want v18 or newer. If you see it's not recognized, install Node first:
go to https://nodejs.org, download the Windows installer, run it (accept
the defaults), then open a **new** PowerShell/Command Prompt window and
check `node --version` again.

### 3. Navigate into the project folder
```
cd Desktop\qti-preview-studio
```
(adjust the path if you unzipped it somewhere else -- you can also type
`cd ` with a trailing space and drag the folder from File Explorer into the
window to auto-fill the path)

### 4. Install dependencies
```
npm install
```
Requires internet access, same as above.

### 5. Build the Windows app
```
npm run dist:win
```
When it finishes, look inside the new `release\` folder -- you'll find an
installer (something like `QTI Preview Studio Setup 1.0.0.exe`) and a
portable `.exe` that runs without installing.

### 6. First launch: bypassing the "Windows protected your PC" warning
Since this app isn't signed with a paid code-signing certificate, Windows
SmartScreen will likely show a blue "Windows protected your PC" screen the
first time you run the installer or the app. Click **More info**, then
**Run anyway**. You only need to do this once per machine.

---

## Troubleshooting

- **`npm install` fails with permission errors (Mac):** try closing and
  reopening Terminal, or run the command again -- transient npm registry
  hiccups are common and usually resolve on retry.
- **Any command fails with an actual error message:** copy the full error
  text and share it with whoever maintains this project (or paste it back
  to Claude) -- it's much easier to diagnose with the exact message than a
  description of "it didn't work."
- **Building on Windows but need a Mac build (or vice versa):** you
  generally need to build each platform's binary on that same platform (or
  via a CI service that provides both). `npm run dist:mac` on a Windows
  machine, or `npm run dist:win` on a Mac, is not guaranteed to work.
