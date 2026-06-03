import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { TranslationService } from '../../core/services/translation.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';

interface ServiceItem {
  icon: string;
  titleKey: string;
  descriptionKey: string;
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
  protected readonly translationService = inject(TranslationService);

  protected currentSlideIndex = signal(0);
  protected formSubmitted = signal(false);

  protected readonly heroTags = [
    'hero.tag.tile',
    'hero.tag.plumbing',
    'hero.tag.electric',
    'hero.tag.finishing',
    'hero.tag.furniture',
    'hero.tag.turnkey',
  ];

  protected readonly heroBenefits = [
    'hero.benefit.team',
    'hero.benefit.quote',
    'hero.benefit.beforeAfter',
  ];

  protected readonly services: ServiceItem[] = [
    {
      icon: '🏠',
      titleKey: 'service.turnkey.title',
      descriptionKey: 'service.turnkey.description',
    },
    {
      icon: '🧱',
      titleKey: 'service.tiler.title',
      descriptionKey: 'service.tiler.description',
    },
    {
      icon: '⚡',
      titleKey: 'service.electrician.title',
      descriptionKey: 'service.electrician.description',
    },
    {
      icon: '🚿',
      titleKey: 'service.plumber.title',
      descriptionKey: 'service.plumber.description',
    },
    {
      icon: '🎨',
      titleKey: 'service.finisher.title',
      descriptionKey: 'service.finisher.description',
    },
    {
      icon: '🪑',
      titleKey: 'service.furniture.title',
      descriptionKey: 'service.furniture.description',
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
    this.slideIntervalId = setInterval(() => this.nextSlide(), 5000);
  }

  ngOnDestroy() {
    if (this.slideIntervalId !== undefined) {
      clearInterval(this.slideIntervalId);
    }
  }

  protected slideBackgroundStyle(): { [key: string]: string } {
    return { 'background-image': `url("${encodeURI(this.currentSlide())}")` };
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
    if (this.estimateForm.invalid) {
      this.estimateForm.markAllAsTouched();
      return;
    }
    this.formSubmitted.set(true);
    this.estimateForm.reset();
    if (isPlatformBrowser(this.platformId)) {
      document
        .getElementById('estimate-success')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  resetEstimateForm() {
    this.formSubmitted.set(false);
    this.estimateForm.reset();
  }

  isInvalid(controlName: 'name' | 'phone' | 'email'): boolean {
    const control = this.estimateForm.get(controlName);
    return !!control && control.invalid && control.touched;
  }
}
