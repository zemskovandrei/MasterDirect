import type { SpecialistAccountType } from '../models/database.models';
import type { MasterRow } from '../models/master.model';

/** Значения колонки `role` (pro_role при регистрации). */
export const BRIGADE_PRO_ROLES = ['brigade', 'builder', 'company'] as const;
export const WORKER_PRO_ROLES = ['master'] as const;
export const FURNITURE_PRO_ROLES = ['furniture_maker'] as const;

/**
 * Тип карточки в каталоге (мастер / бригада / мебель).
 * Источник истины: `account_type`. Колонка `role` — только fallback.
 */
export function catalogAccountTypeFromSpecialistRow(
  row: Pick<MasterRow, 'account_type' | 'role'>,
): SpecialistAccountType {
  const accountType = row.account_type?.trim();
  if (accountType === 'worker' || accountType === 'brigade' || accountType === 'furniture') {
    return accountType;
  }

  const role = row.role?.trim().toLowerCase() ?? '';
  if ((FURNITURE_PRO_ROLES as readonly string[]).includes(role)) {
    return 'furniture';
  }
  if ((BRIGADE_PRO_ROLES as readonly string[]).includes(role)) {
    return 'brigade';
  }
  return 'worker';
}

/** Pro-roles для `.in('role', …)` когда нет колонки `account_type`. */
export function proRolesForCatalogAccountType(accountType: SpecialistAccountType): string[] {
  switch (accountType) {
    case 'brigade':
      return [...BRIGADE_PRO_ROLES];
    case 'furniture':
      return [...FURNITURE_PRO_ROLES];
    case 'worker':
    default:
      return [...WORKER_PRO_ROLES];
  }
}
