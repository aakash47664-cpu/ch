/**
 * ChemDiag AI — Unified Startup Runner
 * Runs both Backend (:8000) and Frontend (:5173), and opens the dashboard in your default browser.
 */

import { spawn, exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('=======================================================');
console.log('🚀 Launching ChemDiag AI (Backend + Frontend)...');
console.log('=======================================================\n');

// 1. Start Backend Server
const backendCwd = path.join(__dirname, 'backend');
const backendProcess = spawn('node', ['server.js'], {
  cwd: backendCwd,
  stdio: 'inherit',
  shell: true
});

backendProcess.on('error', (err) => {
  console.error('❌ Failed to start backend:', err);
});

// 2. Start Frontend Dev Server
const frontendCwd = path.join(__dirname, 'frontend');
const frontendProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: frontendCwd,
  stdio: 'inherit',
  shell: true
});

frontendProcess.on('error', (err) => {
  console.error('❌ Failed to start frontend:', err);
});

// 3. Automatically open browser after 2.5 seconds
setTimeout(() => {
  const url = 'http://localhost:5173';
  console.log(`\n🌐 Opening dashboard in browser: ${url}`);
  if (isWindows) {
    exec(`start ${url}`);
  } else if (process.platform === 'darwin') {
    exec(`open ${url}`);
  } else {
    exec(`xdg-open ${url}`);
  }
}, 2500);

// 4. Graceful termination
function cleanup() {
  console.log('\n🛑 Shutting down ChemDiag AI...');
  backendProcess.kill();
  frontendProcess.kill();
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
