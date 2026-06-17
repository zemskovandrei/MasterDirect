import type { AccountType } from '../../core/models/portfolio.models';

export const PRO_ROLES = [
  'builder',
  'master',
  'brigade',
  'furniture_maker',
  'company',
  'customer',
] as const;

export type ProRole = (typeof PRO_ROLES)[number];

export const PRO_ROLE_ICONS: Record<ProRole, string> = {
  builder: '🏗️',
  master: '🔨',
  brigade: '👷',
  furniture_maker: '🪚',
  company: '🏢',
  customer: '💼',
};

export const SPECIALTY_KEYS = [
  'tiler',
  'electrician',
  'plumber',
  'painter',
  'drywall',
  'turnkey',
  'renovation_turnkey',
  'furnitureAssembly',
  'kitchenInstall',
  'cabinetMaking',
  'commercialInstall',
] as const;

export type SpecialtyKey = (typeof SPECIALTY_KEYS)[number];

export const EXPERIENCE_KEYS = ['exp_0_1', 'exp_1_3', 'exp_3_5', 'exp_5_10', 'exp_10_plus'] as const;

export type ExperienceKey = (typeof EXPERIENCE_KEYS)[number];

export const CITY_IDS = ['batumi', 'tbilisi'] as const;

export type CityId = (typeof CITY_IDS)[number];

export function isExecutorRole(role: ProRole): boolean {
  return role !== 'customer';
}

export function mapProRoleToAccountType(role: ProRole): AccountType | null {
  switch (role) {
    case 'builder':
    case 'brigade':
    case 'company':
      return 'brigade';
    case 'master':
      return 'worker';
    case 'furniture_maker':
      return 'furniture';
    case 'customer':
      return null;
    default:
      return 'worker';
  }
}

export function defaultSpecialtyForRole(role: ProRole): SpecialtyKey {
  switch (role) {
    case 'builder':
    case 'brigade':
    case 'company':
      return 'renovation_turnkey';
    case 'furniture_maker':
      return 'commercialInstall';
    case 'master':
      return 'electrician';
    default:
      return 'electrician';
  }
}
