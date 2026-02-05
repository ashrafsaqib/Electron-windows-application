# Electron + React Email App - Development Guide

## Quick Start

### Run Electron-Only Development (Recommended)
This runs ONLY the Electron app with hot-reload support (no browser window):

```bash
npm start
```

This is equivalent to:
```bash
npm run dev-electron-only
```

### Alternative: Run with Browser Preview
If you want to see both the browser and Electron preview:

```bash
npm run dev
```

## What Changed

### npm Scripts
- **`npm start`** → Runs Electron-only development (NEW DEFAULT)
- **`npm run dev-electron-only`** → Explicit Electron-only with hot-reload
- **`npm run dev`** → Original browser + Electron preview (if needed)
- **`npm run electron-only`** → Just Electron without React dev server
- **`npm run react-start`** → Just React dev server without Electron

### Hot-Reload Features
✅ **React component changes** → Electron app reloads automatically  
✅ **Electron main process changes** → App restarts automatically  
✅ **CSS/Style changes** → Instantly reflected in Electron window  
✅ **IPC handler changes** → Reloads without full restart  

### Key Dependencies Added
- `electron-reloader` (^1.2.1) - Enables hot-reload in development

## How It Works

1. **React Dev Server** starts on `http://localhost:3000`
2. **Electron Main Process** loads from localhost and watches for changes
3. **electron-reloader** monitors file changes and auto-reloads:
   - Changes to `.js`, `.jsx`, `.css` files
   - Changes to `public/electron.js` (main process)
   - Changes to `public/emailService.js` (IPC handlers)

## Development Workflow

### For UI/Component Changes
1. Make changes to files in `src/` directory
2. Save the file
3. Electron window automatically reloads (you'll see a brief flicker)
4. Changes appear instantly

### For Electron Main Process Changes
1. Edit `public/electron.js` or `public/emailService.js`
2. Save the file
3. electron-reloader detects the change
4. Electron app restarts automatically

### For Email/IMAP/SMTP Changes
1. Edit `public/emailService.js`
2. Save the file
3. App restarts, test your IMAP/SMTP features
4. Console logs appear in Electron dev tools

## Dev Tools & Debugging

The Electron window automatically opens with DevTools in the right panel:

- **Console tab** → See IPC logs, email service debug messages (`[IMAP]` logs)
- **Network tab** → Monitor `localhost:3000` requests
- **Application tab** → View localStorage settings
- **Sources tab** → Debug JavaScript with breakpoints

## Production Build

```bash
npm run react-build
npm run build:nsis
```

This creates a standalone installer with no hot-reload (production only).

## Testing Email Features

1. Go to Settings ⚙️
2. Configure SMTP (for sending):
   - Host: `smtp.outlook.com` or `smtp.gmail.com`
   - Port: `587` or `465`
   - Credentials: your email/password
3. Configure IMAP (for receiving):
   - Host: `imap.outlook.com` or `imap.gmail.com`
   - Port: `993`
   - Credentials: same as SMTP
4. Test buttons:
   - ✅ Test SMTP Connection - sends a test email
   - ✅ Test IMAP Connection - checks inbox access
   - ✅ Fetch Inbox Emails - retrieves 2 most recent emails

Watch the console (`[IMAP]` logs) for detailed debugging.

## Environment

- **NODE_ENV**: `development` (automatically set)
- **Electron Port**: Uses `http://localhost:3000`
- **Main Process Entry**: `public/electron.js`
- **Preload Script**: `public/preload.js`

## Troubleshooting

### App not reloading after changes?
1. Check if electron-reloader is running (check for warnings in console)
2. Try restarting: `npm start`
3. Check that files are being saved correctly

### Hot-reload stopped working?
- Restart the dev server with `npm start`
- Kill any orphaned node/electron processes: `taskkill /F /IM node.exe`

### IMAP/Email features not working?
1. Check Electron DevTools console for `[IMAP]` debug logs
2. Verify credentials in Settings page
3. Check internet connection
4. Outlook/Gmail may require app-specific passwords

---

**Happy coding!** 🚀

The Electron development environment now works just like React web development with instant hot-reload!
