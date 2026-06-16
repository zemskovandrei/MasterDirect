import { AbstractControl, ValidationErrors } from '@angular/forms';

export const ORDER_FILE_ACCEPT = 'image/jpeg,image/png,application/pdf';
export const ORDER_FILE_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;

export function normalizeClientPhone(value: string): string {
  return value.replace(/[\s()-]/g, '');
}

export function clientPhoneValidator(control: AbstractControl): ValidationErrors | null {
  const raw = String(control.value ?? '').trim();
  if (!raw) {
    return { required: true };
  }

  const normalized = normalizeClientPhone(raw);
  if (!/^\+?\d+$/.test(normalized)) {
    return { phoneFormat: true };
  }

  const digits = normalized.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return { phoneLength: true };
  }

  return null;
}

export function orderFileValidator(control: AbstractControl): ValidationErrors | null {
  const file = control.value as File | null;
  if (!file) {
    return { required: true };
  }

  if (!ORDER_FILE_MIME_TYPES.includes(file.type as (typeof ORDER_FILE_MIME_TYPES)[number])) {
    return { invalidType: true };
  }

  return null;
}
