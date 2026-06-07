import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const ADMIN_SESSION_KEY = 'smartbuild-tech-admin-session';

/** Демо-пароль администратора (в продакшене — серверная авторизация) */
const DEMO_ADMIN_PASSWORD = 'smartbuild-admin';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isAdminSignal = signal(false);

  readonly isAdmin = this.isAdminSignal.asReadonly();

  constructor() {
    this.loadSession();
  }

  login(password: string): boolean {
    if (password.trim() !== DEMO_ADMIN_PASSWORD) {
      return false;
    }
    this.isAdminSignal.set(true);
    this.persist();
    return true;
  }

  logout(): void {
    this.isAdminSignal.set(false);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  private loadSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.isAdminSignal.set(localStorage.getItem(ADMIN_SESSION_KEY) === '1');
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(ADMIN_SESSION_KEY, '1');
  }
}
