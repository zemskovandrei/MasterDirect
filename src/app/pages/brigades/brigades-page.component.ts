import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';

@Component({
  selector: 'app-brigades-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './brigades-page.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './brigades-page.component.css'],
})
export class BrigadesPageComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly store = inject(PortfolioStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

  protected readonly selectedBrigadeId = signal<string | null>(null);
  protected readonly isBrigadeSelected = computed(() => this.selectedBrigadeId() !== null);
  protected readonly highlightBrigades = signal(false);

  ngOnInit() {
    this.route.fragment.subscribe((fragment) => {
      this.scrollToFragment(fragment);
    });
  }

  performerLink(id: string): string[] {
    return ['/brigades', id];
  }

  selectBrigade(id: string) {
    this.selectedBrigadeId.set(id);
    this.highlightBrigades.set(false);
  }

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
    void this.router.navigate(['/brigades', id]);
  }

  private scrollToFragment(fragment: string | null) {
    if (!fragment || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const targetId =
      fragment === 'estimate' || fragment === 'smeta-section' ? 'smeta-section' : null;

    if (!targetId) {
      return;
    }

    setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }
}
