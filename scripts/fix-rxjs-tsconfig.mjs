import { readFile, writeFile } from 'node:fs/promises';

const rxjsTsconfigPath = new URL('../node_modules/rxjs/tsconfig.json', import.meta.url);

async function fixRxjsTsconfig() {
  let raw;
  try {
    raw = await readFile(rxjsTsconfigPath, 'utf8');
  } catch {
    // Skip silently when rxjs is not installed yet.
    return;
  }

  const config = JSON.parse(raw);
  const compilerOptions = (config.compilerOptions ??= {});

  compilerOptions.ignoreDeprecations = '6.0';
  compilerOptions.forceConsistentCasingInFileNames = true;

  if (compilerOptions.moduleResolution === 'Node16') {
    compilerOptions.moduleResolution = 'node';
  }

  if (compilerOptions.module) {
    delete compilerOptions.module;
  }

  await writeFile(rxjsTsconfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

fixRxjsTsconfig().catch((error) => {
  console.error('Failed to patch rxjs tsconfig:', error);
  process.exitCode = 1;
});
