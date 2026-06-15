import { Component, OnInit, PLATFORM_ID, computed, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { homeHeroBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
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
export class HomeComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly portfolioStore = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly heroBackground = homeHeroBackgroundStyle();

  protected readonly hasGalleryPerformers = computed(
    () =>
      this.supabase.brigades().length > 0 ||
      this.supabase.workers().length > 0 ||
      this.supabase.furnitureCompanies().length > 0,
  );

  private readonly serviceImageFiles = ['1.jpeg', '2.jpeg', '3.jpeg', '4.jpeg', '5.jpeg', '6.jpeg'];

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

  protected readonly services: ServiceItem[] = this.serviceContent.map((item, index) => ({
    ...item,
    image: resolveAssetUrl(`assets/${this.serviceImageFiles[index]}`),
  }));

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.loadProfiles().subscribe();
    }
  }
}
