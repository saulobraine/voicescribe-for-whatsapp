import esbuild from 'esbuild';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

async function runTests(): Promise<void> {
  const testFiles = fs
    .readdirSync('tests')
    .filter((file) => file.endsWith('.test.ts'))
    .map((file) => path.join('tests', file));

  await esbuild.build({
    entryPoints: testFiles,
    outdir: 'dist-test',
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
  });

  const child = spawn('node', ['--test', 'dist-test/**/*.test.js'], {
    stdio: 'inherit',
    shell: true,
  });

  child.on('close', (code: number | null) => {
    try {
      fs.rmSync('dist-test', { recursive: true, force: true });
    } catch {}
    process.exit(code || 0);
  });
}

runTests().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
