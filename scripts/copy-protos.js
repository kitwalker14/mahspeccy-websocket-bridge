const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../src/ctrader/proto');
const targetDir = path.join(__dirname, '../dist/ctrader/proto');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all proto files
const protoFiles = [
  'OpenApiCommonModelMessages.proto',
  'OpenApiModelMessages.proto',
  'OpenApiCommonMessages.proto',
  'OpenApiMessages.proto',
];

protoFiles.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied ${file}`);
  } else {
    console.error(`ERROR: ${file} not found!`);
    process.exit(1);
  }
});

console.log('✅ Proto files copied to dist/');
