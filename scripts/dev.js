import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const backendDir = path.join(projectRoot, 'backend');
const backendPort = Number(process.env.PORT) || 5000;
const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');

let stopping = false;
let viteProcess;

function startBackend() {
  return spawn(process.execPath, ['--watch', 'index.js'], {
    cwd: backendDir,
    stdio: 'inherit',
  });
}

function startFrontend() {
  viteProcess = spawn(process.execPath, [viteCli], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  viteProcess.once('exit', (code) => {
    if (!stopping) {
      stopping = true;
      backendProcess.kill('SIGTERM');
      process.exitCode = code ?? 1;
    }
  });
}

function stopServices() {
  if (stopping) return;
  stopping = true;
  backendProcess.kill('SIGTERM');
  viteProcess?.kill('SIGTERM');
}

const backendProcess = startBackend();
let backendExitCode;
backendProcess.once('exit', (code) => {
  backendExitCode = code ?? 1;
  if (!stopping) {
    console.error('Todo backend stopped; stopping Vite. Restart with `npm run dev`.');
    stopping = true;
    viteProcess?.kill('SIGTERM');
    process.exitCode = backendExitCode;
  }
});

process.once('SIGINT', stopServices);
process.once('SIGTERM', stopServices);

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (backendExitCode !== undefined) {
      throw new Error('Backend exited before it became ready. Check its startup output above.');
    }

    try {
      const response = await fetch(`http://127.0.0.1:${backendPort}/api/health`);
      if (response.ok) {
        const health = await response.json();
        if (health.database === 'connected') {
          ready = true;
          break;
        }
      }
    } catch {
      // The backend may still be connecting to MongoDB or starting up.
    }

    await delay(500);
  }

  if (!ready) {
    throw new Error('Backend did not connect to MongoDB within 60 seconds.');
  }

  console.log('MongoDB and the todo API are ready. Starting Vite...');
  startFrontend();
} catch (error) {
  console.error(error.message);
  stopServices();
  process.exitCode = 1;
}
