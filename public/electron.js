const electron = require('electron');
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const ipcMain = electron.ipcMain;
const path = require('path');
const os = require('os');
const nodemailer = require('nodemailer');
const EmailService = require('./emailService');
const ActivityLogger = require('./activityLogger');
const { readStats, writeStats } = require('./stats');

let mainWindow;

// Check if running in development mode
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--development');

// Add electron-reloader in development
if (isDev) {
  try {
    require('electron-reloader')(module, {
      debug: false,
      watchRenderer: true
    });
  } catch (_) { }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      nodeIntegration: false,
      enableRemoteModule: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle SMTP connection test
ipcMain.handle('test-smtp-connection', async (event, smtpSettings, recipientEmail) => {
  try {
    // Validate required fields
    if (!smtpSettings.host || !smtpSettings.port || !smtpSettings.user || !smtpSettings.password) {
      return {
        success: false,
        error: 'Please fill in all SMTP settings (Host, Port, Username, Password)'
      };
    }

    if (!recipientEmail) {
      return {
        success: false,
        error: 'Please enter a recipient email address'
      };
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpSettings.host,
      port: parseInt(smtpSettings.port),
      secure: smtpSettings.secure || false,
      auth: {
        user: smtpSettings.user,
        pass: smtpSettings.password
      },
      // Allow self-signed certificates in development
      ...(isDev && {
        tls: {
          rejectUnauthorized: false
        }
      })
    });

    // Test the connection
    await transporter.verify();

    // Send test email
    const mailOptions = {
      from: smtpSettings.fromEmail || smtpSettings.user,
      to: recipientEmail,
      subject: 'SMTP Connection Test - Success!',
      html: `
        <h2>SMTP Configuration Test Successful</h2>
        <p>Your SMTP settings are working correctly.</p>
        <p><strong>Test Details:</strong></p>
        <ul>
          <li>Host: ${smtpSettings.host}</li>
          <li>Port: ${smtpSettings.port}</li>
          <li>Sender: ${smtpSettings.fromEmail || smtpSettings.user}</li>
        </ul>
        <p>This is an automated test email from your application.</p>
      `
    };

    const result = await transporter.sendMail(mailOptions);

    console.log('Test email sent successfully:', result.response);
    return {
      success: true,
      message: 'SMTP connection successful and test email sent!'
    };
  } catch (error) {
    console.error('SMTP connection error:', error);
    return {
      success: false,
      error: error.message || 'Failed to connect to SMTP server'
    };
  }
});

// Handle IMAP connection test
ipcMain.handle('test-imap-connection', async (event, imapSettings) => {
  try {
    const result = await EmailService.testImapConnection(imapSettings);
    return result;
  } catch (error) {
    console.error('IMAP connection error:', error);
    return {
      success: false,
      error: error.message || 'Failed to test IMAP connection'
    };
  }
});

// Handle fetching inbox emails
ipcMain.handle('fetch-inbox-emails', async (event, imapSettings) => {
  try {
    const result = await EmailService.fetchInboxEmails(imapSettings, 1);
    return result;
  } catch (error) {
    console.error('Fetch emails error:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch emails',
      emails: []
    };
  }
});

// Handle saving XLSX attachment
ipcMain.handle('save-xlsx-attachment', async (event, { filename, content }) => {
  try {
    const fs = require('fs').promises;
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, filename);
    
    // Convert content if it's a string or base64
    let buffer;
    if (typeof content === 'string') {
      buffer = Buffer.from(content, 'base64');
    } else if (Buffer.isBuffer(content)) {
      buffer = content;
    } else {
      buffer = Buffer.from(JSON.stringify(content));
    }
    
    await fs.writeFile(filePath, buffer);
    console.log(`[XLSX] Saved file: ${filePath}`);
    
    return {
      success: true,
      filePath: filePath,
      message: `File saved to Downloads folder: ${filename}`
    };
  } catch (error) {
    console.error('Save XLSX error:', error);
    return {
      success: false,
      error: error.message || 'Failed to save XLSX file'
    };
  }
});

