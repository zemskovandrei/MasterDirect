import { access, copyFile, cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
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

/** Nested prerender pages like /cabinet/ must load /main-….js, not /cabinet/main-….js. */
const toRootAbsoluteAssetRefs = (html) =>
  html
    .replace(
      /(<(?:script|link)\b[^>]*\b(?:src|href)=")(?!\/|https?:|data:|#)([^"]+)(")/gi,
      '$1/$2$3',
    )
    .replace(/<base\s+href="\/"[^>]*>/i, '<base href="/">');

const rewriteHtmlFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'docs' || entry.name === 'assets') {
        continue;
      }
      await rewriteHtmlFiles(fullPath);
      continue;
    }
    if (!entry.name.endsWith('.html')) {
      continue;
    }
    const original = await readFile(fullPath, 'utf8');
    const next = toRootAbsoluteAssetRefs(original);
    if (next !== original) {
      await writeFile(fullPath, next);
    }
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

await rewriteHtmlFiles(browserDir);

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
  assets: 'relative script/link hrefs -> root-absolute',
  docs: 'browser -> browser/docs (GitHub Pages /docs folder)',
});
