import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

/** Отладка UI админки. Держите false в production. */
export const DEBUG_FORCE_ADMIN_UI = false;

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly isAdminSignal = signal(false);

  /** true только при входе администратора через Supabase Auth. */
  readonly isAdmin = computed(() =>
    DEBUG_FORCE_ADMIN_UI ? true : this.isAdminSignal(),
  );

  /** Кнопки редактирования/удаления — только для авторизованного админа. */
  readonly showAdminControls = this.isAdmin;

  private initPromise: Promise<void> | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initPromise = this.syncFromSession();

      effect(() => {
        void this.syncAdminState(this.auth.user());
      });
    }
  }

  /** Дождаться синхронизации сессии (нужно после F5, до загрузки заказов). */
  async ensureReady(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    const result = await this.auth.signIn(email, password);
    if (result.error || !result.user) {
      return false;
    }

    const isAdmin = await this.resolveIsAdminUser(result.user);
    this.isAdminSignal.set(isAdmin);

    if (!isAdmin) {
      await this.auth.signOut();
      return false;
    }

    return true;
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
  }

  private async syncFromSession(): Promise<void> {
    await this.auth.ensureInitialized();
    const user = await this.auth.getUser();
    await this.syncAdminState(user);
  }

  private isAdminUserByEmailOrMetadata(user: User | null): boolean {
    if (!user?.email) {
      return false;
    }

    const email = user.email.trim().toLowerCase();
    if (environment.supabase.adminEmails.some((item) => item.toLowerCase() === email)) {
      return true;
    }

    const appRole = user.app_metadata?.['role'];
    const userRole = user.user_metadata?.['role'];
    return appRole === 'admin' || userRole === 'admin';
  }

  private async syncAdminState(user: User | null): Promise<void> {
    const isAdmin = await this.resolveIsAdminUser(user);
    this.isAdminSignal.set(isAdmin);
  }

  private async resolveIsAdminUser(user: User | null): Promise<boolean> {
    if (!user) {
      return false;
    }

    if (this.isAdminUserByEmailOrMetadata(user)) {
      return true;
    }

    try {
      const client = await this.supabase.getClient();
      if (!client) {
        return false;
      }

      const { data, error } = await client
        .from(environment.supabase.specialistTable)
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        return false;
      }

      return String((data as { role?: string | null } | null)?.role ?? '').trim().toLowerCase() === 'admin';
    } catch {
      return false;
    }
  }
}
