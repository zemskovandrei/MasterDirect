import { Component, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';

interface ServiceItem {
  icon: string;
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

  protected currentSlideIndex = signal(0);
  protected formSubmitted = signal(false);

  protected readonly services: ServiceItem[] = [
    {
      icon: '🏠',
      title: 'Ремонт под ключ',
      description:
        'Полный цикл: от демонтажа и черновых работ до финальной отделки и сдачи объекта.',
    },
    {
      icon: '🧱',
      title: 'Плиточные работы',
      description: 'Укладка плитки и керамогранита в ванной, кухне, прихожей и других зонах.',
    },
    {
      icon: '⚡',
      title: 'Электрика',
      description: 'Разводка, щиты, освещение, розетки и безопасный монтаж под вашу планировку.',
    },
    {
      icon: '🚿',
      title: 'Сантехника',
      description: 'Замена труб, установка сантехники, подключение техники и проверка на протечки.',
    },
    {
      icon: '🎨',
      title: 'Отделка',
      description: 'Штукатурка, покраска, обои, напольные покрытия и декоративные решения.',
    },
    {
      icon: '🪑',
      title: 'Мебель под заказ',
      description: 'Кухни, шкафы, гардеробные и встроенная мебель по индивидуальным размерам.',
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
