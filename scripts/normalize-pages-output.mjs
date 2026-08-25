import { access, copyFile, cp, rm, writeFile } from 'node:fs/promises';
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

const cnamePath = path.join(browserDir, 'CNAME');
if (!(await exists(cnamePath))) {
  await writeFile(cnamePath, 'masterdirect.ge\n');
}

const docsStaging = path.join(process.cwd(), 'dist', 'pro-remont', 'pages-docs');
const docsDir = path.join(browserDir, 'docs');
await rm(docsStaging, { recursive: true, force: true });
await rm(docsDir, { recursive: true, force: true });
await cp(browserDir, docsStaging, {
  recursive: true,
  filter: (src) => !src.split(path.sep).includes('.git'),
});
await cp(docsStaging, docsDir, { recursive: true });
await rm(docsStaging, { recursive: true, force: true });

console.log('[normalize-pages-output] Done:', {
  index: hasCsrIndex ? 'index.csr.html -> index.html' : 'index.html kept',
  fallback: 'index.html -> 404.html',
  docs: 'browser -> browser/docs (GitHub Pages /docs folder)',
});
