/** Одноразовая полная очистка каталога (бригады, мастера, мебель, отзывы, сессия). */
export const CATALOG_WIPE_VERSION = 'smartbuild-catalog-wipe-v5';

/** Одноразовая очистка только каталога мастеров. */
export const MASTERS_WIPE_VERSION = 'smartbuild-masters-wipe-v1';

const KEYS_TO_REMOVE = [
  'smartbuild-tech-performers',
  'smartbuild-tech-cabinet-session',
  'smartbuild-tech-furniture',
  'smartbuild-tech-furniture-session',
  'smartbuild-tech-reviews',
  'smartbuild-catalog-cleared-v1',
  'smartbuild-catalog-cleared-v2',
  'smartbuild-catalog-cleared-v3',
  'smartbuild-furniture-cleared-v1',
  'smartbuild-furniture-cleared-v2',
  'smartbuild-furniture-cleared-v3',
  'smartbuild-reviews-cleared-v1',
  'smartbuild-reviews-cleared-v2',
  // возможные старые ключи
  'pro-remont-performers',
  'pro-remont-cabinet-session',
  'pro-remont-furniture',
  'pro-remont-reviews',
];

export function shouldWipeCatalog(): boolean {
  return !localStorage.getItem(CATALOG_WIPE_VERSION);
}

export function wipeCatalogStorage(): void {
  for (const key of KEYS_TO_REMOVE) {
    localStorage.removeItem(key);
  }

  for (const key of Object.keys(localStorage)) {
    if (key.includes('-auth-token')) {
      localStorage.removeItem(key);
    }
  }

  localStorage.setItem(CATALOG_WIPE_VERSION, '1');
}

export function shouldWipeMasters(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return !localStorage.getItem(MASTERS_WIPE_VERSION);
}

export function markMastersWiped(): void {
  localStorage.setItem(MASTERS_WIPE_VERSION, '1');
}
