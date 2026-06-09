/** Путь к файлу в assets/ — браузер резолвит через <base href>. */
export function resolveAssetUrl(path: string): string {
  return path.replace(/^\//, '');
}
