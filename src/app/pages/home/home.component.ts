import {
  Component,
  HostListener,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { collectGalleryWorks } from '../../core/utils/gallery-works.util';
import { homeHeroBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { resolveAssetUrl } from '../../core/utils/asset-url.util';
import { normalizeSearchText, specialtySearchHaystack } from '../../core/utils/catalog-filter.util';

interface ServiceItem {
  image: string;
  title: string;
  description: string;
}

interface HeroTag {
  labelKey: string;
  path: string;
  queryParams?: Record<string, string>;
}

interface SiteSearchHit {
  id: string;
  title: string;
  subtitle: string;
  kind: 'worker' | 'brigade' | 'furniture' | 'job';
  kindLabelKey: string;
  route: string[];
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
  private readonly router = inject(Router);
  protected readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly heroBackground = homeHeroBackgroundStyle();

  protected readonly searchQuery = signal('');
  protected readonly searchOpen = signal(false);

  protected readonly heroTags: HeroTag[] = [
    { labelKey: 'home.hero.tags.0', path: '/masters', queryParams: { specialty: 'tiler' } },
    { labelKey: 'home.hero.tags.1', path: '/masters', queryParams: { specialty: 'plumber' } },
    { labelKey: 'home.hero.tags.2', path: '/masters', queryParams: { specialty: 'electrician' } },
    { labelKey: 'home.hero.tags.3', path: '/masters', queryParams: { specialty: 'painter' } },
    { labelKey: 'home.hero.tags.4', path: '/furniture' },
    { labelKey: 'home.hero.tags.5', path: '/brigades', queryParams: { specialty: 'turnkey' } },
  ];

  protected readonly galleryWorks = computed(() =>
    collectGalleryWorks({
      workers: this.supabase.galleryWorkers(),
      brigades: this.supabase.galleryBrigades(),
      furniture: this.supabase.galleryFurnitureCompanies(),
    }),
  );

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
      this.supabase.ensureProfilesLoaded().subscribe();
      this.supabase.prefetchActiveJobs();
    }
  }

  protected readonly searchHits = computed((): SiteSearchHit[] => {
    const query = normalizeSearchText(this.searchQuery());
    if (query.length < 2) {
      return [];
    }

    this.translation.locale();
    const hits: SiteSearchHit[] = [];

    for (const worker of this.supabase.workers()) {
      if (
        this.matchesHaystack(
          `${worker.name} ${worker.description} ${specialtySearchHaystack(worker.specialty ?? '', this.catalogL10n.performerSpecialty(worker))}`,
          query,
        )
      ) {
        hits.push({
          id: worker.id,
          title: worker.name,
          subtitle: this.catalogL10n.performerSpecialty(worker),
          kind: 'worker',
          kindLabelKey: 'home.hero.searchMasters',
          route: ['/masters', worker.id],
        });
      }
    }

    for (const brigade of this.supabase.brigades()) {
      if (
        this.matchesHaystack(
          `${brigade.name} ${brigade.description} ${specialtySearchHaystack(brigade.specialty ?? '', this.catalogL10n.performerSpecialty(brigade))}`,
          query,
        )
      ) {
        hits.push({
          id: brigade.id,
          title: brigade.name,
          subtitle: this.catalogL10n.performerSpecialty(brigade),
          kind: 'brigade',
          kindLabelKey: 'home.hero.searchBrigades',
          route: ['/brigades', brigade.id],
        });
      }
    }

    for (const company of this.supabase.furnitureCompanies()) {
      if (
        this.matchesHaystack(
          `${company.name} ${company.description} ${company.city} ${specialtySearchHaystack(company.specialty ?? '', this.catalogL10n.localizeSpecialtyField(company.specialty ?? ''))}`,
          query,
        )
      ) {
        hits.push({
          id: company.id,
          title: company.name,
          subtitle: this.catalogL10n.localizeSpecialtyField(company.specialty),
          kind: 'furniture',
          kindLabelKey: 'home.hero.searchFurniture',
          route: ['/furniture', company.id],
        });
      }
    }

    for (const job of this.supabase.activeJobs()) {
      if (this.matchesHaystack(`${job.title} ${job.category} ${job.description} ${job.city}`, query)) {
        hits.push({
          id: job.id,
          title: job.title,
          subtitle: [job.city, job.category].filter(Boolean).join(' · '),
          kind: 'job',
          kindLabelKey: 'home.hero.searchJobs',
          route: ['/jobs'],
        });
      }
    }

    return hits.slice(0, 8);
  });

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
    this.searchOpen.set(normalizeSearchText(value).length >= 2);
  }

  protected onSearchFocus(): void {
    if (normalizeSearchText(this.searchQuery()).length >= 2) {
      this.searchOpen.set(true);
    }
  }

  protected submitSearch(event: Event): void {
    event.preventDefault();
    const query = this.searchQuery().trim();
    const hits = this.searchHits();
    if (!query) {
      return;
    }

    if (hits.length === 1) {
      this.goToHit(hits[0]);
      return;
    }

    const counts = {
      worker: hits.filter((hit) => hit.kind === 'worker').length,
      brigade: hits.filter((hit) => hit.kind === 'brigade').length,
      furniture: hits.filter((hit) => hit.kind === 'furniture').length,
      job: hits.filter((hit) => hit.kind === 'job').length,
    };
    const winner = (Object.entries(counts) as Array<[keyof typeof counts, number]>).sort(
      (left, right) => right[1] - left[1],
    )[0];

    const path =
      winner?.[1] > 0
        ? { worker: '/masters', brigade: '/brigades', furniture: '/furniture', job: '/jobs' }[winner[0]]
        : '/masters';

    void this.router.navigate([path], { queryParams: { q: query } });
    this.searchOpen.set(false);
  }

  protected goToHit(hit: SiteSearchHit): void {
    this.searchOpen.set(false);
    if (hit.kind === 'job') {
      void this.router.navigate(['/jobs'], { queryParams: { q: hit.title } });
      return;
    }
    void this.router.navigate(hit.route);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.searchOpen.set(false);
  }

  private matchesHaystack(haystack: string, query: string): boolean {
    return normalizeSearchText(haystack).includes(query);
  }
}
