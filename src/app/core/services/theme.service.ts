import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PortfolioStoreService } from './portfolio-store.service';
import { SupabaseService } from './supabase.service';

export type SiteTheme = 'light' | 'dark';

const THEME_KEY = 'theme';
const DEFAULT_PROFILE_HEADER_BG =
  'linear-gradient(155deg, #0a0f1a 0%, #121c32 40%, #0f2438 70%, #0c1222 100%)';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly supabase = inject(SupabaseService);

  readonly theme = signal<SiteTheme>('light');
  /** @deprecated Use `theme` instead. */
  readonly globalTheme = this.theme;
  readonly profileHeaderBg = signal<string>(DEFAULT_PROFILE_HEADER_BG);
  readonly profileThemeSaving = signal(false);

  constructor() {
    this.restoreTheme();
  }

  toggleTheme(): void {
    const next: SiteTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.applyTheme(next);
  }

  /** @deprecated Use `toggleTheme()` instead. */
  toggleGlobalTheme(): void {
    this.toggleTheme();
  }

  async setProfileTheme(color: string): Promise<void> {
    const normalized = this.normalizeColor(color);
    this.applyProfileHeaderBg(normalized);

    const currentMaster = this.portfolioStore.currentPerformer();
    if (!currentMaster || currentMaster.type !== 'worker') {
      return;
    }

    this.profileThemeSaving.set(true);
    try {
      this.portfolioStore.updatePerformerHeaderBg(currentMaster.id, normalized);
      const result = await this.supabase.updateMasterHeaderBg(currentMaster.id, normalized);
      if (result.error) {
        console.error('[ThemeService] setProfileTheme:', result.error);
      }
    } finally {
      this.profileThemeSaving.set(false);
    }
  }

  applyProfileHeaderBg(color: string): void {
    const normalized = this.normalizeColor(color);
    this.profileHeaderBg.set(normalized);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    document.documentElement.style.setProperty('--profile-header-bg', normalized);
  }

  resolveProfileHeaderBg(savedColor?: string | null): string {
    return savedColor?.trim() || DEFAULT_PROFILE_HEADER_BG;
  }

  private applyTheme(theme: SiteTheme, persist = true): void {
    this.theme.set(theme);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);

    if (persist) {
      localStorage.setItem(THEME_KEY, theme);
    }
  }

  private restoreTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    document.documentElement.style.setProperty('--profile-header-bg', DEFAULT_PROFILE_HEADER_BG);

    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') {
      this.applyTheme(saved, false);
      return;
    }

    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(prefersDark ? 'dark' : 'light', false);
  }

  private normalizeColor(color: string): string {
    const trimmed = color.trim();
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
      const hex = trimmed.slice(1);
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    return DEFAULT_PROFILE_HEADER_BG;
  }
}
