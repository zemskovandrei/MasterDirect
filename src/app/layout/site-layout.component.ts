import { Component, HostListener, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslationService, type Locale } from '../core/services/translation.service';
import { AdminAuthService } from '../core/services/admin-auth.service';

@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './site-layout.component.html',
  styleUrls: ['./site-layout.component.css'],
})
export class SiteLayoutComponent {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly translation = inject(TranslationService);
  protected readonly adminAuth = inject(AdminAuthService);

  protected readonly title = signal('SmartBuild.Tech');
  protected readonly mobileMenuOpen = signal(false);

  protected readonly localeOptions: Locale[] = ['ru', 'en', 'ge'];

  protected getLocaleFlag(locale: Locale): string {
    switch (locale) {
      case 'ru':
        return '🇷🇺';
      case 'en':
        return '🇬🇧';
      case 'ge':
        return '🇬🇪';
    }
  }

  protected getLocaleInitials(locale: Locale): string {
    switch (locale) {
      case 'ru':
        return 'RU';
      case 'en':
        return 'EN';
      case 'ge':
        return 'GE';
    }
  }

  protected async selectLocale(locale: Locale) {
    await this.setLocale(locale);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMobileMenu();
  }

  async setLocale(next: Locale) {
    await this.translation.setLocale(next);
  }

  async onLocaleChange(value: string) {
    await this.setLocale(value as Locale);
  }

  toggleMobileMenu() {
    const next = !this.mobileMenuOpen();
    this.mobileMenuOpen.set(next);
    if (next) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }

  closeMobileMenu() {
    if (!this.mobileMenuOpen()) {
      return;
    }
    this.mobileMenuOpen.set(false);
    this.unlockBodyScroll();
  }

  private lockBodyScroll() {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.add('no-scroll');
    }
  }

  private unlockBodyScroll() {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('no-scroll');
    }
  }

  onNavClick() {
    this.closeMobileMenu();
  }
}
