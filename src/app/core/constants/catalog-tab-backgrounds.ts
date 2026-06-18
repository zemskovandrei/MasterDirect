export const CATALOG_TAB_BACKGROUNDS = {
  workers:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200',
  brigade:
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200',
  furniture:
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1200',
  jobs:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1920',
  reviews:
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200',
  catalogHub:
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1920',
  calculator:
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1920',
  cabinetWorker:
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1920',
  cabinetBrigade:
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1920',
  cabinetFurniture:
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1920',
  /** Регистрация мастера — левая панель: ванная после ремонта. */
  cabinetRegisterMasterPromo:
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1920',
  /** Регистрация мастера — форма: мастер за работой. */
  cabinetRegisterMasterForm:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1920',
  /** Регистрация бригады — левая панель: стройка с высоты. */
  cabinetRegisterBrigadePromo:
    'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1920',
  /** Регистрация бригады — форма: инженер на объекте. */
  cabinetRegisterBrigadeForm:
    'https://images.unsplash.com/photo-1581094794329-cf1c4f5c8c2e?q=80&w=1920',
  /** Регистрация мебельщика — левая панель: интерьер. */
  cabinetRegisterFurniturePromo:
    'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=1920',
  /** Регистрация мебельщика — форма: мебель в интерьере. */
  cabinetRegisterFurnitureForm:
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1920',
  /** Вход — левая панель: дом в золотой час. */
  cabinetLoginPromo:
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1920',
  /** Вход — правая панель с формой: светлая гостиная. */
  cabinetLoginForm:
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1920',
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
    backgroundColor: '#0f172a',
    backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.52), rgba(15, 23, 42, 0.65)), url('${photoUrl}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'scroll',
  };
}

/** Светлый оверлей поверх фото — для секции «Оставить заказ» с белой формой. */
export function calculatorSectionBackgroundStyle(): Record<string, string> {
  const photoUrl = CATALOG_TAB_BACKGROUNDS.calculator;
  return {
    backgroundColor: '#f1f5f9',
    backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.93) 0%, rgba(248, 250, 252, 0.88) 55%, rgba(241, 245, 249, 0.9) 100%), url('${photoUrl}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'scroll',
  };
}

export function cabinetPageSurfaceStyle(): Record<string, string> {
  return {
    backgroundColor: '#f4f7fb',
  };
}

/** Фон левой промо-панели кабинета — фото роли с тёмным оверлеем. */
export function cabinetPromoBackgroundStyle(key: CabinetTabBackgroundKey): Record<string, string> {
  const photoUrl = CATALOG_TAB_BACKGROUNDS[key];
  return {
    backgroundColor: '#0c1222',
    backgroundImage: `linear-gradient(180deg, rgba(12, 18, 34, 0.45) 0%, rgba(12, 18, 34, 0.78) 100%), url('${photoUrl}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  };
}

export function cabinetTabBackgroundStyle(key: CabinetTabBackgroundKey): Record<string, string> {
  return cabinetPromoBackgroundStyle(key);
}
