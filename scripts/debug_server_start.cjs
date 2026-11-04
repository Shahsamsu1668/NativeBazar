const { spawn } = require('child_process');
const path = require('path');

const tsxPath = path.resolve(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverPath = path.resolve(__dirname, '..', 'server.ts');

const proc = spawn(process.execPath, [tsxPath, serverPath], {
  env: { ...process.env, PORT: '3009' },
  cwd: path.resolve(__dirname, '..'),
});

proc.stdout.on('data', d => console.log('[OUT]', d.toString()));
proc.stderr.on('data', d => console.log('[ERR]', d.toString()));

setTimeout(() => {
  proc.kill();
  process.exit(0);
}, 8000);

