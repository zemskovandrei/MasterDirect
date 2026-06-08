import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import en from '../../../assets/i18n/en.json';
import ge from '../../../assets/i18n/ge.json';
import ru from '../../../assets/i18n/ru.json';
import extendedEn from '../../../assets/i18n/partials/extended-en.json';
import extendedGe from '../../../assets/i18n/partials/extended-ge.json';
import extendedRu from '../../../assets/i18n/partials/extended-ru.json';

function mergeTranslations(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(extra)) {
    const baseVal = result[key];
    const extraVal = extra[key];
    if (
      baseVal &&
      extraVal &&
      typeof baseVal === 'object' &&
      typeof extraVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(extraVal)
    ) {
      result[key] = mergeTranslations(
        baseVal as Record<string, unknown>,
        extraVal as Record<string, unknown>,
      );
    } else {
      result[key] = extraVal;
    }
  }
  return result;
}

export type Locale = 'ru' | 'en' | 'ge';

const LOCALE_KEY = 'smartbuild-tech-locale';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);

  readonly locale = signal<Locale>('ru');

  constructor() {
    this.translate.setFallbackLang('ru');
    this.translate.setTranslation('ru', mergeTranslations(ru, extendedRu) as typeof ru);
    this.translate.setTranslation('en', mergeTranslations(en, extendedEn) as typeof en);
    this.translate.setTranslation('ge', mergeTranslations(ge, extendedGe) as typeof ge);
    void this.setLocale(this.getSavedLocale());
  }

  t(key: string): string {
    this.locale();
    const value = this.translate.instant(key);
    if (typeof value === 'string' && value && value !== key) {
      return value;
    }
    return key;
  }

  tArray(key: string): string[] {
    this.locale();
    const value = this.translate.instant(key);
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }

  async setLocale(next: Locale): Promise<void> {
    await firstValueFrom(this.translate.use(next));
    this.locale.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(LOCALE_KEY, next);
    }
  }

  private getSavedLocale(): Locale {
    if (!isPlatformBrowser(this.platformId)) {
      return 'ru';
    }
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'ru' || saved === 'en' || saved === 'ge') {
      return saved;
    }
    return 'ru';
  }
}
