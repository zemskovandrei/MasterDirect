import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  afterRenderEffect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import type { WorkVideo } from '../../../core/models/portfolio.models';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-work-video-player',
  standalone: true,
  templateUrl: './work-video-player.component.html',
  styleUrls: ['./work-video-player.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class WorkVideoPlayerComponent implements OnDestroy {
  protected readonly translation = inject(TranslationService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  readonly video = input.required<WorkVideo>();
  readonly showTitle = input(true);

  protected readonly lightboxOpen = signal(false);
  private readonly lightboxRoot = viewChild<ElementRef<HTMLElement>>('lightboxRoot');
  private readonly lightboxVideo = viewChild<ElementRef<HTMLVideoElement>>('lightboxVideo');

  constructor() {
    afterRenderEffect(() => {
      if (!isPlatformBrowser(this.platformId) || !this.lightboxOpen()) {
        return;
      }
      const root = this.lightboxRoot()?.nativeElement;
      if (root && root.parentElement !== this.document.body) {
        this.document.body.appendChild(root);
      }
      const player = this.lightboxVideo()?.nativeElement;
      if (player) {
        void player.play().catch(() => undefined);
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
    }
  }

  protected openLightbox(): void {
    this.lightboxOpen.set(true);
    this.lockBodyScroll();
  }

  protected closeLightbox(): void {
    const player = this.lightboxVideo()?.nativeElement;
    if (player) {
      player.pause();
    }
    this.lightboxOpen.set(false);
    this.detachLightboxFromBody();
    this.unlockBodyScroll();
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
