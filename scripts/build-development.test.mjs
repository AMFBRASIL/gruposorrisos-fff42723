import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptUrl = new URL('./build-development.mjs', import.meta.url);
const source = readFileSync(scriptUrl, 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replaceAll('import.meta.url', 'scriptUrl');

function simulate(result) {
  let invocation;
  let exitStatus;
  runInNewContext(source, {
    scriptUrl: scriptUrl.href,
    URL,
    fileURLToPath,
    console: { error() {} },
    process: {
      execPath: '/usr/bin/node',
      argv: ['node', 'build-development.mjs', '--config', '.lovable/preview-supabase.config.ts'],
      env: {},
      exit(status) { exitStatus = status; },
    },
    spawnSync(command, args, options) {
      invocation = { command, args: Array.from(args), options };
      return result;
    },
  });
  return { invocation, exitStatus };
}

test('preview config cannot replace the TanStack build configuration', () => {
  const { invocation, exitStatus } = simulate({ status: 0 });
  assert.equal(invocation.command, '/usr/bin/node');
  assert.deepEqual(invocation.args, [
    fileURLToPath(new URL('../node_modules/vite/bin/vite.js', scriptUrl)),
    'build', '--mode', 'development', '--config',
    fileURLToPath(new URL('../vite.config.ts', scriptUrl)),
  ]);
  assert.equal(invocation.options.cwd, fileURLToPath(new URL('../', scriptUrl)));
  assert.equal(exitStatus, 0);
});

test('failed builds and launch errors remain failures', () => {
  assert.equal(simulate({ status: 2 }).exitStatus, 2);
  assert.equal(simulate({ status: null, error: new Error('Launch failed') }).exitStatus, 1);
});