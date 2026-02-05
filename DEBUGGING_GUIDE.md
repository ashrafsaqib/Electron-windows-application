# Debugging Guide - Stats and Logs Not Updating

## Issue Summary
When monitoring is running and emails are processed, the stats on the Home page and logs in the Settings Logs tab are not updating in real-time.

## Root Cause Analysis

### Potential Issues:

1. **IPC Event Listener Callback Signature**
   - The `ipcRenderer.on()` callback receives (event, data) parameters
   - The event handler is correctly structured in preload.js
   - However, there might be timing issues with listener registration

2. **Timing of Listener Registration**
   - The listeners are registered in `useEffect` with empty dependency array `[]`
   - This is correct and should only run once on mount
   - But if the component mounts AFTER monitoring starts, events will be missed

3. **Initial Monitoring Check**
   - The Home page checks monitoring status on mount
   - If monitoring started before the page was visited, the status might not sync

## What We've Added for Debugging

### Console Logging
Added extensive console logging to track event flow:

**In Home.js:**
- `[Home] Monitoring started event:` - When monitoring starts
- `[Home] Monitoring event received:` - Each monitoring event
- `[Home] PDF generated, updating stats` - PDF generation events
- `[Home] Error event, updating stats` - Error events
- `[Home] Info event, updating stats` - Info events
- `[Home] Monitoring stopped event:` - When monitoring stops
- `[Home] electronAPI not available` - API connection issues

**In Settings.js:**
- `[Settings] Monitoring log received:` - Each log entry from monitoring
- `[Settings] onMonitoringLog not available` - API connection issues

### Expected Console Output

When you start monitoring, you should see:
```
[Home] Monitoring started event: {timestamp, checkInterval, emailCount}
[Monitoring] ✅ Started with interval: 60s, checking 1 email(s)
[Settings] Monitoring log received: {message, type, timestamp}
```

When emails are found:
```
[Monitoring] 🔍 Checking for emails (checking latest 1 email(s))
[Monitoring] 📧 Found X email(s) to process
[Settings] Monitoring log received: ...
```

When XLSX is processed:
```
[Monitoring] 📋 Parsing XLSX: filename.xlsx
[Monitoring] ✓ Successfully parsed filename.xlsx
[Monitoring] 📄 Generating PDF
[Monitoring] ✅ Successfully generated PDF: filename.pdf
[Home] Monitoring event received: {type: 'success', ...}
[Home] PDF generated, updating stats
```

## How to Test

### Step 1: Check DevTools Console
1. Start the app: `npm run electron-start`
2. Press F12 to open DevTools
3. Go to the Console tab
4. Clear existing logs (click the trash icon)
5. Navigate to Home page
6. Go to Settings → ⚙️ Polling Monitor
7. Start monitoring
8. Watch the console for the logs listed above

### Step 2: Check Stats Update
1. On Home page, note the initial stats (all should be 0)
2. Start monitoring
3. Wait for an email check cycle
4. Stats should update:
   - "Emails Checked" should increase
   - "Last Check" should show the current time
   - "PDFs Generated" should increase if XLSX found

### Step 3: Check Logs Tab
1. Go to Settings → 📋 Logs tab
2. Clear logs if any
3. Start monitoring
4. Logs should appear with timestamps showing:
   - Each email check
   - Each XLSX file parsed
   - Each PDF generated
   - Any errors encountered

## If Stats/Logs Are NOT Updating

### Possible Solutions:

#### 1. Restart the App
- The most common fix - close Electron completely and restart
- This ensures fresh listener registration

#### 2. Check if Monitoring is Actually Running
- Terminal should show `[Monitoring]` log entries
- Look for "Started with interval" message
- Verify email check is happening (timestamps should change every X seconds)

#### 3. Check Console for Errors
- Look for "electronAPI not available" warnings
- Check if there are any IPC errors
- Verify `window.electronAPI` exists by typing in console:
  ```javascript
  console.log(window.electronAPI);
  ```

#### 4. Manual IPC Test
In the console, test IPC manually:
```javascript
// Test monitoring started listener
window.electronAPI.onMonitoringStarted((event, data) => {
  console.log('TEST: Received monitoring started:', data);
});

// Test monitoring events
window.electronAPI.onMonitoringEvent((event, data) => {
  console.log('TEST: Received monitoring event:', data);
});

// Test monitoring logs
window.electronAPI.onMonitoringLog((event, data) => {
  console.log('TEST: Received monitoring log:', data);
});
```

#### 5. Check IMAP Connection
If monitoring is running but no events are received:
- Go to Settings → 📨 IMAP tab
- Click "Test IMAP Connection"
- Verify IMAP credentials are correct
- Check logs for "Fetch error"

## Files Involved

- `src/components/Home.js` - Dashboard with stats (lines 15-100)
- `src/components/Settings.js` - Logs tab and monitoring log listener (lines 70-85)
- `public/electron.js` - Event emission (lines 364-375, monitoring cycle)
- `public/preload.js` - IPC bridges (lines 26-43)

## Quick Checklist

- [ ] Monitoring is actually running (check terminal logs)
- [ ] Console shows event logs (check DevTools)
- [ ] IMAP connection is working
- [ ] App was restarted after code changes
- [ ] You're on the Home page or Settings page when monitoring runs
- [ ] Stats are showing for at least one email check
- [ ] Logs tab shows at least one entry

## Next Steps if Still Not Working

1. Check the Electron main process logs in terminal
2. Verify `mainWindow.webContents` is available when sending events
3. Ensure preload.js listeners are registered before events fire
4. Check browser console for any IPC-related errors
