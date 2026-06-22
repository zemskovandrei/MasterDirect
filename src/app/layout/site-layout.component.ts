import {
  Component,
  HostListener,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AdminAuthService } from '../core/services/admin-auth.service';
import { APP_BRAND_NAME } from '../core/constants/brand';
import { AuthService } from '../core/services/auth.service';
import { FurnitureStoreService } from '../core/services/furniture-store.service';
import { PortfolioStoreService } from '../core/services/portfolio-store.service';
import { SupabaseService } from '../core/services/supabase.service';
import { CabinetSessionService } from '../core/services/cabinet-session.service';
import { TranslationService } from '../core/services/translation.service';
import { LanguageSwitcherComponent } from '../shared/components/language-switcher/language-switcher.component';
import { AdminLoginModalComponent } from '../shared/components/admin-login-modal/admin-login-modal.component';
import { logSupabaseError } from '../core/utils/supabase-error.util';

type HeaderTheme = 'auto' | 'light' | 'dark';

const HEADER_THEME_KEY = 'headerTheme';
const HEADER_THEME_CYCLE: HeaderTheme[] = ['auto', 'light', 'dark'];

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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./site-layout.component.css'],
})
export class SiteLayoutComponent {
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);
  private readonly cabinetSession = inject(CabinetSessionService);
  protected readonly translation = inject(TranslationService);
  protected readonly adminAuth = inject(AdminAuthService);

  headerTheme: HeaderTheme = 'auto';

  protected readonly title = signal(APP_BRAND_NAME);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly adminLoginOpen = signal(false);

  protected readonly isLoggedIn = computed(
    () =>
      !!this.auth.user() ||
      !!this.portfolioStore.currentPerformer() ||
      !!this.furnitureStore.currentCompany(),
  );

  protected readonly profileRoute = computed(() => '/cabinet');

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
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem(HEADER_THEME_KEY);
      if (saved === 'auto' || saved === 'light' || saved === 'dark') {
        this.headerTheme = saved;
      }
    }

    afterNextRender(() => {
      this.supabase.prefetchActiveJobs();
      this.supabase.ensureProfilesLoaded().subscribe({
        next: () => {
          void this.cabinetSession.restoreForCurrentUser();
        },
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

  cycleHeaderTheme(): void {
    const currentIndex = HEADER_THEME_CYCLE.indexOf(this.headerTheme);
    this.headerTheme = HEADER_THEME_CYCLE[(currentIndex + 1) % HEADER_THEME_CYCLE.length];

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(HEADER_THEME_KEY, this.headerTheme);
    }
  }

  headerThemeToggleLabel(): string {
    if (this.headerTheme === 'light') {
      return this.translation.t('app.actions.headerThemeLight');
    }
    if (this.headerTheme === 'dark') {
      return this.translation.t('app.actions.headerThemeDark');
    }
    return this.translation.t('app.actions.headerThemeAuto');
  }

  prefetchJobs() {
    this.supabase.prefetchActiveJobs();
  }

  protected isNavCatalogActive(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return ['/portfolio', '/brigades', '/masters', '/furniture'].some(
      (segment) => path === segment || path.startsWith(`${segment}/`),
    );
  }

  protected isNavFeaturesActive(): boolean {
    return this.router.url.includes('#features');
  }

  protected isNavGalleryActive(): boolean {
    return this.router.url.includes('#catalog');
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
