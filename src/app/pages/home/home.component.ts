import {
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
<<<<<<< HEAD
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
=======
import { TranslationService } from '../../core/services/translation.service';
>>>>>>> copilot/vscode-mpyhbjc8-zg6q
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { collectGalleryWorks } from '../../core/utils/gallery-works.util';
import { homeHeroBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { resolveAssetUrl } from '../../core/utils/asset-url.util';

interface ServiceItem {
<<<<<<< HEAD
  image: string;
  title: string;
  description: string;
=======
  icon: string;
  titleKey: string;
  descriptionKey: string;
>>>>>>> copilot/vscode-mpyhbjc8-zg6q
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly portfolioStore = inject(PortfolioStoreService);
<<<<<<< HEAD
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly heroBackground = homeHeroBackgroundStyle();
=======
  protected readonly translationService = inject(TranslationService);
>>>>>>> copilot/vscode-mpyhbjc8-zg6q

  protected readonly galleryWorks = computed(() =>
    collectGalleryWorks({
      workers: this.supabase.galleryWorkers(),
      brigades: this.supabase.galleryBrigades(),
      furniture: this.supabase.galleryFurnitureCompanies(),
    }),
  );

<<<<<<< HEAD
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
=======
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
>>>>>>> copilot/vscode-mpyhbjc8-zg6q
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
