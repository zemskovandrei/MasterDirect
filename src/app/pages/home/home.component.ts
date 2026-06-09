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
    'portfolio-01.webp',
    'portfolio-02.jpg',
    'portfolio-03.jpg',
    'portfolio-04.jpg',
    'portfolio-05.jpg',
    'portfolio-06.webp',
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

  private slideIntervalId?: ReturnType<typeof setInterval>;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
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
    this.currentSlideIndex.set(nextIndex);
    this.currentSlide.set(this.sliderImages[nextIndex]);
  }

  prevSlide() {
    const prevIndex =
      (this.currentSlideIndex() - 1 + this.sliderImages.length) % this.sliderImages.length;
    this.currentSlideIndex.set(prevIndex);
    this.currentSlide.set(this.sliderImages[prevIndex]);
  }

  goToSlide(index: number) {
    this.currentSlideIndex.set(index);
    this.currentSlide.set(this.sliderImages[index]);
  }
}
