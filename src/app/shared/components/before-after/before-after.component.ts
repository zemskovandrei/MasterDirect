import { Component, computed, inject, input, signal } from '@angular/core';
import { WorkProject } from '../../../core/models/portfolio.models';
import { CatalogLocalizationService } from '../../../core/services/catalog-localization.service';
import { TranslationService } from '../../../core/services/translation.service';

interface VerificationBadge {
  label: string;
  icon: string;
  className: string;
}

export type BeforeAfterLayout = 'compare' | 'split';

@Component({
  selector: 'app-before-after',
  standalone: true,
  templateUrl: './before-after.component.html',
  styleUrls: ['./before-after.component.css'],
})
export class BeforeAfterComponent {
  protected readonly translation = inject(TranslationService);
  private readonly catalogL10n = inject(CatalogLocalizationService);

  readonly work = input.required<WorkProject>();
  readonly layout = input<BeforeAfterLayout>('compare');
  readonly featured = input(false);
  readonly titleOverride = input<string | null>(null);
  readonly descriptionOverride = input<string | null>(null);

  protected displayTitle(): string {
    return this.titleOverride() ?? this.catalogL10n.workTitle(this.work());
  }

  protected displayDescription(): string | undefined {
    const override = this.descriptionOverride();
    if (override !== null && override !== undefined) {
      return override;
    }
    const desc = this.catalogL10n.workDescription(this.work());
    return desc || undefined;
  }

  protected readonly verificationBadge = computed((): VerificationBadge | null => {
    this.translation.locale();
    const status = this.work().verificationStatus ?? 'not_requested';
    switch (status) {
      case 'pending':
        return {
          label: this.translation.t('beforeAfter.verifyPending'),
          icon: '⏳',
          className: 'work-verify-badge work-verify-badge--pending',
        };
      case 'verified':
        return {
          label: this.translation.t('beforeAfter.verifyVerified'),
          icon: '🛡',
          className: 'work-verify-badge work-verify-badge--verified',
        };
      case 'rejected':
        return {
          label: this.translation.t('beforeAfter.verifyRejected'),
          icon: '✕',
          className: 'work-verify-badge work-verify-badge--rejected',
        };
      default:
        return null;
    }
  });

  protected readonly sliderPos = signal(50);

  onSliderInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.sliderPos.set(value);
  }
}
