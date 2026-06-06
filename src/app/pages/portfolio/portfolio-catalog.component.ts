import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { PerformerType } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-portfolio-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './portfolio-catalog.component.html',
  styleUrls: ['./portfolio-catalog.component.css'],
})
export class PortfolioCatalogComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly store = inject(PortfolioStoreService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly selectedBrigadeId = signal<string | null>(null);
  protected readonly isBrigadeSelected = computed(() => this.selectedBrigadeId() !== null);
  protected readonly highlightBrigades = signal(false);

  ngOnInit() {
    this.route.fragment.subscribe((fragment) => {
      this.scrollToFragment(fragment);
    });
  }

  performerLink(type: PerformerType, id: string): string[] {
    return ['/portfolio', type, id];
  }

  selectBrigade(id: string) {
    this.selectedBrigadeId.set(id);
    this.highlightBrigades.set(false);
  }

  /** Подсветка бригад при hover на карточку или кнопку «Смета», если бригада не выбрана */
  onSmetaHintEnter() {
    if (!this.isBrigadeSelected()) {
      this.highlightBrigades.set(true);
    }
  }

  onSmetaHintLeave() {
    this.highlightBrigades.set(false);
  }

  viewEstimate() {
    const id = this.selectedBrigadeId();
    if (!id) {
      return;
    }
    void this.router.navigate(['/portfolio', 'brigade', id]);
  }

  private scrollToFragment(fragment: string | null) {
    if (!fragment || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const targetId =
      fragment === 'brigades' || fragment === 'brigade-section'
        ? 'brigade-section'
        : fragment === 'estimate' || fragment === 'smeta-section'
          ? 'smeta-section'
          : fragment === 'workers' || fragment === 'masters'
            ? 'workers'
            : fragment === 'catalog-tabs'
              ? 'catalog-tabs'
              : null;

    if (!targetId) {
      return;
    }

    setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
