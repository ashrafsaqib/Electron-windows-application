# Electron React App

A desktop application built with **Electron** and **React**.

## Features

- ⚡ Fast development with React Hot Reload
- 🖥️ Cross-platform desktop app with Electron
- 📦 Easy packaging and distribution with Electron Builder
- 🛠️ Modern development workflow

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

### Development

Start the development server with hot reload:
```bash
npm start
```

This will open both the React development server and the Electron app.

### Build

Build for production:
```bash
npm run build
```

Build the Electron app:
```bash
npm run electron-build
```

## Project Structure

```
├── public/
│   ├── electron.js          # Main Electron process
│   ├── preload.js           # Preload script for security
│   └── index.html           # HTML template
├── src/
│   ├── App.js               # Main React component
│   ├── App.css              # App styles
│   ├── index.js             # React entry point
│   └── index.css            # Global styles
├── package.json             # Project dependencies
└── README.md                # This file
```

## Building & Distribution

### Development Build
```bash
npm start
```

### Production Build (Packaged App)
```bash
npm run electron-build
```
Creates a standalone executable in `dist/Electron React App-win32-x64/`

### Create Distributable Package (ZIP)
```bash
npm run package
```
Creates `dist/Electron-React-App-win32-x64.zip` - users can extract and run directly.

### Create NSIS Installer
```bash
npm run build:nsis
```
Creates an installer executable. Requires NSIS to be installed on your system.

**To Install NSIS:**
1. Download from: https://nsis.sourceforge.io/
2. Run the installer (default path: `C:\Program Files (x86)\NSIS\`)
3. Then run `npm run build:nsis`

## Distribution Options

### Option 1: ZIP File (Recommended for Testing)
- **File**: `dist/Electron-React-App-win32-x64.zip`
- **Size**: ~144 MB
- **Installation**: Users extract and run `Electron React App.exe`
- **Pros**: No installation required, easy to test
- **Cons**: Larger file size

### Option 2: NSIS Installer (Professional)
- **File**: `dist/Electron-React-App-Setup.exe`
- **Size**: ~60 MB (compressed)
- **Installation**: Standard Windows installer with Start Menu shortcuts
- **Pros**: Professional look, creates desktop shortcut, adds to Add/Remove Programs
- **Cons**: Requires NSIS installation

## Technologies

- **Electron** - Framework for building desktop apps
- **React** - UI library
- **Node.js** - JavaScript runtime
- **electron-packager** - Package Electron apps
- **archiver** - Create ZIP packages
- **NSIS** - Create Windows installers

## License

MIT
