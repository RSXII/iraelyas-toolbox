# Iraelya's 5e Toolbox

A Dungeon Master's dashboard for 5e campaigns. Built with Electron + Vite + TypeScript.

## Tools

- **Favor Tracker** — NPC relationship scores per player, campaign-scoped
- **Conversation Tracker** — live mood sliders for social encounters (1–6 PCs)
- **Family Tree** — genealogy/succession viewer with pan & zoom
- **Chronicle** — scrollable historical timeline

## For Users

Download the latest release from the [Releases page](https://github.com/RSXII/iraelyas-toolbox/releases):

- **Mac**: Download the `.dmg`, open it, drag the app to Applications
- **Windows**: Download the `.exe` installer and run it

On first launch you'll see a setup screen to either restore from a backup or import your existing data files.

## For Developers

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- npm (comes with Node)

### Setup

```bash
git clone https://github.com/RSXII/iraelyas-toolbox.git
cd iraelyas-toolbox
npm install
```

### Development

```bash
npm run dev
```

This starts Vite's dev server and opens Electron with hot reload. Changes to TypeScript and CSS reflect immediately.

### Type checking

```bash
npm run typecheck
```

### Building installers

```bash
# Mac only
npm run dist:mac

# Windows only (or from Mac via cross-compile)
npm run dist:win

# Both
npm run dist:all
```

Output goes to `dist/installers/`.

### Releases

Push a version tag to trigger the GitHub Actions CI build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow builds Mac (`.dmg`) and Windows (`.exe`) installers and attaches them to a GitHub Release automatically.

## Data

App data is stored at:
- **Mac**: `~/Library/Application Support/iraelyas-toolbox/toolbox-data.json`
- **Windows**: `%APPDATA%\iraelyas-toolbox\toolbox-data.json`

Use **Export Backup** in the app to save a portable copy. Use **Import Backup** to restore.

## App Icon

The placeholder icon is at `assets/icon.svg`. To ship proper icons:

1. Replace `assets/icon.svg` with your design
2. Generate `assets/icon.icns` (Mac) using `iconutil` or an online converter
3. Generate `assets/icon.ico` (Windows) using an online converter
4. electron-builder will pick them up automatically

## License

MIT
