import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The preview runner may append a SPA-only --config argument. TanStack Start
// must keep the project's plugin stack and generated client/server entries.
const root = fileURLToPath(new URL('../', import.meta.url));
const vite = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const result = spawnSync(process.execPath, [
  vite,
  'build',
  '--mode',
  'development',
  '--config',
  fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
], { cwd: root, env: process.env, stdio: 'inherit' });

if (result.error) {
  console.error(result.error);
}
process.exit(result.status ?? 1);