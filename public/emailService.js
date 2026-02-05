const Imap = require('imap');
const { simpleParser } = require('mailparser');

class EmailService {
  /**
   * Test IMAP connection
   * @param {Object} settings - IMAP settings
   * @returns {Promise<Object>}
   */
  static testImapConnection(settings) {
    return new Promise((resolve) => {
      try {
        if (!settings.host || !settings.port || !settings.user || !settings.password) {
          return resolve({
            success: false,
            error: 'Please fill in all IMAP settings'
          });
        }

        const imap = new Imap({
          user: settings.user,
          password: settings.password,
          host: settings.host,
          port: parseInt(settings.port),
          tls: settings.tlsRequired !== false,
          tlsOptions: { rejectUnauthorized: false },
          connTimeout: 10000,
          authTimeout: 10000
        });

        let hasResolved = false;

        const cleanup = () => {
          try {
            imap.end();
          } catch (e) {
            // Already closed
          }
        };

        imap.on('ready', () => {
          imap.openBox('INBOX', false, (err, mailbox) => {
            if (err) {
              if (!hasResolved) {
                hasResolved = true;
                cleanup();
                return resolve({
                  success: false,
                  error: err.message || 'Failed to open inbox'
                });
              }
            }

            if (!hasResolved) {
              hasResolved = true;
              const inboxCount = mailbox ? mailbox.messages.total : 0;
              cleanup();
              
              resolve({
                success: true,
                mailboxes: 1,
                inboxCount: inboxCount
              });
            }
          });
        });

        imap.on('error', (err) => {
          if (!hasResolved) {
            hasResolved = true;
            console.error('IMAP error:', err);
            cleanup();
            resolve({
              success: false,
              error: err.message || 'IMAP connection error'
            });
          }
        });

        imap.on('end', () => {
          // Connection ended
        });

        imap.connect();

        // Timeout fallback
        setTimeout(() => {
          if (!hasResolved) {
            hasResolved = true;
            cleanup();
            resolve({
              success: false,
              error: 'Connection timeout - please check your settings'
            });
          }
        }, 15000);

      } catch (error) {
        console.error('IMAP test error:', error);
        resolve({
          success: false,
          error: error.message || 'Failed to test IMAP connection'
        });
      }
    });
  }

