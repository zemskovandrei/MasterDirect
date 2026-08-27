import { FurnitureCompany } from '../models/furniture.models';
import { Profile } from '../models/profile.models';
import { PerformerProfile } from '../models/portfolio.models';

function normalizeCityToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

/** Сопоставление города профиля с фильтром (batumi / tbilisi / both / Batumi). */
export function profileMatchesCatalogCity(
  profile: Pick<Profile, 'city'>,
  filterCity: string | null | undefined,
  filterEnabled: boolean,
): boolean {
  if (!filterEnabled) {
    return true;
  }

  const filter = filterCity?.trim();
  if (!filter || filter === 'both') {
    return true;
  }

  const profileCity = profile.city?.trim();
  if (!profileCity) {
    return true;
  }

  const normalizedFilter = normalizeCityToken(filter);
  const normalizedProfile = normalizeCityToken(profileCity);

  if (normalizedFilter === normalizedProfile) {
    return true;
  }

  if (normalizedFilter.includes(normalizedProfile) || normalizedProfile.includes(normalizedFilter)) {
    return true;
  }

  const aliases: Record<string, string[]> = {
    batumi: ['batumi', 'батumi', 'ბათუმი'],
    tbilisi: ['tbilisi', 'tbiisi', 'тбилиси', 'თბილისი'],
  };

  const filterAliases = aliases[normalizedFilter] ?? [normalizedFilter];
  return filterAliases.some(
    (alias) =>
      normalizedProfile === alias ||
      normalizedProfile.includes(alias) ||
      alias.includes(normalizedProfile),
  );
}

export function isCatalogPerformerVisible(performer: PerformerProfile): boolean {
  return !!(
    performer.name?.trim() ||
    performer.socialLinks?.phone?.trim() ||
    performer.whatsapp_phone?.trim()
  );
}

export function isCatalogFurnitureCompanyVisible(company: FurnitureCompany): boolean {
  return !!(company.name?.trim() || company.socialLinks?.phone?.trim() || company.whatsapp_phone?.trim());
}

export function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

const SPECIALTY_SEARCH_ALIASES: Record<string, string> = {
  tiler: 'плитка плиточник tiling tile',
  plumber: 'сантехника сантехник plumbing',
  electrician: 'электрика электрик electrical',
  painter: 'отделка маляр штукатур finishing',
  drywall: 'гипсокартон drywall отделка',
  turnkey: 'под ключ turnkey ремонт',
  renovation_turnkey: 'под ключ ремонт под ключ turnkey',
  furnitureAssembly: 'мебель сборка furniture',
  kitchenInstall: 'кухня мебель kitchen',
  cabinetMaking: 'мебель шкаф гардероб furniture',
  commercialInstall: 'мебель торговое оборудование furniture',
};

export function specialtySearchHaystack(raw: string, localized = ''): string {
  const extras = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .map((part) => SPECIALTY_SEARCH_ALIASES[part] ?? '')
    .join(' ');
  return `${raw} ${localized} ${extras}`;
}
