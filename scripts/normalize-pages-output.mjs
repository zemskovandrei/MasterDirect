import { access, copyFile } from 'node:fs/promises';
import path from 'node:path';

const browserDir = path.join(process.cwd(), 'dist', 'pro-remont', 'browser');
const indexHtml = path.join(browserDir, 'index.html');
const indexCsrHtml = path.join(browserDir, 'index.csr.html');
const fallback404 = path.join(browserDir, '404.html');
const publicNoJekyll = path.join(process.cwd(), 'public', '.nojekyll');
const outputNoJekyll = path.join(browserDir, '.nojekyll');

const exists = async (filePath) => {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
};

const hasCsrIndex = await exists(indexCsrHtml);
if (hasCsrIndex) {
  await copyFile(indexCsrHtml, indexHtml);
}

await copyFile(indexHtml, fallback404);

if (await exists(publicNoJekyll)) {
  await copyFile(publicNoJekyll, outputNoJekyll);
}

console.log('[normalize-pages-output] Done:', {
  index: hasCsrIndex ? 'index.csr.html -> index.html' : 'index.html kept',
  fallback: 'index.html -> 404.html',
});