  /**
   * Fetch emails from inbox
   * @param {Object} settings - IMAP settings
   * @param {Number} count - Number of emails to fetch (default 1)
   * @returns {Promise<Object>}
   */
  static fetchInboxEmails(settings, count = 1) {
    return new Promise((resolve) => {
      try {
        if (!settings.host || !settings.port || !settings.user || !settings.password) {
          return resolve({
            success: false,
            error: 'Please fill in all IMAP settings',
            emails: []
          });
        }

        console.log(`[IMAP] Fetching ${count} most recent emails from ${settings.host}`);

        const imap = new Imap({
          user: settings.user,
          password: settings.password,
          host: settings.host,
          port: parseInt(settings.port),
          tls: settings.tlsRequired !== false,
          tlsOptions: { rejectUnauthorized: false },
          connTimeout: 10000,
          authTimeout: 10000
        });

        const emails = [];
        let hasResolved = false;

        const cleanup = () => {
          try {
            imap.end();
          } catch (e) {
            // Already closed
          }
        };

        const doResolve = (result) => {
          if (!hasResolved) {
            hasResolved = true;
            console.log(`[IMAP] Resolving with:`, result);
            cleanup();
            resolve(result);
          }
        };

        imap.on('ready', () => {
          console.log('[IMAP] Connected and ready, opening INBOX...');
          imap.openBox('INBOX', false, (err, mailbox) => {
            if (err) {
              console.error('[IMAP] Error opening inbox:', err);
              return doResolve({
                success: false,
                error: err.message || 'Failed to open inbox',
                emails: []
              });
            }

            const totalEmails = mailbox.messages.total;
            console.log(`[IMAP] Inbox has ${totalEmails} total emails`);

            if (totalEmails === 0) {
              console.log('[IMAP] No emails in inbox');
              return doResolve({
                success: true,
                emailCount: 0,
                emails: []
              });
            }

            // Get only the last N emails (most recent)
            const fetchCount = Math.min(count, totalEmails);
            const startSeq = totalEmails - fetchCount + 1;
            const endSeq = totalEmails;
            
            console.log(`[IMAP] Fetching emails ${startSeq}:${endSeq} (${fetchCount} emails)`);

            // Fetch entire message including all parts (headers, body, attachments)
            const f = imap.seq.fetch(`${startSeq}:${endSeq}`, {
              bodies: ''
            });

            let emailsProcessed = 0;
            let emailsReceived = 0;

            f.on('message', (msg, seqno) => {
              emailsReceived++;
              console.log(`[IMAP] Received message ${seqno}`);
              
              const chunks = [];
              
              // Listen for the 'body' event which emits a stream
              msg.on('body', (stream, info) => {
                console.log(`[IMAP] Body received for message ${seqno}, info:`, info);
                
                stream.on('data', (chunk) => {
                  chunks.push(chunk);
                });
              });
              
              msg.on('end', () => {
                try {
                  if (chunks.length > 0) {
                    const buffer = Buffer.concat(chunks);
                    console.log(`[IMAP] Message ${seqno} collected: ${buffer.length} bytes`);
                    
                    // Create a readable stream from the buffer
                    const { Readable } = require('stream');
                    const messageStream = Readable.from(buffer);
                    
                    // Use simpleParser on the stream
                    simpleParser(messageStream, async (err, parsed) => {
                      try {
                        if (err) {
                          console.error(`[IMAP] Parse error for message ${seqno}:`, err.message);
                          emailsProcessed++;
                          return;
                        }

                        console.log(`[IMAP] Message ${seqno} parsed successfully`);
                        console.log(`[IMAP]   Subject: ${parsed.subject}`);
                        console.log(`[IMAP]   From: ${parsed.from?.text || parsed.from?.email}`);
                        console.log(`[IMAP]   Text length: ${parsed.text ? parsed.text.length : 0}`);
                        console.log(`[IMAP]   Attachments: ${parsed.attachments ? parsed.attachments.length : 0}`);

                        const email = {
                          subject: parsed.subject || '(no subject)',
                          from: parsed.from?.text || parsed.from?.email || '(unknown)',
                          text: parsed.text ? parsed.text.substring(0, 500) : '(no text content)',
                          html: parsed.html ? parsed.html.substring(0, 500) : null,
                          date: parsed.date || new Date(),
                          seqno,
                          attachments: []
                        };

                        // Extract attachments, particularly XLSX files
                        if (parsed.attachments && Array.isArray(parsed.attachments)) {
                          console.log(`[IMAP] Message ${seqno} has ${parsed.attachments.length} attachment(s)`);
                          
                          for (const attachment of parsed.attachments) {
                            const attachmentInfo = {
                              filename: attachment.filename || 'unknown',
                              mimetype: attachment.contentType || attachment.mimetype || 'unknown',
                              size: attachment.size || (attachment.content ? attachment.content.length : 0),
                              isXlsx: attachment.filename && attachment.filename.endsWith('.xlsx')
                            };
                            
                            // If it's an XLSX file, save the content
                            if (attachmentInfo.isXlsx) {
                              attachmentInfo.content = attachment.content;
                              console.log(`[IMAP] Found XLSX file: ${attachment.filename} (${attachmentInfo.size} bytes)`);
                            }
                            
                            email.attachments.push(attachmentInfo);
                          }
                        }

                        emails.push(email);
                        console.log(`[IMAP] Parsed email ${seqno}: ${email.subject} (${email.attachments.length} attachment(s))`);
                        emailsProcessed++;

                        // Check if all emails are processed
                        if (emailsProcessed >= emailsReceived && emailsReceived >= fetchCount) {
                          console.log(`[IMAP] All emails processed. Resolving with ${emails.length} emails`);
                          doResolve({
                            success: true,
                            emailCount: emails.length,
                            emails: emails
                          });
                        }
                      } catch (e) {
                        console.error(`[IMAP] Error in parser callback for message ${seqno}:`, e.message);
                        emailsProcessed++;
                      }
                    });
                  } else {
                    console.warn(`[IMAP] No body data received for message ${seqno}`);
                    emailsProcessed++;
                  }
                } catch (e) {
                  console.error(`[IMAP] Error processing message ${seqno}:`, e.message);
                  emailsProcessed++;
                }
              });
            });

            f.on('error', (err) => {
              console.error('[IMAP] Fetch error:', err);
              doResolve({
                success: false,
                error: err.message || 'Failed to fetch emails',
                emails: []
              });
            });

            f.on('end', () => {
              console.log(`[IMAP] Fetch ended. Received ${emailsReceived} messages, processed ${emailsProcessed}`);
              // Give a moment for last emails to process
              setTimeout(() => {
                if (emailsProcessed >= emailsReceived) {
                  console.log(`[IMAP] All done, resolving with ${emails.length} emails`);
                  doResolve({
                    success: true,
                    emailCount: emails.length,
                    emails: emails
                  });
                }
              }, 500);
            });

            f.on('error', (err) => {
              console.error('[IMAP] Fetch error:', err);
              doResolve({
                success: false,
                error: err.message || 'Failed to fetch emails',
                emails: []
              });
            });

            f.on('end', () => {
              console.log(`[IMAP] Fetch ended. Received ${emailsReceived} messages, processed ${emailsProcessed}`);
              // Give a moment for last emails to process
              setTimeout(() => {
                if (emailsProcessed >= emailsReceived && emailsReceived > 0) {
                  console.log(`[IMAP] All done, resolving with ${emails.length} emails`);
                  doResolve({
                    success: true,
                    emailCount: emails.length,
                    emails: emails
                  });
                }
              }, 500);
            });
          });
        });

        imap.on('error', (err) => {
          console.error('[IMAP] Connection error:', err);
          doResolve({
            success: false,
            error: err.message || 'IMAP connection error',
            emails: []
          });
        });

        imap.on('end', () => {
          console.log('[IMAP] Connection ended');
        });

        console.log('[IMAP] Initiating connection...');
        imap.connect();

        // Timeout fallback
        setTimeout(() => {
          if (!hasResolved) {
            console.warn('[IMAP] Operation timed out after 20 seconds');
            doResolve({
              success: false,
              error: 'Connection timeout - took too long to fetch emails. Check your internet connection and IMAP settings.',
              emails: emails.length > 0 ? emails : []
            });
          }
        }, 20000);

      } catch (error) {
        console.error('[IMAP] Catch error:', error);
        resolve({
          success: false,
          error: error.message || 'Failed to fetch emails',
          emails: []
        });
      }
    });
  }

