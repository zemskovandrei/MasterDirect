const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/** Возвращает UUID из значения колонки `id` или пустую строку. */
export function normalizeUuid(value: unknown): string {
  const text = value == null ? '' : String(value).trim();
  return isUuid(text) ? text : '';
}

export function buildFurnitureSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

  return slug ? `furniture-${slug}` : 'furniture-company';
}
