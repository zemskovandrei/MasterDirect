export const CATALOG_TAB_BACKGROUNDS = {
  workers:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1200',
  brigade:
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1200',
  furniture:
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1200',
  jobs:
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920',
  reviews:
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=1200',
  catalogHub:
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1920',
  calculator:
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1920',
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

/** Фото фона для каждого шага калькулятора «Оставить заказ». */
export const CALCULATOR_STEP_BACKGROUNDS = {
  /** 1 — тип помещения */
  1: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1920',
  /** 2 — тип ремонта */
  2: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1920',
  /** 3 — площадь */
  3: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920',
  /** 4 — чек-лист работ */
  4: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1920',
  /** 5 — выбор исполнителей */
  5: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1920',
  /** 6 — контакты */
  6: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1920',
  /** заявка отправлена */
  success: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?q=80&w=1920',
} as const;

const CALCULATOR_STEP_POSITION: Record<keyof typeof CALCULATOR_STEP_BACKGROUNDS, string> = {
  1: 'center center',
  2: 'center 30%',
  3: 'center center',
  4: 'center 40%',
  5: 'center top',
  6: 'center 55%',
  success: 'center center',
};

/** Светлый оверлей + фото для текущего шага калькулятора. */
export function calculatorStepBackgroundStyle(
  step: number,
  options?: { submitted?: boolean },
): Record<string, string> {
  const stepKey = options?.submitted
    ? 'success'
    : (Math.min(6, Math.max(1, Math.trunc(step))) as 1 | 2 | 3 | 4 | 5 | 6);
  const photoUrl = CALCULATOR_STEP_BACKGROUNDS[stepKey];
  const position = CALCULATOR_STEP_POSITION[stepKey];

  return {
    backgroundColor: '#e8eef4',
    backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 250, 252, 0.62) 50%, rgba(236, 242, 248, 0.72) 100%), url('${photoUrl}')`,
    backgroundSize: 'cover',
    backgroundPosition: position,
    backgroundRepeat: 'no-repeat',
  };
}

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

export type ReviewPageFormMode = 'review' | 'recommendation' | 'siteFeedback';
export type ReviewPageCategory = 'brigade' | 'master' | 'furniture' | 'renovation';

/** Уникальные фото только для /reviews — не пересекаются с CATALOG_TAB_BACKGROUNDS. */
export const REVIEWS_PAGE_BACKGROUNDS: Record<
  ReviewPageFormMode,
  Record<ReviewPageCategory, string>
> = {
  review: {
    brigade:
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=1920',
    master:
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=1920',
    furniture:
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=1920',
    renovation:
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=1920',
  },
  recommendation: {
    brigade:
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=1920',
    master:
      'https://images.unsplash.com/photo-1581092921461-eab62e97a780?q=80&w=1920',
    furniture:
      'https://images.unsplash.com/photo-1556911220-bff31c812dba?q=80&w=1920',
    renovation:
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=1920',
  },
  siteFeedback: {
    brigade:
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1920',
    master:
      'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1920',
    furniture:
      'https://images.unsplash.com/photo-1493666438817-866a91353ca9?q=80&w=1920',
    renovation:
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?q=80&w=1920',
  },
};

const REVIEWS_PAGE_POSITION: Record<ReviewPageCategory, string> = {
  brigade: 'center 30%',
  master: 'center 45%',
  furniture: 'center center',
  renovation: 'center 50%',
};

/** Фон страницы отзывов: спокойное интерьерное фото с тёмным оверлеем. */
export function reviewsPageShellStyle(): Record<string, string> {
  const photoUrl = 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=1920';
  return {
    backgroundColor: '#141c28',
    backgroundImage: `linear-gradient(180deg, rgba(20, 28, 40, 0.72) 0%, rgba(20, 28, 40, 0.56) 45%, rgba(20, 28, 40, 0.78) 100%), url('${photoUrl}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  };
}

/** Фото для боковой hero-панели формы — уникально для каждой вкладки. */
export function reviewsHeroVisualStyle(
  mode: ReviewPageFormMode,
  category: ReviewPageCategory,
): Record<string, string> {
  const photoUrl = REVIEWS_PAGE_BACKGROUNDS[mode][category];
  const position = REVIEWS_PAGE_POSITION[category];

  return {
    backgroundImage: `linear-gradient(180deg, rgba(8, 15, 30, 0.08) 0%, rgba(8, 15, 30, 0.78) 100%), url('${photoUrl}')`,
    backgroundSize: 'cover',
    backgroundPosition: position,
    backgroundRepeat: 'no-repeat',
  };
}

export type CabinetTabBackgroundKey = 'cabinetWorker' | 'cabinetBrigade' | 'cabinetFurniture';

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
