import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { ThemeService } from '../../core/services/theme.service';
import { PerformerType } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';

@Component({
  selector: 'app-performer-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent, SocialLinksComponent],
  templateUrl: './performer-profile.component.html',
  styleUrls: ['./performer-profile.component.css'],
})
export class PerformerProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PortfolioStoreService);
  private readonly supabase = inject(SupabaseService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly theme = inject(ThemeService);
  protected readonly hasSocialLinks = hasSocialLinks;

  protected readonly headerColor = signal('#0c7489');

  protected readonly type = toSignal(
    this.route.data.pipe(map((d) => d['performerType'] as PerformerType)),
    { initialValue: 'brigade' as PerformerType },
  );

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly performer = computed(() => {
    const type = this.type();
    const id = this.id();
    if (!type || !id) {
      return undefined;
    }

    const local = this.store.getPerformer(type, id);
    if (local) {
      return local;
    }

    const catalog = type === 'brigade' ? this.supabase.brigades() : this.supabase.workers();
    return catalog.find((item) => item.id === id);
  });

  protected readonly isProfileOwner = computed(() => {
    const performer = this.performer();
    const current = this.store.currentPerformer();
    return !!performer && !!current && performer.id === current.id;
  });

  protected readonly showThemeSettings = computed(
    () => this.isProfileOwner() && this.type() === 'worker',
  );

  protected readonly profileHeaderBg = computed(() =>
    this.theme.resolveProfileHeaderBg(this.performer()?.headerBg),
  );

  protected readonly relevantReviews = computed(() => {
    const performer = this.performer();
    if (!performer) {
      return [];
    }

    return this.reviewStore.approvedReviews().filter(
      (review) => review.performerId === performer.id,
    );
  });

  protected readonly heroImage = computed(() => {
    const performer = this.performer();
    return performer?.works[0]?.afterImage ?? null;
  });

  protected readonly typeIcon = computed(() =>
    this.type() === 'brigade' ? '👷' : '🔧',
  );

  constructor() {
    effect(() => {
      const performer = this.performer();
      if (!performer?.headerBg) {
        return;
      }
      this.headerColor.set(this.toColorInputValue(performer.headerBg));
    });
  }

  protected typeLabel(): string {
    return this.type() === 'brigade'
      ? this.translation.t('profile.badgeBrigade')
      : this.translation.t('profile.badgeMaster');
  }

  protected catalogLink(): string {
    return this.type() === 'brigade' ? '/brigades' : '/masters';
  }

  protected globalThemeLabel(): string {
    return this.theme.theme() === 'light'
      ? this.translation.t('profile.theme.night')
      : this.translation.t('profile.theme.day');
  }

  protected async onHeaderColorChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.headerColor.set(value);
    await this.theme.setProfileTheme(value);
  }

  protected toggleGlobalTheme() {
    this.theme.toggleTheme();
  }

  private toColorInputValue(color: string): string {
    const trimmed = color.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
      return trimmed.toLowerCase();
    }
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
      const hex = trimmed.slice(1);
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
    }
    return '#0c7489';
  }
}
