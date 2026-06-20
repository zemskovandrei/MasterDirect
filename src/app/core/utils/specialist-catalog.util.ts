import type { Specialist, SpecialistAccountType } from '../models/database.models';

const VALID_ACCOUNT_TYPES: ReadonlySet<SpecialistAccountType> = new Set([
  'worker',
  'brigade',
  'furniture',
]);

/**
 * Тип карточки в каталоге (мастер / бригада / мебель).
 * Источник истины — только колонка `account_type`. Колонка `role` не используется.
 */
export function catalogAccountTypeFromSpecialistRow(
  row: { account_type?: SpecialistAccountType | null },
): SpecialistAccountType {
  const accountType = row.account_type?.trim() as SpecialistAccountType | undefined;
  if (accountType && VALID_ACCOUNT_TYPES.has(accountType)) {
    return accountType;
  }

  return 'worker';
}

export function isSpecialistAccountType(value: string | null | undefined): value is SpecialistAccountType {
  return !!value && VALID_ACCOUNT_TYPES.has(value.trim() as SpecialistAccountType);
}
