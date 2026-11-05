const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const root = path.resolve(__dirname, '..');
const clientDir = path.join(root, 'client');

if (!fs.existsSync(path.join(clientDir, 'node_modules', 'vite'))) {
  console.error('Install the console dependencies first: npm install --prefix client');
  process.exit(1);
}


const app = express();
app.use(express.json());

const children = [];
let stopping = false;

function launch(command) {
  const child = spawn(command, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (stopping || signal) {
      return;
    }
    shutdown(code ?? 0);
  });
}

function shutdown(code) {
  if (stopping) {
    return;
  }
  stopping = true;
  for (const child of children) {
    if (!child.pid) {
      continue;
    }
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { shell: true, stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

launch('npx tsx src/main.ts');
launch('npm run dev --prefix client');
