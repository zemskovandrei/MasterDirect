import { Component, computed, inject, input, signal, ChangeDetectionStrategy } from '@angular/core';
import { WORK_VERIFICATION_ENABLED } from '../../../core/constants/features';
import { isAlbumWork, resolveAlbumImages, WorkProject } from '../../../core/models/portfolio.models';
import { CatalogLocalizationService } from '../../../core/services/catalog-localization.service';
import { TranslationService } from '../../../core/services/translation.service';

interface VerificationBadge {
  label: string;
  icon: string;
  className: string;
}

@Component({
  selector: 'app-before-after',
  standalone: true,
  templateUrl: './before-after.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./before-after.component.css'],
})
export class BeforeAfterComponent {
  protected readonly translation = inject(TranslationService);
  private readonly catalogL10n = inject(CatalogLocalizationService);

  readonly work = input.required<WorkProject>();
  readonly featured = input(false);
  readonly showCaption = input(true);
  readonly titleOverride = input<string | null>(null);
  readonly descriptionOverride = input<string | null>(null);

  protected readonly albumIndex = signal(0);

  protected readonly isAlbum = computed(() => isAlbumWork(this.work()));

  protected readonly albumImages = computed(() => resolveAlbumImages(this.work()));

  protected readonly activeAlbumImage = computed(() => {
    const images = this.albumImages();
    if (!images.length) {
      return null;
    }
    const index = Math.min(Math.max(this.albumIndex(), 0), images.length - 1);
    return images[index] ?? images[0];
  });

  protected selectAlbumImage(index: number): void {
    this.albumIndex.set(index);
  }

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
    if (!WORK_VERIFICATION_ENABLED) {
      return null;
    }
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
}
