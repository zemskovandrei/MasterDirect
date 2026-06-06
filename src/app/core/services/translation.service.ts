import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type Locale = 'ru' | 'en' | 'ge';

const LOCALE_KEY = 'smartbuild-tech-locale';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translate = inject(TranslateService);

  readonly locale = signal<Locale>('ru');

  constructor() {
    this.translate.setFallbackLang('ru');
    void this.setLocale(this.getSavedLocale());
  }

  t(key: string): string {
    this.locale();
    return this.translate.instant(key) || key;
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