  /**
   * Parse email content
   * @param {Object} email - Email object
   * @returns {Object} Parsed email
   */
  static parseEmail(email) {
    return {
      subject: email.subject,
      from: email.from,
      to: email.to,
      text: email.text,
      html: email.html,
      date: email.date
    };
  }

  /**
   * Parse XLSX attachment and extract first cell value
   * @param {string} filename
   * @param {Buffer} content
   * @returns {Promise<Object>}
   */
  static parseXlsxAttachment(filename, content) {
    return new Promise((resolve) => {
      try {
        const xlsx = require('xlsx');
        
        // Read the workbook from buffer
        const workbook = xlsx.read(content, { type: 'buffer' });
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Get first cell (A1)
        const firstCell = worksheet['A1'];
        const firstCellValue = firstCell ? firstCell.v : '';
        
        return resolve({
          success: true,
          firstCell: firstCellValue,
          sheetName: sheetName
        });
      } catch (error) {
        return resolve({
          success: false,
          error: error.message || 'Failed to parse XLSX'
        });
      }
    });
  }

  /**
   * Generate PDF from XLSX first cell content
   * @param {string} xlsxFilename
   * @param {string} firstCellValue
   * @param {string} outputFolder
   * @returns {Promise<Object>}
   */
  static generatePdfFromXlsx(xlsxFilename, firstCellValue, outputFolder = null) {
    return new Promise((resolve) => {
      try {
        const PDFDocument = require('pdfkit');
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        
        // Determine output folder
        const folder = outputFolder || path.join(os.homedir(), 'Downloads');
        
        // Create folder if it doesn't exist
        if (!fs.existsSync(folder)) {
          fs.mkdirSync(folder, { recursive: true });
        }
        
        // Generate filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const baseName = xlsxFilename.replace(/\.[^/.]+$/, '');
        const pdfFilename = `${baseName}_${timestamp}.pdf`;
        const pdfPath = path.join(folder, pdfFilename);
        
        // Create PDF document
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(pdfPath);
        
        doc.pipe(stream);
        
        // Add title
        doc.fontSize(18)
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
        stream.on('finish', () => {
          resolve({
            success: true,
            filePath: pdfPath,
            filename: pdfFilename,
            message: `PDF generated: ${pdfFilename}`
          });
        });
        
        stream.on('error', (error) => {
          resolve({
            success: false,
            error: error.message || 'Stream error'
          });
        });
        
        doc.on('error', (error) => {
          resolve({
            success: false,
            error: error.message || 'Document error'
          });
        });
        
      } catch (error) {
        return resolve({
          success: false,
          error: error.message || 'Failed to generate PDF'
        });
      }
    });
  }
}

module.exports = EmailService;
