export type BotFlow = 'menu' | 'master' | 'job' | 'review';

export type BotStep =
  | 'menu'
  // master catalog
  | 'name'
  | 'phone'
  | 'specialty'
  | 'city'
  | 'district'
  | 'photos'
  | 'confirm'
  // client job
  | 'job_name'
  | 'job_phone'
  | 'job_city'
  | 'job_category'
  | 'job_description'
  | 'job_budget'
  | 'job_photos'
  | 'job_confirm'
  // review
  | 'review_name'
  | 'review_kind'
  | 'review_text'
  | 'review_confirm';

export type CityId = 'batumi' | 'tbilisi';

export type ReviewKind = 'review' | 'site';

export interface BotPhoto {
  fileId: string;
  fileUniqueId: string;
}

export interface BotVideo {
  fileId: string;
  fileUniqueId: string;
  fileName?: string;
}

export interface BotSession {
  flow: BotFlow;
  step: BotStep;
  name?: string;
  phone?: string;
  specialties: string[];
  city?: CityId;
  district?: string;
  photos: BotPhoto[];
  videos: BotVideo[];
  tgUsername?: string | null;
  /** Client job */
  category?: string;
  description?: string;
  budget?: number | null;
  /** Review */
  reviewKind?: ReviewKind;
  reviewText?: string;
}

export const SPECIALTY_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'tiler', label: 'Плитка' },
  { key: 'plumber', label: 'Сантехника' },
  { key: 'electrician', label: 'Электрика' },
  { key: 'painter', label: 'Отделка' },
  { key: 'drywall', label: 'Гипсокартон' },
  { key: 'turnkey', label: 'Под ключ' },
  { key: 'furnitureAssembly', label: 'Сборка мебели' },
  { key: 'kitchenInstall', label: 'Кухни' },
  { key: 'cabinetMaking', label: 'Корпусная мебель' },
];

export const CITY_OPTIONS: Array<{ key: CityId; label: string }> = [
  { key: 'batumi', label: 'Батуми' },
  { key: 'tbilisi', label: 'Тбилиси' },
];

export const MAX_PHOTOS = 5;
export const MIN_PHOTOS = 1;
export const MAX_VIDEOS = 3;
export const MAX_JOB_PHOTOS = 3;
export const MIN_JOB_PHOTOS = 0;
export const MAX_JOB_VIDEOS = 2;
export const MIN_REVIEW_CHARS = 20;

export const SITE_FEEDBACK_TEXT_PREFIX = '【site-feedback】';

export function createEmptySession(tgUsername?: string | null): BotSession {
  return {
    flow: 'menu',
    step: 'menu',
    specialties: [],
    photos: [],
    videos: [],
    tgUsername: tgUsername?.trim() || null,
    budget: null,
  };
}

export function startMasterSession(tgUsername?: string | null): BotSession {
  return {
    ...createEmptySession(tgUsername),
    flow: 'master',
    step: 'name',
  };
}

export function startJobSession(tgUsername?: string | null): BotSession {
  return {
    ...createEmptySession(tgUsername),
    flow: 'job',
    // Сначала суть заказа, контакты — в конце (логичнее для клиента).
    step: 'job_city',
  };
}

export function startReviewSession(tgUsername?: string | null): BotSession {
  return {
    ...createEmptySession(tgUsername),
    flow: 'review',
    step: 'review_name',
  };
}

export function specialtyLabels(keys: string[]): string {
  return keys
    .map((key) => SPECIALTY_OPTIONS.find((item) => item.key === key)?.label ?? key)
    .join(', ');
}

export function specialtyLabel(key: string): string {
  return SPECIALTY_OPTIONS.find((item) => item.key === key)?.label ?? key;
}

export function cityLabel(city: CityId): string {
  return CITY_OPTIONS.find((item) => item.key === city)?.label ?? city;
}
