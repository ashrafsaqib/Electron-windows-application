const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'dist', 'Electron React App-win32-x64');
const outputFile = path.join(__dirname, 'dist', 'Electron-React-App-win32-x64.zip');

// Create a file stream
const output = fs.createWriteStream(outputFile);

// Create the archive
const archive = archiver('zip', {
  zlib: { level: 9 }
});

// Listen for all archive data to be written
output.on('close', function() {
  console.log(`✓ Created distributable package: ${outputFile}`);
  console.log(`✓ Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nTo distribute:');
  console.log('1. Users can download the .zip file');
  console.log('2. Extract it on their system');
  console.log('3. Run Electron React App.exe from the folder');
});

// Catch warnings
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    console.warn(err);
  } else {
    throw err;
  }
});

// Catch errors
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Add the app directory to the archive
archive.directory(sourceDir, 'Electron React App');

// Finalize the archive
archive.finalize();