// Handle parsing XLSX attachment to get first cell
ipcMain.handle('parse-xlsx-attachment', async (event, { filename, content }) => {
  try {
    const XLSX = require('xlsx');
    
    // Convert content to buffer if needed
    let buffer;
    if (typeof content === 'string') {
      buffer = Buffer.from(content, 'base64');
    } else if (Buffer.isBuffer(content)) {
      buffer = content;
    } else {
      buffer = Buffer.from(content);
    }
    
    console.log(`[XLSX Parser] Parsing file: ${filename}, size: ${buffer.length} bytes`);
    
    // Read workbook from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log(`[XLSX Parser] Workbook sheets:`, workbook.SheetNames);
    
    // Get first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return {
        success: false,
        error: 'No sheets found in Excel file'
      };
    }
    
    const worksheet = workbook.Sheets[firstSheetName];
    console.log(`[XLSX Parser] First sheet: ${firstSheetName}`);
    
    // Get first cell (A1)
    const firstCell = worksheet['A1'];
    const firstCellValue = firstCell ? firstCell.v : 'Empty';
    
    console.log(`[XLSX Parser] First cell (A1) value:`, firstCellValue);
    
    // Also get some additional info
    const allCells = Object.keys(worksheet)
      .filter(key => key[0] !== '!' && !key.includes(':'))
      .slice(0, 5)
      .map(key => ({ cell: key, value: worksheet[key].v }));
    
    return {
      success: true,
      filename: filename,
      sheet: firstSheetName,
      firstCell: 'A1',
      firstCellValue: firstCellValue,
      preview: allCells
    };
  } catch (error) {
    console.error('Parse XLSX error:', error);
    return {
      success: false,
      error: error.message || 'Failed to parse XLSX file'
    };
  }
});

// Handle generating PDF from Excel content
ipcMain.handle('generate-pdf-from-xlsx', async (event, { xlsxFilename, firstCellValue }) => {
  try {
    const PDFDocument = require('pdfkit');
    const fs = require('fs');
    const path = require('path');
    
    const downloadsPath = app.getPath('downloads');
    const pdfFilename = xlsxFilename.replace(/\.xlsx$/i, '.pdf');
    const pdfPath = path.join(downloadsPath, pdfFilename);
    
    console.log(`[PDF Generator] Generating PDF: ${pdfPath}`);
    console.log(`[PDF Generator] Content: ${firstCellValue}`);
    
    // Create PDF document
    const doc = new PDFDocument({
      bufferPages: true,
      margin: 50
    });
    
    // Create writable stream
    const stream = fs.createWriteStream(pdfPath);
    
    // Pipe document to file
    doc.pipe(stream);
    
    // Add content to PDF
    doc.fontSize(20)
      .font('Helvetica-Bold')
      .text('Excel Data Export', { align: 'center' })
      .moveDown();
    
    doc.fontSize(12)
      .font('Helvetica')
      .text(`Source File: ${xlsxFilename}`, { align: 'left' })
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' })
      .moveDown(1.5);
    
    // Add first cell content
    doc.fontSize(14)
      .font('Helvetica-Bold')
      .text('First Cell Content (A1):', { align: 'left' })
      .moveDown(0.5);
    
    doc.fontSize(12)
      .font('Helvetica')
      .text(String(firstCellValue), {
        align: 'left',
        width: 500
      })
      .moveDown(2);
    
    // Add footer
    doc.fontSize(10)
      .font('Helvetica')
      .text('This PDF was automatically generated from an Excel file attachment', {
        align: 'center',
        color: '#999999'
      });
    
    // Finalize PDF
    doc.end();
    
    // Wait for stream to finish
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
      doc.on('error', reject);
    });
    
    console.log(`[PDF Generator] PDF saved successfully: ${pdfPath}`);
    
    return {
      success: true,
      filePath: pdfPath,
      filename: pdfFilename,
      message: `PDF generated: ${pdfFilename}`
    };
  } catch (error) {
    console.error('Generate PDF error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate PDF'
    };
  }
});

