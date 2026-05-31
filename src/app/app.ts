import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

interface PortfolioItem {
  id: number;
  title: string;
  description: string;
  image: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App implements OnInit {
  protected readonly title = signal('pro-remont');
  protected currentSlideIndex = signal(0);
  protected portfolioItems: PortfolioItem[] = [];

  private sliderImages = [
    'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1513694203232-c1a7f32ce857?w=1200&h=600&fit=crop',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&h=600&fit=crop'
  ];

  ngOnInit() {
    this.portfolioItems = [
      {
        id: 1,
        title: 'Современная гостиная',
        description: 'Просторная гостиная с нейтральной палитрой, мягким светом и стильной мебелью для семейного отдыха.',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
      },
      {
        id: 2,
        title: 'Классический интерьер',
        description: 'Элегантная комната с натуральными материалами, текстурными акцентами и уютной атмосферой.',
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop'
      },
      {
        id: 3,
        title: 'Рабочая зона в квартире',
        description: 'Удобное рабочее место с эргономичным столом, аккуратным хранением и мягким акцентным освещением.',
        image: 'assets/room.jpg'
      },
      {
        id: 4,
        title: 'Спальня для отдыха',
        description: 'Светлая спальня с комфортной кроватью, спокойной цветовой гаммой и уютной атмосферой для сна.',
        image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop'
      },
      {
        id: 5,
        title: 'Кухня с современной техникой',
        description: 'Практичная кухня с удобными рабочими поверхностями, встроенной техникой и лаконичным дизайном.',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop'
      },
      {
        id: 6,
        title: 'Светлая ванная комната',
        description: 'Санузел с качественной отделкой, просторным зеркалом и светлыми материалами для свежего интерьера.',
        image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop'
      }
    ];

    // Initialize first slide
    this.updateSlideImage();

    // Auto-rotate slider every 5 seconds
    setInterval(() => {
      this.nextSlide();
    }, 5000);
  }

  protected currentSlide = signal('');

  nextSlide() {
    const nextIndex = (this.currentSlideIndex() + 1) % this.sliderImages.length;
    this.currentSlideIndex.set(nextIndex);
    this.updateSlideImage();
  }

  prevSlide() {
    const prevIndex = (this.currentSlideIndex() - 1 + this.sliderImages.length) % this.sliderImages.length;
    this.currentSlideIndex.set(prevIndex);
    this.updateSlideImage();
  }

  goToSlide(index: number) {
    this.currentSlideIndex.set(index);
    this.updateSlideImage();
  }

  private updateSlideImage() {
    this.currentSlide.set(this.sliderImages[this.currentSlideIndex()]);
  }
}

