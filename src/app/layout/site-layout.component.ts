import {
  Component,
  HostListener,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AdminAuthService } from '../core/services/admin-auth.service';
import { AuthService } from '../core/services/auth.service';
import { FurnitureStoreService } from '../core/services/furniture-store.service';
import { PortfolioStoreService } from '../core/services/portfolio-store.service';
import { SupabaseService } from '../core/services/supabase.service';
import { TranslationService } from '../core/services/translation.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';
import { AdminLoginModalComponent } from '../shared/components/admin-login-modal/admin-login-modal.component';
import { logSupabaseError } from '../core/utils/supabase-error.util';

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
  private readonly auth = inject(AuthService);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly adminAuth = inject(AdminAuthService);

  protected readonly title = signal('SmartBuild.Tech');
  protected readonly mobileMenuOpen = signal(false);
  protected readonly adminLoginOpen = signal(false);

  protected readonly isLoggedIn = computed(
    () =>
      !!this.auth.user() ||
      !!this.portfolioStore.currentPerformer() ||
      !!this.furnitureStore.currentCompany(),
  );

  protected readonly profileRoute = computed(() =>
    this.adminAuth.isAdmin() ? '/admin' : '/cabinet',
  );

  protected readonly profileInitial = computed(() => {
    const user = this.auth.user();
    if (user) {
      const name = String(user.user_metadata?.['full_name'] ?? '').trim();
      if (name) {
        return name.charAt(0).toUpperCase();
      }
      const email = user.email?.trim();
      if (email) {
        return email.charAt(0).toUpperCase();
      }
    }

    const performer = this.portfolioStore.currentPerformer();
    if (performer?.name?.trim()) {
      return performer.name.trim().charAt(0).toUpperCase();
    }

    const company = this.furnitureStore.currentCompany();
    if (company?.name?.trim()) {
      return company.name.trim().charAt(0).toUpperCase();
    }

    return '';
  });

  private adminSecretTapCount = 0;
  private adminSecretTapTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    afterNextRender(() => {
      this.supabase.prefetchActiveJobs();
      this.supabase.loadProfiles().subscribe({
        error: (err) => logSupabaseError('SiteLayout.loadProfiles', err),
      });
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

  onAdminSecretTap(event: MouseEvent) {
    event.preventDefault();
    this.adminSecretTapCount += 1;

    if (this.adminSecretTapTimer) {
      clearTimeout(this.adminSecretTapTimer);
    }

    if (this.adminSecretTapCount >= 5) {
      this.adminSecretTapCount = 0;
      this.openAdminLogin();
      return;
    }

    this.adminSecretTapTimer = setTimeout(() => {
      this.adminSecretTapCount = 0;
    }, 2500);
  }

  adminLogout() {
    void this.adminAuth.logout();
    this.closeAdminLogin();
  }

  openAdminLogin() {
    this.adminLoginOpen.set(true);
  }

  closeAdminLogin() {
    this.adminLoginOpen.set(false);
  }
}
