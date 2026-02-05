const fs = require('fs');
const path = require('path');
const os = require('os');

const getStatsFilePath = () => {
  const appDataDir = path.join(os.homedir(), 'AppData', 'Local', 'elect-monitoring');
  if (!fs.existsSync(appDataDir)) {
    fs.mkdirSync(appDataDir, { recursive: true });
  }
  return path.join(appDataDir, 'stats.json');
};

const readStats = () => {
  const filePath = getStatsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[Stats] Error reading stats file:', error);
      return null;
    }
  }
  return null;
};

const writeStats = (stats) => {
  const filePath = getStatsFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2), 'utf8');
  } catch (error) {
    console.error('[Stats] Error writing stats file:', error);
  }
};

module.exports = {
  readStats,
  writeStats,
};