// Activity/Stats Handlers
ipcMain.handle('get-today-stats', async (event) => {
  try {
    const stats = readStats() || {
      emailsCheckedToday: 0,
      pdfsGeneratedToday: 0,
      totalErrors: 0,
      lastCheckTime: null
    };
    return {
      success: true,
      stats: stats
    };
  } catch (error) {
    console.error('Get stats error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('get-today-activities', async (event) => {
  try {
    const activities = ActivityLogger.getTodayActivities();
    return {
      success: true,
      activities: activities
    };
  } catch (error) {
    console.error('Get activities error:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Monitoring/Polling System
let monitoringInterval = null;
let isMonitoring = false;
let monitoringCycleRunning = false;

// Helper function to log monitoring activities
const logMonitoringActivity = (message, type = 'info', additionalData = {}) => {
  const timestamp = new Date().toLocaleTimeString();
  const logMessage = `[Monitoring] ${message}`;
  console.log(logMessage);
  
  // Log to activity file
  ActivityLogger.addActivity(message, type, additionalData);
  
  if (mainWindow && mainWindow.webContents) {
    console.log(`[IPC] Sending monitoring-log to renderer: ${message}`);
    mainWindow.webContents.send('monitoring-log', {
      message: logMessage,
      type: type,
      timestamp: timestamp
    });
  } else {
    console.warn('[IPC] mainWindow.webContents not available!');
  }
};

ipcMain.handle('start-monitoring', async (event, imapSettings, pollingSettings) => {
  try {
    // Validate settings
    if (!imapSettings.host || !imapSettings.port || !imapSettings.user || !imapSettings.password) {
      logMonitoringActivity('❌ Start failed - IMAP settings incomplete', 'error');
      return {
        success: false,
        error: 'IMAP settings are incomplete. Please configure IMAP first.'
      };
    }

    if (!pollingSettings.checkInterval || pollingSettings.checkInterval < 30) {
      logMonitoringActivity('❌ Start failed - Check interval less than 30 seconds', 'error');
      return {
        success: false,
        error: 'Check interval must be at least 30 seconds.'
      };
    }

    if (isMonitoring) {
      logMonitoringActivity('❌ Start failed - Already running', 'error');
      return {
        success: false,
        error: 'Monitoring is already running.'
      };
    }

    // Initialize stats if they don't exist (don't reset existing stats)
    let existingStats = readStats();
    if (!existingStats) {
      writeStats({
        emailsCheckedToday: 0,
        pdfsGeneratedToday: 0,
        totalErrors: 0,
        lastCheckTime: null
      });
    }

    // Set monitoring state
    isMonitoring = true;
    const emailCount = pollingSettings.emailCount || 1;
    const checkInterval = pollingSettings.checkInterval * 1000; // Convert to milliseconds

    logMonitoringActivity(`✅ Started with interval: ${pollingSettings.checkInterval}s, checking ${emailCount} email(s)`, 'log');

    // Send monitoring started event to renderer
    console.log('[IPC] Sending monitoring-started to renderer');
    mainWindow.webContents.send('monitoring-started', {
      timestamp: new Date().toLocaleTimeString(),
      checkInterval: pollingSettings.checkInterval,
      emailCount: emailCount
    });
          logMonitoringActivity('❌ Start failed - IMAP settings incomplete', 'error');
    // Function to run monitoring cycle
    const runMonitoringCycle = async () => {
      try {
        const checkTime = new Date().toLocaleTimeString();
        logMonitoringActivity(`🔍 Checking for emails (checking latest ${emailCount} email(s))`, 'log');

        // Update lastCheckTime in stats
        const currentStats = readStats() || {
          emailsCheckedToday: 0,
          pdfsGeneratedToday: 0,
          totalErrors: 0,
          lastCheckTime: null
        };
        currentStats.lastCheckTime = checkTime;
        writeStats(currentStats);

        // Fetch latest emails
        const fetchResult = await EmailService.fetchInboxEmails(imapSettings, emailCount);

        if (!fetchResult.success) {
          logMonitoringActivity(`❌ Fetch error: ${fetchResult.error}`, 'error');
          
          // Update error count
          const stats = readStats();
          if (stats) {
            stats.totalErrors = (stats.totalErrors || 0) + 1;
            writeStats(stats);
          }
          
          console.log('[IPC] Sending monitoring-event: error');
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('monitoring-event', {
              type: 'error',
              message: `Fetch error: ${fetchResult.error}`,
              timestamp: checkTime
            });
          } else {
            console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
          }
          return;
        }

        const emails = fetchResult.emails || [];
        
        // Update emailsCheckedToday counter
        const stats = readStats();
        if (stats) {
          stats.emailsCheckedToday = (stats.emailsCheckedToday || 0) + emails.length;


          writeStats(stats);
        }
          if (monitoringCycleRunning) {
            logMonitoringActivity('⚠️ Previous monitoring cycle still running, skipping this interval', 'warn');
            return;
          }
          monitoringCycleRunning = true;

        if (emails.length === 0) {
          logMonitoringActivity(`✓ Checked inbox - no new emails found`, 'log');
          console.log('[IPC] Sending monitoring-event: info (no emails)');
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('monitoring-event', {
              type: 'info',
              message: 'Checked inbox - no new emails',
              timestamp: checkTime
            });
          } else {
            console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
          }
          return;
        }

        logMonitoringActivity(`📧 Found ${emails.length} email(s) to process`, 'log');

        // Process each email for XLSX attachments
        for (const email of emails) {
          logMonitoringActivity(`📧 Processing email from ${email.from}...`, 'log');

          // Check for XLSX attachments
          const xlsxAttachments = email.attachments.filter(att => 
            att.filename && att.filename.toLowerCase().endsWith('.xlsx')
          );

          if (xlsxAttachments.length === 0) {
            logMonitoringActivity(`ℹ️ Email from ${email.from} has no XLSX attachments`, 'log');
            console.log('[IPC] Sending monitoring-event: info (no xlsx)');
            if (mainWindow && mainWindow.webContents) {
              mainWindow.webContents.send('monitoring-event', {
                type: 'info',
                message: `Email from ${email.from} - no XLSX attachments`,
                timestamp: checkTime
              });
            } else {
              console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
            }
            continue;
          }

          logMonitoringActivity(`📎 Found ${xlsxAttachments.length} XLSX attachment(s) in email from ${email.from}`, 'log');

          // Process each XLSX attachment
          for (const attachment of xlsxAttachments) {
            try {
              logMonitoringActivity(`📋 Parsing XLSX: ${attachment.filename}`, 'log');

              // Parse XLSX
              const parseResult = await EmailService.parseXlsxAttachment(
                attachment.filename,
                attachment.content
              );

              if (!parseResult.success) {
                logMonitoringActivity(`❌ Parse error for ${attachment.filename}: ${parseResult.error}`, 'error');
                
                // Update error count
                const errorStats = readStats();
                if (errorStats) {
                  errorStats.totalErrors = (errorStats.totalErrors || 0) + 1;
                  writeStats(errorStats);
                }
                
                if (mainWindow && mainWindow.webContents) {
                  mainWindow.webContents.send('monitoring-event', {
                    type: 'error',
                    message: `Failed to parse ${attachment.filename}: ${parseResult.error}`,
                    timestamp: new Date().toLocaleTimeString()
                  });
                } else {
                  console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
                }
                continue;
              }

              logMonitoringActivity(`✓ Successfully parsed ${attachment.filename} - First cell: ${String(parseResult.firstCell).substring(0, 50)}...`, 'log');

              // Generate PDF
              const pdfFolder = pollingSettings.pdfFolder || path.join(os.homedir(), 'Downloads');
              logMonitoringActivity(`📄 Generating PDF from ${attachment.filename} to ${pdfFolder}`, 'log');
              
              const pdfResult = await EmailService.generatePdfFromXlsx(
                attachment.filename,
                parseResult.firstCell,
                pdfFolder
              );

              if (!pdfResult.success) {
                logMonitoringActivity(`❌ PDF generation error: ${pdfResult.error}`, 'error');
                
                // Update error count
                const pdfErrorStats = readStats();
                if (pdfErrorStats) {
                  pdfErrorStats.totalErrors = (pdfErrorStats.totalErrors || 0) + 1;
                  writeStats(pdfErrorStats);
                }
                
                if (mainWindow && mainWindow.webContents) {
                  mainWindow.webContents.send('monitoring-event', {
                    type: 'error',
                    message: `PDF generation failed: ${pdfResult.error}`,
                    timestamp: new Date().toLocaleTimeString()
                  });
                } else {
                  console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
                }
                continue;
              }

              // Update PDF generation count
              const pdfStats = readStats();
              if (pdfStats) {
                pdfStats.pdfsGeneratedToday = (pdfStats.pdfsGeneratedToday || 0) + 1;
                writeStats(pdfStats);
              }

              logMonitoringActivity(`✅ Successfully generated PDF: ${pdfResult.filename}`, 'log');
              console.log('[IPC] Sending monitoring-event: success');
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('monitoring-event', {
                  type: 'success',
                  message: `Generated PDF: ${pdfResult.filename}`,
                  email: email.from,
                  file: pdfResult.filename,
                  timestamp: new Date().toLocaleTimeString()
                });
                console.log('[IPC] ✓ monitoring-event: success sent successfully');
              } else {
                console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
              }

            } catch (error) {
              logMonitoringActivity(`❌ Error processing attachment: ${error.message}`, 'error');
              
              // Update error count
              const attachErrorStats = readStats();
              if (attachErrorStats) {
                attachErrorStats.totalErrors = (attachErrorStats.totalErrors || 0) + 1;
                writeStats(attachErrorStats);
              }
              
              if (mainWindow && mainWindow.webContents) {
                mainWindow.webContents.send('monitoring-event', {
                  type: 'error',
                  message: `Error processing attachment: ${error.message}`,
                  timestamp: new Date().toLocaleTimeString()
                });
              } else {
                console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
              }
            }
          }
        }

      } catch (error) {
        logMonitoringActivity(`❌ Monitoring cycle error: ${error.message}`, 'error');
        
        // Update error count
        const cycleErrorStats = readStats();
        if (cycleErrorStats) {
          cycleErrorStats.totalErrors = (cycleErrorStats.totalErrors || 0) + 1;
          cycleErrorStats.lastCheckTime = new Date().toLocaleTimeString();
          writeStats(cycleErrorStats);
        }
        
        if (mainWindow && mainWindow.webContents) {
          mainWindow.webContents.send('monitoring-event', {
            type: 'error',
            message: `Monitoring error: ${error.message}`,
            timestamp: new Date().toLocaleTimeString()
          });
        } else {
          console.warn('[IPC] mainWindow.webContents not available for monitoring-event!');
        }
      }
    };

    // Run first cycle immediately, then set interval
    await runMonitoringCycle();
    
    monitoringInterval = setInterval(runMonitoringCycle, checkInterval);

    return {
      success: true,
      message: `Monitoring started. Checking every ${pollingSettings.checkInterval} seconds for latest ${emailCount} email(s).`
    };

  } catch (error) {
    logMonitoringActivity(`❌ Start error: ${error.message}`, 'error');
    isMonitoring = false;
    return {
      success: false,
      error: error.message || 'Failed to start monitoring'
    };
  }
});

ipcMain.handle('stop-monitoring', async (event) => {
  try {
    if (!isMonitoring || !monitoringInterval) {
      logMonitoringActivity('❌ Stop failed - Monitoring not running', 'error');
      return {
        success: false,
        error: 'Monitoring is not currently running.'
      };
    }

    clearInterval(monitoringInterval);
    monitoringInterval = null;
    isMonitoring = false;

    logMonitoringActivity('⏹️ Stopped monitoring', 'log');
    mainWindow.webContents.send('monitoring-stopped', {
      timestamp: new Date().toLocaleTimeString()
    });

    return {
      success: true,
      message: 'Monitoring stopped successfully.'
    };

  } catch (error) {
    logMonitoringActivity(`❌ Stop error: ${error.message}`, 'error');
    return {
      success: false,
      error: error.message || 'Failed to stop monitoring'
    };
  }
});

ipcMain.handle('get-monitoring-status', async (event) => {
  return {
    isMonitoring: isMonitoring
  };
});

// Test conversion: read test.xlsx and create test.pdf using HTML template
ipcMain.handle('test-xlsx-to-pdf', async (event, pdfFolder) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const xlsx = require('xlsx');
    const puppeteer = require('puppeteer');
    
    // Use the provided PDF folder path
    const folderPath = pdfFolder || path.join(os.homedir(), 'Downloads');
    const xlsxPath = path.join(folderPath, 'example.xlsx');
    const pdfPath = path.join(folderPath, 'test.pdf');
    const templatePath = path.join(__dirname, 'templates', 'source.html');
    
    console.log(`[Test Conversion] Looking for example.xlsx at: ${xlsxPath}`);
    
    // Check if example.xlsx exists
    if (!fs.existsSync(xlsxPath)) {
      return {
        success: false,
        error: `example.xlsx not found at: ${xlsxPath}. Please place the file in the configured PDF folder.`
      };
    }
    
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      return {
        success: false,
        error: `Template not found at: ${templatePath}`
      };
    }
    
    console.log(`[Test Conversion] Reading example.xlsx...`);
    
    // Read the Excel file
    const workbook = xlsx.readFile(xlsxPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON for easier data access (rows as arrays)
    const data = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    console.log(`[Test Conversion] Parsed ${data.length} rows from Excel`);
    
    // Read HTML template
    let htmlContent = fs.readFileSync(templatePath, 'utf8');
    
    // Map Excel data to template variables (example.xlsx structure)
    // Row 1 (index 0): Sheet title in column B
    // Row 2 (index 1): Optional reference in column F (e.g. GFK 959)
    // Row 5 (index 4): Employee name in column C, Month/Year in column F
    // Items: Rows where column A is like "3." and column D has a number (duration)
    // Totals: Row where column A is empty and column D has a number (total hours)

    const formatNumberGerman = (value, decimals = 2) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return '';
      return value.toFixed(decimals).replace('.', ',');
    };

    const formatTimeValue = (value) => {
      if (typeof value !== 'number' || Number.isNaN(value)) return '';
      return formatNumberGerman(value, 2);
    };

    const invoiceRef = data[1]?.[5] || '';
    const monthYear = data[4]?.[5] || '';
    const employeeName = data[4]?.[2] || '';

    const replacements = {
      invoiceNumber: invoiceRef || '2026/0005',
      createdDate: monthYear || '',
      deliveryDate: monthYear || '',
      dueDate: monthYear || '',

      customerName: employeeName || '',
      customerAddress: '',
      customerCity: '',
      customerCountry: '',

      customerId: '',
      customerVatId: '',

      paymentMethod: '',
      paymentReference: invoiceRef || '',
      iban: '',
      swift: '',
    };
    
    // Generate items table rows
    let itemsHtml = '';
    let durationSum = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const posCell = String(row?.[0] || '').trim();
      const duration = typeof row?.[3] === 'number' ? row[3] : null;
      const description = row?.[4] || '';

      if (!posCell || !/\d+\./.test(posCell) || duration === null) {
      continue;
      }

      const beginVal = formatTimeValue(row?.[1]);
      const endVal = formatTimeValue(row?.[2]);
      const subDescription = (beginVal || endVal) ? `Beginn ${beginVal} – Ende ${endVal}` : '';

      durationSum += duration;

      itemsHtml += `
          <tr>
            <td class="center">${posCell}</td>
            <td>
              <div class="item-desc">${description}</div>
              ${subDescription ? `<div class="item-sub-desc">${subDescription}</div>` : ''}
            </td>
            <td class="right">${formatNumberGerman(duration)}</td>
            <td class="right">
              <span></span>
            </td>
            <td class="right">
              <span>${formatNumberGerman(duration)}</span>
            </td>
          </tr>`;
    }

    const totalRow = data.find((row) => {
      const a = String(row?.[0] || '').trim();
      return !a && typeof row?.[3] === 'number';
    });
    const totalHours = typeof totalRow?.[3] === 'number' ? totalRow[3] : durationSum;

    replacements.items = itemsHtml;
    replacements.grandTotal = formatNumberGerman(totalHours);
    replacements.summe = formatNumberGerman(totalHours);
    
    // Replace all placeholders in HTML
    Object.keys(replacements).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      htmlContent = htmlContent.replace(regex, replacements[key]);
    });
    
    console.log(`[Test Conversion] Generating PDF with Puppeteer...`);
    
    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      }
    });
    
    await browser.close();
    
    console.log(`[Test Conversion] PDF saved successfully: ${pdfPath}`);
    
    return {
      success: true,
      xlsxPath: xlsxPath,
      pdfPath: pdfPath,
      firstCellValue: data[0]?.[0] || 'N/A',
      message: `Test conversion completed successfully! Processed ${data.length} rows.`
    };
  } catch (error) {
    console.error('[Test Conversion] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to perform test conversion'
    };
  }
});


