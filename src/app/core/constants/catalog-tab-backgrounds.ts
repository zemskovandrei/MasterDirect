export const CATALOG_TAB_BACKGROUNDS = {
  workers:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200',
  brigade:
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200',
  furniture:
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1200',
  jobs:
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1200',
  reviews:
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200',
  calculator:
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1200',
  cabinetWorker:
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?q=80&w=1200',
  cabinetBrigade:
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1200',
  cabinetFurniture:
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1200',
} as const;

/** Modern home at golden hour — Unsplash / Erik Mclean */
export const HOME_HERO_BACKGROUND =
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1920';

export type CatalogTabBackgroundKey = keyof typeof CATALOG_TAB_BACKGROUNDS;

export type CabinetTabBackgroundKey = 'cabinetWorker' | 'cabinetBrigade' | 'cabinetFurniture';

export function homeHeroBackgroundStyle(): Record<string, string> {
  return {
    backgroundColor: '#0c1222',
    backgroundImage: `url('${HOME_HERO_BACKGROUND}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  };
}

export function catalogTabBackgroundStyle(
  key: CatalogTabBackgroundKey,
): Record<string, string> {
  const photoUrl = CATALOG_TAB_BACKGROUNDS[key];
  return {
    background: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url('${photoUrl}') no-repeat center/cover`,
  };
}

export function cabinetTabBackgroundStyle(key: CabinetTabBackgroundKey): Record<string, string> {
  const photoUrl = CATALOG_TAB_BACKGROUNDS[key];
  return {
    backgroundColor: '#0f172a',
    backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.3)), url("${photoUrl}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  };
}
