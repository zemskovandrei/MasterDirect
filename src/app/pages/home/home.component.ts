import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { resolveAssetUrl } from '../../core/utils/asset-url.util';

interface ServiceItem {
  image: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly portfolioStore = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);
  protected currentSlideIndex = signal(0);

  private readonly serviceImageFiles = [
    '1.jpeg',
    '2.jpeg',
    '3.jpeg',
    '4.jpeg',
    '5.jpeg',
    '6.jpeg',
  ];

  private readonly serviceContent: Omit<ServiceItem, 'image'>[] = [
    {
      title: 'home.services.items.turnkey.title',
      description: 'home.services.items.turnkey.desc',
    },
    {
      title: 'home.services.items.tiler.title',
      description: 'home.services.items.tiler.desc',
    },
    {
      title: 'home.services.items.electrician.title',
      description: 'home.services.items.electrician.desc',
    },
    {
      title: 'home.services.items.plumber.title',
      description: 'home.services.items.plumber.desc',
    },
    {
      title: 'home.services.items.finisher.title',
      description: 'home.services.items.finisher.desc',
    },
    {
      title: 'home.services.items.furniture.title',
      description: 'home.services.items.furniture.desc',
    },
  ];

  private readonly sliderImageFiles = [
    'portfolio-01.jpg',
    'portfolio-02.jpg',
    'portfolio-03.jpg',
    'portfolio-04.jpg',
    'portfolio-05.jpg',
    'portfolio-06.jpg',
  ];

  private readonly sliderImages = this.sliderImageFiles.map((file) =>
    resolveAssetUrl(`assets/${file}`),
  );

  protected readonly services: ServiceItem[] = this.serviceContent.map((item, index) => ({
    ...item,
    image: resolveAssetUrl(`assets/${this.serviceImageFiles[index]}`),
  }));

  protected readonly sliderDots = this.sliderImageFiles.map((_, index) => index);
  protected readonly currentSlide = signal(this.sliderImages[0] ?? '');
  protected readonly slideTone = signal<'light' | 'dark'>('dark');

  private slideIntervalId?: ReturnType<typeof setInterval>;
  private readonly slideToneCache = new Map<number, 'light' | 'dark'>();

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.resolveSlideTone(0);
      this.sliderImages.forEach((_, index) => {
        if (index !== 0) {
          this.analyzeSlideTone(index);
        }
      });
      this.slideIntervalId = setInterval(() => this.nextSlide(), 5000);
    }
  }

  ngOnDestroy() {
    if (this.slideIntervalId !== undefined) {
      clearInterval(this.slideIntervalId);
    }
  }

  nextSlide() {
    const nextIndex = (this.currentSlideIndex() + 1) % this.sliderImages.length;
    this.setSlideIndex(nextIndex);
  }

  prevSlide() {
    const prevIndex =
      (this.currentSlideIndex() - 1 + this.sliderImages.length) % this.sliderImages.length;
    this.setSlideIndex(prevIndex);
  }

  goToSlide(index: number) {
    this.setSlideIndex(index);
  }

  private setSlideIndex(index: number) {
    this.currentSlideIndex.set(index);
    this.currentSlide.set(this.sliderImages[index]);
    this.resolveSlideTone(index);
  }

  private resolveSlideTone(index: number) {
    const cached = this.slideToneCache.get(index);
    if (cached) {
      this.slideTone.set(cached);
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      this.slideTone.set('dark');
      return;
    }

    this.analyzeSlideTone(index);
  }

  private analyzeSlideTone(index: number) {
    const url = this.sliderImages[index];
    if (!url) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      const tone = this.measureImageTone(img);
      this.slideToneCache.set(index, tone);
      if (this.currentSlideIndex() === index) {
        this.slideTone.set(tone);
      }
    };
    img.onerror = () => {
      this.slideToneCache.set(index, 'dark');
      if (this.currentSlideIndex() === index) {
        this.slideTone.set('dark');
      }
    };
    img.src = url;
  }

  private measureImageTone(img: HTMLImageElement): 'light' | 'dark' {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || img.naturalWidth === 0) {
      return 'dark';
    }

    const sampleSize = 48;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const sx = img.naturalWidth * 0.2;
    const sy = img.naturalHeight * 0.2;
    const sw = img.naturalWidth * 0.6;
    const sh = img.naturalHeight * 0.6;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let sum = 0;
    const pixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }

    return sum / pixels >= 128 ? 'light' : 'dark';
  }
}
