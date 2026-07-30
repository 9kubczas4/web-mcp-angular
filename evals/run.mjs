/**
 * Single entry for WebMCP evals.
 *
 * Default (no args): run products + cart + negative suites via webmcp-evals local.
 * Pass-through: `node evals/run.mjs local|browser …` still forwards to the CLI.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) {
    return;
  }
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Process killed by ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Exit code ${code}`));
        return;
      }
      resolvePromise();
    });
  });
}

loadDotEnv(resolve(process.cwd(), '.env'));

const require = createRequire(import.meta.url);
const bin = require.resolve('webmcp-evals/dist/bin/webmcp-evals.js');
const schema = 'evals/schemas/products-route.tools.json';
const passthrough = process.argv.slice(2);

async function runDefaultSuite() {
  const suites = [
    ['products', 'evals/suites/products.evals.json'],
    ['cart', 'evals/suites/cart.evals.json'],
    ['negative', 'evals/suites/negative.evals.json'],
  ];

  for (const [name, evalsPath] of suites) {
    console.log(`\n── evals: ${name} ──\n`);
    await run(process.execPath, [
      bin,
      'local',
      '-b',
      'gemini',
      '-t',
      schema,
      '-e',
      evalsPath,
    ]);
  }
}

try {
  if (passthrough.length === 0) {
    await runDefaultSuite();
  } else {
    await run(process.execPath, [bin, ...passthrough]);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
