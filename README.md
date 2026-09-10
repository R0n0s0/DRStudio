# Dr Studio (Desktop Edition)

A standalone, offline font design studio — no account, no server, no internet
connection required. Everything (your fonts, layers, and projects) is saved
locally on your own computer.

This version has been detached from Base44: the login/cloud-backend code has
been removed, and the app now runs and saves entirely in your browser's local
storage / as local files.

## Requirements

Install these once, if you don't already have them:

- [Node.js](https://nodejs.org/) (version 18 or newer) — this also installs `npm`.

## 1. Install dependencies

Open a terminal (PowerShell or Command Prompt) inside this folder and run:

```bash
npm install
```

## 2. Try it out (optional, runs in a normal window without building an installer)

```bash
npm run electron:pack
```

This builds the app and creates a runnable, unpacked version in the
`release` folder — look for `release/win-unpacked/Dr Studio.exe` and double
click it to try it.

## 3. Build the installer (.exe)

```bash
npm run dist
```

This will:
1. Build the web app (`vite build`).
2. Package it with Electron.
3. Produce a Windows installer at `release/Dr Studio Setup <version>.exe`.

Double-click that `.exe` to install Dr Studio like any other Windows
application (Start Menu shortcut + Desktop shortcut included).

## Notes

- The app icon is a placeholder (purple gradient "Dr" monogram) at
  `build/icon.png` / `build/icon.ico`. Replace those two files with your own
  artwork (same filenames) before running `npm run dist` if you want a custom
  icon, then rebuild.
- Everything the app saves (fonts, projects) is stored locally on your
  machine — there is no cloud sync anymore.
- If Windows SmartScreen warns about an "unrecognized app" the first time you
  run the installer, that's expected for apps that aren't code-signed by a
  paid certificate — click "More info" → "Run anyway".
