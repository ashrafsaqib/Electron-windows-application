import React, { useState, useEffect } from 'react';
import '../styles/Settings.css';

function Settings() {
    // Helper to sync monitoring status from backend
    const syncMonitoringStatus = async () => {
      if (window.electronAPI && window.electronAPI.getMonitoringStatus) {
        try {
          const status = await window.electronAPI.getMonitoringStatus();
          setPollingSettings(prev => ({ ...prev, isMonitoring: !!status.isMonitoring }));
        } catch (err) {
          // fallback: assume not monitoring
          setPollingSettings(prev => ({ ...prev, isMonitoring: false }));
        }
      }
    };
  const [smtpSettings, setSmtpSettings] = useState({
    host: '',
    port: '587',
    secure: false,
    user: '',
    password: '',
    fromEmail: ''
  });

  const [imapSettings, setImapSettings] = useState({
    host: '',
    port: '993',
    user: '',
    password: '',
    tlsRequired: true
  });

  const [pollingSettings, setPollingSettings] = useState({
    checkInterval: 300,
    emailCount: 1,
    pdfFolder: '',
    isMonitoring: false
  });

  const [activeTab, setActiveTab] = useState('smtp');
  const [testEmail, setTestEmail] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logs, setLogs] = useState([]);
  const [xlsxAttachments, setXlsxAttachments] = useState([]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSmtpSettings = localStorage.getItem('smtpSettings');
    const savedImapSettings = localStorage.getItem('imapSettings');
    const savedPollingSettings = localStorage.getItem('pollingSettings');
    
    if (savedSmtpSettings) {
      setSmtpSettings(JSON.parse(savedSmtpSettings));
    }
    if (savedImapSettings) {
      setImapSettings(JSON.parse(savedImapSettings));
    }
    if (savedPollingSettings) {
      setPollingSettings(JSON.parse(savedPollingSettings));
    }

    // Always sync monitoring status on mount
    syncMonitoringStatus();

    // Intercept console.log to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (message, type = 'log') => {
      const timestamp = new Date().toLocaleTimeString();
      setLogs(prevLogs => [...prevLogs, { message, type, timestamp }]);
    };

    console.log = function(...args) {
      originalLog.apply(console, args);
      addLog(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), 'log');
    };

    console.error = function(...args) {
      originalError.apply(console, args);
      addLog(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), 'error');
    };

    console.warn = function(...args) {
      originalWarn.apply(console, args);
      addLog(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '), 'warn');
    };

    // Listen for monitoring logs from the main process
    if (window.electronAPI && window.electronAPI.onMonitoringLog) {
      window.electronAPI.onMonitoringLog((event, data) => {
        console.log('[Settings] Monitoring log received:', data);
        addLog(data.message, data.type);
      });
    } else {
      console.warn('[Settings] onMonitoringLog not available');
    }

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
      // Cleanup monitoring log listener
      if (window.electronAPI && window.electronAPI.removeMonitoringListener) {
        window.electronAPI.removeMonitoringListener('monitoring-log');
      }
    };
  }, []);

  // Sync monitoring status when switching to polling tab
  useEffect(() => {
    if (activeTab === 'polling') {
      syncMonitoringStatus();
    }
  }, [activeTab]);

  const handleSmtpInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSmtpSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSaved(false);
  };

  const handleImapInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setImapSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSaved(false);
  };

  const handleSaveSmtpSettings = () => {
    localStorage.setItem('smtpSettings', JSON.stringify(smtpSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSaveImapSettings = () => {
    localStorage.setItem('imapSettings', JSON.stringify(imapSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePollingInputChange = (fieldName, value) => {
    if (fieldName === 'checkInterval') {
      if (value < 30) {
        alert('Check interval must be at least 30 seconds.');
        value = 30;
      }
    }
    setPollingSettings(prev => ({
      ...prev,
      [fieldName]: value
    }));
  };

  const handleSavePollingSettings = () => {
    localStorage.setItem('pollingSettings', JSON.stringify(pollingSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleStartMonitoring = async () => {
    if (!window.electronAPI || !window.electronAPI.startMonitoring) {
      alert('❌ Monitoring API not available.');
      return;
    }

    try {
      const result = await window.electronAPI.startMonitoring(imapSettings, pollingSettings);
      if (result.success) {
        setPollingSettings(prev => ({ ...prev, isMonitoring: true }));
        alert('✅ Email monitoring started!');
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleStopMonitoring = async () => {
    if (!window.electronAPI || !window.electronAPI.stopMonitoring) {
      alert('❌ Monitoring API not available.');
      return;
    }

    try {
      const result = await window.electronAPI.stopMonitoring();
      if (result.success) {
        setPollingSettings(prev => ({ ...prev, isMonitoring: false }));
        alert('✅ Email monitoring stopped!');
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleTestSmtpConnection = async () => {
    if (!testEmail) {
      setTestMessage('Please enter a test email address');
      return;
    }

    setLoading(true);
    setTestMessage('');

    try {
      if (!window.electronAPI || !window.electronAPI.testSmtpConnection) {
        console.error('electronAPI not available:', {
          hasElectronAPI: !!window.electronAPI,
          hasTestSmtpConnection: window.electronAPI ? !!window.electronAPI.testSmtpConnection : false
        });
        setTestMessage('✗ Error: Electron API not available. Make sure you\'re running the Electron app (not in browser).');
        setLoading(false);
        return;
      }
      
      const result = await window.electronAPI.testSmtpConnection(
        smtpSettings,
        testEmail
      );
      
      if (result.success) {
        setTestMessage('✓ SMTP connection successful and email sent!');
      } else {
        setTestMessage(`✗ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('SMTP test error:', error);
      setTestMessage(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestImapConnection = async () => {
    setLoading(true);
    setTestMessage('');

    try {
      if (!window.electronAPI || !window.electronAPI.testImapConnection) {
        console.error('electronAPI.testImapConnection not available:', {
          hasElectronAPI: !!window.electronAPI,
          hasTestImapConnection: window.electronAPI ? !!window.electronAPI.testImapConnection : false
        });
        setTestMessage('✗ Error: Electron API not available. Make sure you\'re running the Electron app (not in browser).');
        setLoading(false);
        return;
      }
      
      const result = await window.electronAPI.testImapConnection(imapSettings);
      
      if (result.success) {
        setTestMessage(`✓ IMAP connection successful! Found ${result.mailboxes || 0} mailboxes.`);
      } else {
        setTestMessage(`✗ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('IMAP test error:', error);
      setTestMessage(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchInbox = async () => {
    setLoading(true);
    setTestMessage('Fetching latest email...');
    setXlsxAttachments([]);

    try {
      if (!window.electronAPI || !window.electronAPI.fetchInboxEmails) {
        setTestMessage('✗ Error: Electron API not available. Make sure you\'re running the Electron app.');
        setLoading(false);
        return;
      }
      
      const result = await window.electronAPI.fetchInboxEmails(imapSettings);
      
      if (result.success) {
        if (result.emailCount === 0) {
          setTestMessage('✓ Inbox fetched successfully, but no emails found.');
        } else {
          // Collect XLSX attachments
          const xlsxFiles = [];
          
          let emailsList = result.emails
            .map((email, idx) => {
              let emailInfo = `${idx + 1}. ${email.subject}\n   From: ${email.from}\n   Date: ${new Date(email.date).toLocaleString()}`;
              
              if (email.attachments && email.attachments.length > 0) {
                const attachmentsInfo = email.attachments
                  .map(att => {
                    if (att.isXlsx) {
                      xlsxFiles.push({
                        filename: att.filename,
                        content: att.content,
                        size: att.size
                      });
                    }
                    return `      • ${att.filename} (${att.size} bytes)${att.isXlsx ? ' [XLSX]' : ''}`;
                  })
                  .join('\n');
                emailInfo += `\n   Attachments:\n${attachmentsInfo}`;
              }
              
              return emailInfo;
            })
            .join('\n\n');
          
          setXlsxAttachments(xlsxFiles);
          setTestMessage(`✓ Successfully fetched ${result.emailCount} email(s):\n\n${emailsList}`);
        }
      } else {
        setTestMessage(`✗ Error: ${result.error}`);
      }
    } catch (error) {
      setTestMessage(`✗ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleDownloadXlsx = async (attachment) => {
    try {
      if (!window.electronAPI || !window.electronAPI.parseXlsxAttachment) {
        alert('❌ Parse feature not available. Make sure you\'re running the Electron app.');
        return;
      }

      // Parse the XLSX to get first cell
      const parseResult = await window.electronAPI.parseXlsxAttachment(
        attachment.filename,
        attachment.content
      );
      
      if (!parseResult.success) {
        alert(`⚠️ Parse Error: ${parseResult.error}`);
        return;
      }

      // Generate PDF from the Excel content
      if (!window.electronAPI.generatePdfFromXlsx) {
        alert('❌ PDF generation not available.');
        return;
      }

      const pdfResult = await window.electronAPI.generatePdfFromXlsx(
        attachment.filename,
        parseResult.firstCellValue
      );

      if (pdfResult.success) {
        alert(`✅ PDF Generated!\n📊 File: ${pdfResult.filename}\n📁 Saved to Downloads folder\n\n📝 Content: ${parseResult.firstCellValue}`);
      } else {
        alert(`❌ PDF Generation Error: ${pdfResult.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div className="settings-container">
      <h1>Settings</h1>

      <div className="tabs">
        <button
          className={`tab-button ${activeTab === 'smtp' ? 'active' : ''}`}
          onClick={() => setActiveTab('smtp')}
        >
          📧 SMTP (Send Emails)
        </button>
        <button
          className={`tab-button ${activeTab === 'imap' ? 'active' : ''}`}
          onClick={() => setActiveTab('imap')}
        >
          📨 IMAP (Inbox & Receive)
        </button>
        <button
          className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          📋 Logs
        </button>
        <button
          className={`tab-button ${activeTab === 'polling' ? 'active' : ''}`}
          onClick={() => setActiveTab('polling')}
        >
          ⚙️ Polling Monitor
        </button>
      </div>

      {/* Show info-section only in Polling Monitor tab */}
      {activeTab === 'polling' && (
        <div className="info-section" style={{ marginBottom: 24 }}>
          <h3>ℹ️ How to Use</h3>
          <ol>
            <li>Go to <strong>Settings</strong> → <strong>⚙️ Polling Monitor</strong></li>
            <li>Configure check interval, email count, and PDF save folder</li>
            <li>Click <strong>▶️ Start Monitoring</strong> to begin automated email checking</li>
            <li>Monitor will check for new emails at regular intervals</li>
            <li>XLSX attachments will be automatically parsed and converted to PDFs</li>
            <li>Check the dashboard to see recent activity and statistics</li>
            <li>Click <strong>⏹️ Stop Monitoring</strong> to disable automated checking</li>
          </ol>
        </div>
      )}

      {activeTab === 'smtp' && (
        <>
          <div className="settings-section">
            <h2>SMTP Account Configuration</h2>
            <p className="section-description">
              Configure SMTP settings to send emails from your account.
            </p>
            
            <div className="form-group">
              <label htmlFor="host">SMTP Host</label>
              <input
                type="text"
                id="host"
                name="host"
                value={smtpSettings.host}
                onChange={handleSmtpInputChange}
                placeholder="e.g., smtp.gmail.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="port">SMTP Port</label>
              <input
                type="number"
                id="port"
                name="port"
                value={smtpSettings.port}
                onChange={handleSmtpInputChange}
                placeholder="587 or 465"
              />
            </div>

            <div className="form-group checkbox">
              <label htmlFor="secure">
                <input
                  type="checkbox"
                  id="secure"
                  name="secure"
                  checked={smtpSettings.secure}
                  onChange={handleSmtpInputChange}
                />
                <span>Use TLS/SSL (port 465)</span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="user">SMTP Username/Email</label>
              <input
                type="text"
                id="user"
                name="user"
                value={smtpSettings.user}
                onChange={handleSmtpInputChange}
                placeholder="your-email@gmail.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">SMTP Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={smtpSettings.password}
                onChange={handleSmtpInputChange}
                placeholder="Password or App Password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="fromEmail">From Email Address</label>
              <input
                type="email"
                id="fromEmail"
                name="fromEmail"
                value={smtpSettings.fromEmail}
                onChange={handleSmtpInputChange}
                placeholder="sender@example.com"
              />
            </div>

            <button 
              className="btn btn-primary" 
              onClick={handleSaveSmtpSettings}
            >
              Save SMTP Settings
            </button>
            {saved && <span className="success-message">✓ SMTP settings saved!</span>}
          </div>

          <div className="settings-section">
            <h2>Test SMTP Connection</h2>
            <p className="section-description">
              Send a test email to verify your SMTP configuration is working correctly.
            </p>

            <div className="form-group">
              <label htmlFor="testEmail">Recipient Email Address</label>
              <input
                type="email"
                id="testEmail"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                disabled={loading}
              />
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={handleTestSmtpConnection}
              disabled={loading}
            >
              {loading ? 'Testing...' : 'Test SMTP Connection'}
            </button>

            {testMessage && (
              <div className={`test-message ${testMessage.includes('✓') ? 'success' : 'error'}`}>
                {testMessage}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'imap' && (
        <>
          <div className="settings-section">
            <h2>IMAP Account Configuration</h2>
            <p className="section-description">
              Configure IMAP settings to read and parse emails from your inbox.
            </p>
            
            <div className="form-group">
              <label htmlFor="imap-host">IMAP Host</label>
              <input
                type="text"
                id="imap-host"
                name="host"
                value={imapSettings.host}
                onChange={handleImapInputChange}
                placeholder="e.g., imap.gmail.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="imap-port">IMAP Port</label>
              <input
                type="number"
                id="imap-port"
                name="port"
                value={imapSettings.port}
                onChange={handleImapInputChange}
                placeholder="993 (SSL) or 143 (TLS)"
              />
            </div>

            <div className="form-group checkbox">
              <label htmlFor="tlsRequired">
                <input
                  type="checkbox"
                  id="tlsRequired"
                  name="tlsRequired"
                  checked={imapSettings.tlsRequired}
                  onChange={handleImapInputChange}
                />
                <span>Require TLS/SSL (port 993)</span>
              </label>
            </div>

            <div className="form-group">
              <label htmlFor="imap-user">IMAP Username/Email</label>
              <input
                type="text"
                id="imap-user"
                name="user"
                value={imapSettings.user}
                onChange={handleImapInputChange}
                placeholder="your-email@gmail.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="imap-password">IMAP Password</label>
              <input
                type="password"
                id="imap-password"
                name="password"
                value={imapSettings.password}
                onChange={handleImapInputChange}
                placeholder="Password or App Password"
              />
            </div>

            <button 
              className="btn btn-primary" 
              onClick={handleSaveImapSettings}
            >
              Save IMAP Settings
            </button>
            {saved && <span className="success-message">✓ IMAP settings saved!</span>}
          </div>

          <div className="settings-section">
            <h2>Test IMAP Connection & Fetch Emails</h2>
            <p className="section-description">
              Test your IMAP connection and fetch emails from your inbox.
            </p>

            <div className="button-group">
              <button 
                className="btn btn-secondary" 
                onClick={handleTestImapConnection}
                disabled={loading}
              >
                {loading ? 'Testing...' : 'Test IMAP Connection'}
              </button>

              <button 
                className="btn btn-secondary" 
                onClick={handleFetchInbox}
                disabled={loading}
              >
                {loading ? 'Fetching...' : 'Fetch Inbox Emails'}
              </button>
            </div>

            {testMessage && (
              <div className={`test-message ${testMessage.includes('✓') ? 'success' : 'error'}`}>
                {testMessage}
              </div>
            )}

            {xlsxAttachments.length > 0 && (
              <div className="xlsx-section">
                <h3>📊 XLSX Files Found</h3>
                <p className="section-description">
                  The latest email contains {xlsxAttachments.length} Excel file(s). Click to generate PDF:
                </p>
                <div className="xlsx-list">
                  {xlsxAttachments.map((attachment, idx) => (
                    <div key={idx} className="xlsx-item">
                      <span className="xlsx-name">{attachment.filename}</span>
                      <span className="xlsx-size">({(attachment.size / 1024).toFixed(2)} KB)</span>
                      <button
                        className="btn btn-success"
                        onClick={() => handleDownloadXlsx(attachment)}
                      >
                        📄 Generate PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <div className="settings-section">
          <h2>Application Logs</h2>
          <p className="section-description">
            Real-time logs from the application. Useful for debugging email operations.
          </p>

          <div className="logs-container">
            <div className="logs-header">
              <span className="logs-count">{logs.length} log entries</span>
              <button
                className="btn btn-danger"
                onClick={handleClearLogs}
              >
                Clear Logs
              </button>
            </div>

            <div className="logs-content">
              {logs.length === 0 ? (
                <div className="logs-empty">No logs yet. Perform an action to see logs here.</div>
              ) : (
                <div className="logs-list">
                  {logs.map((log, idx) => (
                    <div key={idx} className={`log-entry log-${log.type}`}>
                      <span className="log-timestamp">{log.timestamp}</span>
                      <span className="log-type">[{log.type.toUpperCase()}]</span>
                      <span className="log-message">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'polling' && (
        <div className="settings-section">
          <h2>⚙️ Automated Polling Monitor</h2>
          <p className="section-description">
            Set up automatic monitoring to fetch emails and generate PDFs at regular intervals.
          </p>

          <div className="polling-settings">
            {/* Status Indicator */}
            <div className="polling-status">
              <div className="status-indicator">
                <span className={`status-dot ${pollingSettings.isMonitoring ? 'active' : ''}`}></span>
                <span className="status-text">
                  Monitoring: <strong>{pollingSettings.isMonitoring ? '🟢 RUNNING' : '🔴 STOPPED'}</strong>
                </span>
              </div>
            </div>

            {/* Polling Configuration */}
            <div className="polling-form">
              <div className="form-group">
                <label>Check Interval (seconds)</label>
                <input
                  type="number"
                  min="30"
                  step="10"
                  value={pollingSettings.checkInterval}
                  onChange={(e) => handlePollingInputChange('checkInterval', parseInt(e.target.value) || 300)}
                  placeholder="e.g., 300"
                />
                <small>Minimum 30 seconds. Check every this many seconds for new emails.</small>
              </div>

              <div className="form-group">
                <label>Number of Latest Emails to Process</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={pollingSettings.emailCount}
                  onChange={(e) => handlePollingInputChange('emailCount', parseInt(e.target.value) || 1)}
                  placeholder="e.g., 5"
                />
                <small>Check how many of the latest emails for XLSX attachments (1-50).</small>
              </div>

              <div className="form-group">
                <label>Default PDF Save Folder</label>
                <input
                  type="text"
                  value={pollingSettings.pdfFolder}
                  onChange={(e) => handlePollingInputChange('pdfFolder', e.target.value)}
                  placeholder={`e.g., C:\\Users\\YourName\\Documents\\PDFs`}
                />
                <small>Full path where PDF files will be saved. Leave empty to use Downloads folder.</small>
              </div>

              <div className="form-group">
                <button
                  className="btn btn-primary"
                  onClick={handleSavePollingSettings}
                  disabled={pollingSettings.isMonitoring}
                >
                  💾 Save Settings
                </button>
                {saved && <span className="success-message">✓ Polling settings saved!</span>}
              </div>
            </div>

            {/* Control Buttons */}
            <div className="polling-controls">
              <button
                className={`btn btn-success ${pollingSettings.isMonitoring ? 'disabled' : ''}`}
                onClick={handleStartMonitoring}
                disabled={pollingSettings.isMonitoring}
              >
                ▶️ Start Monitoring
              </button>
              <button
                className={`btn btn-danger ${!pollingSettings.isMonitoring ? 'disabled' : ''}`}
                onClick={handleStopMonitoring}
                disabled={!pollingSettings.isMonitoring}
              >
                ⏹️ Stop Monitoring
              </button>
            </div>

            {/* Info Box */}
            <div className="info-box">
              <h4>ℹ️ How it works:</h4>
              <ul>
                <li>Start monitoring to enable automatic email checking</li>
                <li>Every {pollingSettings.checkInterval} seconds, the latest {pollingSettings.emailCount} email(s) will be checked</li>
                <li>XLSX attachments found in emails will have their first cell (A1) extracted</li>
                <li>A PDF file will be generated with the cell content and saved to your configured folder</li>
                <li>Use the Logs tab to see what's been processed</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
