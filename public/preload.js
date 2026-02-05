const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  testSmtpConnection: (smtpSettings, recipientEmail) => {
    return ipcRenderer.invoke('test-smtp-connection', smtpSettings, recipientEmail);
  },
  testImapConnection: (imapSettings) => {
    return ipcRenderer.invoke('test-imap-connection', imapSettings);
  },
  fetchInboxEmails: (imapSettings) => {
    return ipcRenderer.invoke('fetch-inbox-emails', imapSettings);
  },
  saveXlsxAttachment: (filename, content) => {
    return ipcRenderer.invoke('save-xlsx-attachment', { filename, content });
  },
  parseXlsxAttachment: (filename, content) => {
    return ipcRenderer.invoke('parse-xlsx-attachment', { filename, content });
  },
  generatePdfFromXlsx: (xlsxFilename, firstCellValue) => {
    return ipcRenderer.invoke('generate-pdf-from-xlsx', { xlsxFilename, firstCellValue });
  },
  
  // Monitoring/Polling APIs
  startMonitoring: (imapSettings, pollingSettings) => {
    return ipcRenderer.invoke('start-monitoring', imapSettings, pollingSettings);
  },
  stopMonitoring: () => {
    return ipcRenderer.invoke('stop-monitoring');
  },
  getMonitoringStatus: () => {
    return ipcRenderer.invoke('get-monitoring-status');
  },
  getTodayStats: () => {
    return ipcRenderer.invoke('get-today-stats');
  },
  getTodayActivities: () => {
    return ipcRenderer.invoke('get-today-activities');
  },
  onMonitoringStarted: (callback) => {
    ipcRenderer.on('monitoring-started', callback);
  },
  onMonitoringEvent: (callback) => {
    ipcRenderer.on('monitoring-event', callback);
  },
  onMonitoringLog: (callback) => {
    ipcRenderer.on('monitoring-log', callback);
  },
  onMonitoringStopped: (callback) => {
    ipcRenderer.on('monitoring-stopped', callback);
  },
  removeMonitoringListener: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: require('electron').ipcRenderer
});
