import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { APP_BASE_HREF } from '@angular/common';
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { APP_BASE_HREF_VALUE } from './core/config/base-href';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';

import { routes } from './app.routes';
import { InlineTranslateLoader } from './core/services/inline-translate.loader';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: APP_BASE_HREF, useValue: APP_BASE_HREF_VALUE },
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideRouter(
      routes,
      withHashLocation(),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }),
    ),
    provideHttpClient(withFetch()),
    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'ru',
        loader: {
          provide: TranslateLoader,
          useClass: InlineTranslateLoader,
        },
      }),
    ),
  ],
};
