import {
  Component,
  computed,
  inject,
  input,
  signal,
  ChangeDetectionStrategy,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  afterRenderEffect,
  viewChild,
  ElementRef,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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
export class BeforeAfterComponent implements OnDestroy {
  protected readonly translation = inject(TranslationService);
  private readonly catalogL10n = inject(CatalogLocalizationService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly work = input.required<WorkProject>();
  readonly featured = input(false);
  readonly showCaption = input(true);
  readonly titleOverride = input<string | null>(null);
  readonly descriptionOverride = input<string | null>(null);

  protected readonly albumIndex = signal(0);
  protected readonly lightboxOpen = signal(false);
  private readonly lightboxRoot = viewChild<ElementRef<HTMLElement>>('lightboxRoot');

  private touchStartX = 0;
  private touchStartY = 0;

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

  constructor() {
    // Escape overflow/transform ancestors so fullscreen overlay covers the viewport.
    afterRenderEffect(() => {
      if (!isPlatformBrowser(this.platformId) || !this.lightboxOpen()) {
        return;
      }
      const root = this.lightboxRoot()?.nativeElement;
      if (root && root.parentElement !== this.document.body) {
        this.document.body.appendChild(root);
      }
    });
  }

  ngOnDestroy(): void {
    this.detachLightboxFromBody();
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.lightboxOpen()) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeLightbox();
      return;
    }

    if (this.albumImages().length < 2) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.stepAlbum(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.stepAlbum(1);
    }
  }

  protected selectAlbumImage(index: number): void {
    this.albumIndex.set(index);
  }

  protected prevAlbumImage(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.stepAlbum(-1);
  }

  protected nextAlbumImage(event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.stepAlbum(1);
  }

  protected openLightbox(index?: number): void {
    if (!this.isAlbum()) {
      return;
    }
    if (typeof index === 'number') {
      this.albumIndex.set(index);
    }
    this.lightboxOpen.set(true);
    this.lockBodyScroll();
  }

  protected closeLightbox(): void {
    this.lightboxOpen.set(false);
    this.detachLightboxFromBody();
    this.unlockBodyScroll();
  }

  protected onAlbumTouchStart(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
  }

  protected onAlbumTouchEnd(event: TouchEvent): void {
    this.handleSwipe(event, false);
  }

  protected onLightboxTouchEnd(event: TouchEvent): void {
    this.handleSwipe(event, true);
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

  private stepAlbum(delta: number): void {
    const images = this.albumImages();
    if (images.length < 2) {
      return;
    }
    const next = (this.albumIndex() + delta + images.length) % images.length;
    this.albumIndex.set(next);
  }

  private handleSwipe(event: TouchEvent, inLightbox: boolean): void {
    if (!this.isAlbum() || this.albumImages().length < 2) {
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) {
      return;
    }
    const dx = touch.clientX - this.touchStartX;
    const dy = touch.clientY - this.touchStartY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) {
      return;
    }
    if (inLightbox || this.lightboxOpen()) {
      event.preventDefault();
    }
    this.stepAlbum(dx < 0 ? 1 : -1);
  }

  private detachLightboxFromBody(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const root = this.lightboxRoot()?.nativeElement;
    if (root?.parentElement === this.document.body) {
      root.remove();
    }
  }

  private lockBodyScroll(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.document.body.style.overflow = '';
  }
}
