import { Component, HostListener, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AdminAuthService } from '../core/services/admin-auth.service';
import { SupabaseService } from '../core/services/supabase.service';
import { TranslationService } from '../core/services/translation.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';
import { AdminLoginModalComponent } from '../shared/components/admin-login-modal/admin-login-modal.component';

@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LanguageSwitcherComponent,
    AdminLoginModalComponent,
  ],
  templateUrl: './site-layout.component.html',
  styleUrls: ['./site-layout.component.css'],
})
export class SiteLayoutComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly adminAuth = inject(AdminAuthService);

  protected readonly title = signal('SmartBuild.Tech');
  protected readonly mobileMenuOpen = signal(false);
  protected readonly adminLoginOpen = signal(false);

  constructor() {
    afterNextRender(() => {
      this.supabase.prefetchActiveJobs();
    });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMobileMenu();
    this.closeAdminLogin();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      this.openAdminLogin();
    }
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

  prefetchJobs() {
    this.supabase.prefetchActiveJobs();
  }

  openAdminLogin() {
    this.adminLoginOpen.set(true);
  }

  closeAdminLogin() {
    this.adminLoginOpen.set(false);
  }
}
