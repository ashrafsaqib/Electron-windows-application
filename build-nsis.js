const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // Check if NSIS is installed
  const makensisPath = 'C:\\Program Files (x86)\\NSIS\\makensis.exe';
  
  if (!fs.existsSync(makensisPath)) {
    console.log('⚠️  NSIS is not installed on this system.');
    console.log('\nTo create an NSIS installer:');
    console.log('1. Download NSIS from: https://nsis.sourceforge.io/');
    console.log('2. Install NSIS (default location: C:\\Program Files (x86)\\NSIS\\)');
    console.log('3. Run: npm run build:nsis\n');
    console.log('📦 In the meantime, you can distribute the portable ZIP file:');
    console.log('   dist/Electron-React-App-win32-x64.zip\n');
    process.exit(0);
  }

  console.log('🔨 Creating NSIS installer...');
  execSync(`"${makensisPath}" installer.nsi`, { cwd: __dirname, stdio: 'inherit' });
  
  const installerPath = path.join(__dirname, 'dist', 'Electron-React-App-Setup.exe');
  if (fs.existsSync(installerPath)) {
    const fileSize = (fs.statSync(installerPath).size / 1024 / 1024).toFixed(2);
    console.log(`\n✓ NSIS installer created successfully!`);
    console.log(`✓ Location: ${installerPath}`);
    console.log(`✓ Size: ${fileSize} MB`);
  }
} catch (error) {
  console.error('Failed to create NSIS installer:', error.message);
  process.exit(1);
}
