const fs = require('fs');
const path = require('path');
const os = require('os');
const { readStats, writeStats } = require('./stats');

// Get the app data directory
const getActivityFilePath = () => {
  const appDataDir = path.join(os.homedir(), 'AppData', 'Local', 'elect-monitoring');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  
  return path.join(appDataDir, 'monitoring-activity.json');
};

// Load activity log from file
const loadActivityLog = () => {
  const filePath = getActivityFilePath();
  
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[ActivityLogger] Error loading activity log:', error.message);
  }
  
  return { activities: [] };
};

// Save activity log to file
const saveActivityLog = (log) => {
  const filePath = getActivityFilePath();
  
  try {
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2), 'utf8');
  } catch (error) {
    console.error('[ActivityLogger] Error saving activity log:', error.message);
  }
};

// Add an activity entry
const addActivity = (message, type = 'info', additionalData = {}) => {
  const log = loadActivityLog();
  
  const activity = {
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    type: type,
    message: message,
    ...additionalData
  };
  
  log.activities.push(activity);
  
  // Keep only last 1000 entries to avoid file getting too large
  if (log.activities.length > 1000) {
    log.activities = log.activities.slice(-1000);
  }
  
  saveActivityLog(log);
  updateStats(activity);
  
  console.log(`[ActivityLogger] Activity logged: [${type}] ${message}`);
};

// Get today's activities
const getTodayActivities = () => {
  const log = loadActivityLog();
  const today = new Date().toLocaleDateString();
  
  return log.activities.filter(activity => activity.date === today);
};

// Update stats based on an activity
const updateStats = (activity) => {
  let stats = readStats();
  if (!stats) {
    stats = {
      emailsCheckedToday: 0,
      pdfsGeneratedToday: 0,
      totalErrors: 0,
      lastCheckTime: null
    };
  }

  if (activity.type === 'info' && activity.message.includes('Checked inbox')) {
    stats.emailsCheckedToday++;
  }
  
  if (activity.type === 'success') {
    stats.pdfsGeneratedToday++;
  }
  
  if (activity.type === 'error') {
    stats.totalErrors++;
  }
  
  stats.lastCheckTime = activity.timestamp;

  writeStats(stats);
};

// Clear old activities (before today)
const clearOldActivities = () => {
  const log = loadActivityLog();
  const today = new Date().toLocaleDateString();
  
  const before = log.activities.length;
  log.activities = log.activities.filter(activity => activity.date === today);
  const after = log.activities.length;
  
  saveActivityLog(log);
  
  console.log(`[ActivityLogger] Cleared ${before - after} old activities`);
};

module.exports = {
  getActivityFilePath,
  loadActivityLog,
  saveActivityLog,
  addActivity,
  getTodayActivities,
  clearOldActivities
};
