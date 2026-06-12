import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly isAdminSignal = signal(false);

  readonly isAdmin = this.isAdminSignal.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.syncFromSession();
    }
  }

  async login(email: string, password: string): Promise<boolean> {
    const result = await this.auth.signIn(email, password);
    if (result.error || !result.user) {
      return false;
    }

    if (!this.isAdminUser(result.user)) {
      await this.auth.signOut();
      return false;
    }

    this.isAdminSignal.set(true);
    return true;
  }

  async logout(): Promise<void> {
    await this.auth.signOut();
    this.isAdminSignal.set(false);
  }

  private async syncFromSession(): Promise<void> {
    await this.auth.ensureInitialized();
    const user = await this.auth.getUser();
    this.isAdminSignal.set(this.isAdminUser(user));
  }

  private isAdminUser(user: User | null): boolean {
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
}
