import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

interface ServiceItem {
  image: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BeforeAfterComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  protected readonly portfolioStore = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);
  protected currentSlideIndex = signal(0);
  protected formSubmitted = signal(false);
  protected formSuccess = signal(false);

  protected readonly services: ServiceItem[] = [
    {
      image: 'assets/1.jpeg',
      title: 'home.services.items.turnkey.title',
      description: 'home.services.items.turnkey.desc',
    },
    {
      image: 'assets/2.jpeg',
      title: 'home.services.items.tiler.title',
      description: 'home.services.items.tiler.desc',
    },
    {
      image: 'assets/3.jpeg',
      title: 'home.services.items.electrician.title',
      description: 'home.services.items.electrician.desc',
    },
    {
      image: 'assets/4.jpeg',
      title: 'home.services.items.plumber.title',
      description: 'home.services.items.plumber.desc',
    },
    {
      image: 'assets/5.jpeg',
      title: 'home.services.items.finisher.title',
      description: 'home.services.items.finisher.desc',
    },
    {
      image: 'assets/6.jpeg',
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

  protected readonly estimateForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[\d\s()+-]{10,}$/)]],
    email: ['', Validators.email],
    message: [''],
  });

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

  submitEstimate() {
    this.formSubmitted.set(true);
    if (this.estimateForm.invalid) {
      return;
    }

    this.formSuccess.set(true);
    this.estimateForm.reset();
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        document
          .getElementById('estimate-success')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 0);
    }
  }

  resetEstimateForm() {
    this.formSubmitted.set(false);
    this.formSuccess.set(false);
    this.estimateForm.reset();
  }

  isInvalid(controlName: 'name' | 'phone' | 'email'): boolean {
    const control = this.estimateForm.get(controlName);
    return !!control && control.invalid && (control.touched || this.formSubmitted());
  }
}
