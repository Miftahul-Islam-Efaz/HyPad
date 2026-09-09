<p align="center">
  <img src="https://lh3.googleusercontent.com/d/1APcLB4JicVvrJsR4qg2g44qUUBoOKZ4S" alt="HyPad" width="100%" />
</p>

<h1 align="center">HyPad</h1>

<p align="center">
  A fast, floating scratchpad for Windows — built to replace the default Notepad, which feels boring in a modern world.
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%2010%2F11-0a7bbb" />
  <img alt="Size" src="https://img.shields.io/badge/download-~1.5%20MB-2ea44f" />
  <img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blueviolet" />
</p>

---

## About

HyPad combines the always-available feel of a floating scratchpad with the practical editing power of Windows Notepad. It stays on top while you work, opens instantly, and keeps every note in tabs so nothing gets lost — all in a package small enough to download in a second.

It uses the system WebView instead of bundling a browser runtime, so the whole app is about **2.9 MB installed** and idles at roughly **17 MB of RAM**.

## Features

- **Floating pad** — always-on-top window you can toggle off anytime
- **Tabs** — multiple notes with session restore; nothing is lost on close
- **Notes sidebar** — search, pin, rename, and delete notes
- **Markdown** — formatting toolbar, live preview, and smart list continuation
- **Find & replace** — match case, wrap around, and result counts
- **Version history** — automatic local snapshots you can restore
- **8 color palettes** — Latte, Paper, Dawn, Midnight, Forest, Arctic, Mocha, Dragon
- **Smooth motion** — staggered entrance animations that respect Windows reduce-motion
- **Files** — open and save `.md`, `.txt`, and plain text, plus drag-and-drop
- **Zoom, word count, and live cursor position** in the status bar

## Install

1. Download **[HyPad-win_x64.zip](download/HyPad-win_x64.zip?raw=1)** (1.3 MB) from the `download` folder, or from [Releases](../../releases).
2. Extract the folder anywhere.
3. Run `HyPad-win_x64.exe`, keeping `resources.neu` in the same folder.

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
| Markdown preview | `Ctrl` + `P` |
| Version history | `Ctrl` + `H` |
| Toggle sidebar | `Ctrl` + `B` |
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
