import { Injectable } from '@angular/core';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import en from '../../../assets/i18n/en.json';
import ge from '../../../assets/i18n/ge.json';
import ru from '../../../assets/i18n/ru.json';

const TRANSLATIONS: Record<string, TranslationObject> = {
  ru: ru as TranslationObject,
  en: en as TranslationObject,
  ge: ge as TranslationObject,
};

@Injectable()
export class InlineTranslateLoader implements TranslateLoader {
  getTranslation(lang: string): Observable<TranslationObject> {
    return of(TRANSLATIONS[lang] ?? TRANSLATIONS['ru']);
  }
}
