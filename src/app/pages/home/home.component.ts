import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

interface ServiceItem {
  icon: string;
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
  protected readonly translation = inject(TranslationService);
  protected currentSlideIndex = signal(0);

  protected readonly services: ServiceItem[] = [
    {
      icon: '🏠',
      title: 'home.services.items.turnkey.title',
      description: 'home.services.items.turnkey.desc',
    },
    {
      icon: '🧱',
      title: 'home.services.items.tiler.title',
      description: 'home.services.items.tiler.desc',
    },
    {
      icon: '⚡',
      title: 'home.services.items.electrician.title',
      description: 'home.services.items.electrician.desc',
    },
    {
      icon: '🚿',
      title: 'home.services.items.plumber.title',
      description: 'home.services.items.plumber.desc',
    },
    {
      icon: '🎨',
      title: 'home.services.items.finisher.title',
      description: 'home.services.items.finisher.desc',
    },
    {
      icon: '🪑',
      title: 'home.services.items.furniture.title',
      description: 'home.services.items.furniture.desc',
    },
  ];

  private readonly sliderImages = [
    'assets/portfolio-01.webp',
    'assets/portfolio-02.jpg',
    'assets/portfolio-03.jpg',
    'assets/portfolio-04.jpg',
    'assets/portfolio-05.jpg',
    'assets/portfolio-06.webp',
  ];

  protected readonly sliderDots = this.sliderImages.map((_, index) => index);
  protected currentSlide = signal(this.sliderImages[0]);

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
