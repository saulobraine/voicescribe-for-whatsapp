import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const isWatchMode = process.argv.includes('--watch');

const entryPoints = [
  { in: 'src/background/index.ts', out: 'background' },
  { in: 'src/content/index.ts', out: 'content' },
  { in: 'src/interceptor/index.ts', out: 'interceptor' },
  { in: 'src/popup/index.ts', out: 'popup' },
  { in: 'src/admin/index.ts', out: 'admin' },
];

function copyStaticFiles(): void {
  if (!fs.existsSync('build')) {
    fs.mkdirSync('build', { recursive: true });
  }

  const staticFiles = ['manifest.json', 'popup.html', 'admin.html'];
  for (const file of staticFiles) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join('build', file));
    }
  }

  if (fs.existsSync('icons')) {
    fs.cpSync('icons', path.join('build', 'icons'), { recursive: true });
  }
}

async function runBuild(): Promise<void> {
  copyStaticFiles();

  const context = await esbuild.context({
    bundle: true,
    format: 'iife',
    target: 'es2022',
    sourcemap: false,
    logLevel: 'info',
    entryPoints,
    outdir: 'build',
    entryNames: '[name]',
  });

  if (isWatchMode) {
    console.log('Iniciando modo watch (saída em ./build)...');
    await context.watch();
    return;
  }

  await context.rebuild();
  await context.dispose();
  console.log('Build em TypeScript concluído com sucesso em ./build');
}

runBuild().catch((error: unknown) => {
  console.error('Falha no processo de compilação:', error);
  process.exit(1);
});
