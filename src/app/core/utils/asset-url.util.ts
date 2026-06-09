/** Resolves asset path against Angular base href (/, /smartbuild-tech/, etc.). */
export function resolveAssetUrl(path: string, baseHref = '/'): string {
  const normalized = path.replace(/^\//, '');
  const base = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
  return `${base}${normalized}`;
}
