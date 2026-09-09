<p align="center">
  <img src="https://lh3.googleusercontent.com/d/1APcLB4JicVvrJsR4qg2g44qUUBoOKZ4S" alt="HyPad" width="100%" />
</p>

<h1 align="center">HyPad</h1>

<p align="center">
  A fast, floating scratchpad for Windows — built to replace the default Notepad, which feels boring in a modern world.
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11-0a7bbb" />
  <img alt="Size" src="https://img.shields.io/badge/installer-3.1%20MB-2ea44f" />
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blueviolet" />
</p>

---

## About

HyPad combines the always-available feel of a floating scratchpad with the practical editing power of Windows Notepad. It stays on top while you work, opens instantly, and keeps every note in tabs so nothing gets lost — all in a package small enough to download in a second.

It uses the system WebView instead of bundling a browser runtime, so the whole app is about **2.7 MB installed** and idles at roughly **17 MB of RAM**.

## Features

- **Floating pad** — always-on-top window you can toggle off anytime
- **Tabs** — multiple notes with session restore; nothing is lost on close
- **Notes sidebar** — search, pin, rename, and delete notes
- **Live rich text** — headings, bold, italic, strikethrough, lists, quotes, and code apply to the selected text like a word processor
- **Find & replace** — match case, wrap around, and result counts
- **Version history** — automatic local snapshots you can restore
- **8 color palettes** — Latte, Paper, Dawn, Midnight, Forest, Arctic, Mocha, Dragon
- **Smooth motion** — staggered entrance animations that respect Windows reduce-motion
- **Link previews** — paste a video or image link to get an inline preview you can resize by its corner and drag anywhere in the text
- **Files** — save as `.txt` (default), `.md`, `.html`, `.json`, `.csv`, `.log`, or `.ini`
- **Zoom, word count, and live cursor position** in the status bar

## Install

1. Download **[HyPad-Setup.exe](https://github.com/Miftahul-Islam-Efaz/HyPad/releases/latest/download/HyPad-Setup.exe)** (3.1 MB) from the [latest release](../../releases/latest).
2. Double-click it and follow the setup wizard.

A standard Windows setup wizard opens, with a license page, an install-location
page and options for a desktop shortcut and file associations. Setup registers
HyPad the way any Windows app does: it installs to `%LOCALAPPDATA%\Programs\HyPad`, adds a **Start menu
shortcut** so HyPad appears in the Windows app list and in search, lists itself
under **Settings → Apps → Installed apps** with a working uninstaller, and adds
HyPad to the **Open with** menu for text files. No admin rights are required.

### Uninstall

**Settings → Apps → Installed apps → HyPad → Uninstall**, like any other app.
Your notes are kept.

### Portable version

Prefer not to install anything? Download
**[HyPad-win_x64.zip](https://github.com/Miftahul-Islam-Efaz/HyPad/releases/latest/download/HyPad-win_x64.zip)**,
extract it, and run `HyPad-win_x64.exe` with `resources.neu` beside it. Nothing
is written to the registry, but HyPad will not appear in the Windows app list.

### A note on the SmartScreen warning

This build is not code signed, so Windows may show "Windows protected your PC"
the first time. Choose **More info → Run anyway**. You can verify the download is
genuine by comparing its hash with the SHA-256 published in the release notes:

```powershell
Get-FileHash HyPad-Setup.exe -Algorithm SHA256
```

> Requires the Microsoft WebView2 Runtime, which is preinstalled on Windows 11 and most Windows 10 systems.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| New note | `Ctrl` + `N` |
| Close note | `Ctrl` + `W` |
| Switch notes | `Ctrl` + `Tab` |
| Rename note | `F2` |
| Save / Save as | `Ctrl` + `S` / `Ctrl` + `Shift` + `S` |
| Open file | `Ctrl` + `O` |
| Find & replace | `Ctrl` + `F` |
| Markdown source | `Ctrl` + `P` |
| Version history | `Ctrl` + `H` |
| Bold / italic | `Ctrl` + `B` / `Ctrl` + `I` |
| Toggle sidebar | `Ctrl` + `\` |
| Save a snapshot | `Ctrl` + `D` |
| Cycle theme | `Ctrl` + `Shift` + `L` |
| Zoom in / out / reset | `Ctrl` + `+` / `-` / `0` |

## Build from source

```bash
npm install -g @neutralinojs/neu
neu build --release
```

The bundle is written to `dist/HyPad/`.

## Tech

Built on [Neutralino.js](https://neutralino.js.org) with vanilla HTML, CSS, and JavaScript — no framework, no bundled browser. Typography uses Monilora and Tanker.

## Credits

Developed by **Miftahul Islam Efaz**.

Built to replace the default Windows notepad app, which feels boring in this modern world.
