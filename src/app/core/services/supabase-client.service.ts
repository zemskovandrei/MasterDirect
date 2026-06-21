import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { logSupabaseError } from '../utils/supabase-error.util';
import { purgeLegacySupabaseAuthStorage, supabaseProjectRefFromUrl } from '../utils/supabase-auth-storage.util';

const NOT_CONFIGURED = 'Supabase не настроен. Укажите url и anonKey в environment.';

/** Единый провайдер SupabaseClient для AuthService, DataService и SupabaseService. */
@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly platformId = inject(PLATFORM_ID);

  private supabaseClient: SupabaseClient | null = null;
  private clientPromise: Promise<SupabaseClient | null> | null = null;

  isConfigured(): boolean {
    const { url, anonKey } = environment.supabase;
    if (!url?.trim() || !anonKey?.trim()) {
      return false;
    }

    if (url.includes('YOUR_SUPABASE') || anonKey.includes('YOUR_SUPABASE')) {
      return false;
    }

    if (/localhost|127\.0\.0\.1/i.test(url)) {
      return false;
    }

    const hasSupabaseHost = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url.trim());
    const hasPublicKey =
      anonKey.startsWith('eyJ') ||
      anonKey.startsWith('sb_publishable_') ||
      anonKey.startsWith('sb_');

    return hasSupabaseHost && hasPublicKey && anonKey.length > 20;
  }

  getClient(): Promise<SupabaseClient | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(null);
    }

    if (!this.isConfigured()) {
      logSupabaseError('SupabaseClientService', new Error(NOT_CONFIGURED));
      return Promise.resolve(null);
    }

    if (this.supabaseClient) {
      return Promise.resolve(this.supabaseClient);
    }

    if (!this.clientPromise) {
      const { url, anonKey } = environment.supabase;
      this.clientPromise = import('@supabase/supabase-js')
        .then(({ createClient }) => {
          purgeLegacySupabaseAuthStorage(supabaseProjectRefFromUrl(url));
          this.supabaseClient = createClient(url, anonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
              flowType: 'pkce',
            },
            global: {
              fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
            },
          });
          return this.supabaseClient;
        })
        .catch((err) => {
          logSupabaseError('SupabaseClientService.createClient', err);
          this.clientPromise = null;
          return null;
        });
    }

    return this.clientPromise;
  }
}
