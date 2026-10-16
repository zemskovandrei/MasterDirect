export type BotStep =
  | 'name'
  | 'phone'
  | 'specialty'
  | 'city'
  | 'district'
  | 'photos'
  | 'confirm';

export type CityId = 'batumi' | 'tbilisi';

export interface BotPhoto {
  fileId: string;
  fileUniqueId: string;
}

export interface BotSession {
  step: BotStep;
  name?: string;
  phone?: string;
  specialties: string[];
  city?: CityId;
  district?: string;
  photos: BotPhoto[];
  tgUsername?: string | null;
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

export function createEmptySession(tgUsername?: string | null): BotSession {
  return {
    step: 'name',
    specialties: [],
    photos: [],
    tgUsername: tgUsername?.trim() || null,
  };
}

export function specialtyLabels(keys: string[]): string {
  return keys
    .map((key) => SPECIALTY_OPTIONS.find((item) => item.key === key)?.label ?? key)
    .join(', ');
}

export function cityLabel(city: CityId): string {
  return CITY_OPTIONS.find((item) => item.key === city)?.label ?? city;
}
