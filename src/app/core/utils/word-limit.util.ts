import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const MAX_TEXT_WORDS = 200;

export function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function maxWordsValidator(max: number = MAX_TEXT_WORDS): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const count = countWords(String(control.value ?? ''));
    if (count > max) {
      return { maxWords: { max, actual: count } };
    }
    return null;
  };
}

export function isOverWordLimit(value: string, max: number = MAX_TEXT_WORDS): boolean {
  return countWords(value) > max;
}
