import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { logSupabaseError } from '../../core/utils/supabase-error.util';

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

  protected readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

  protected readonly selectedBrigadeId = signal<string | null>(null);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.loadProfiles().subscribe({
        error: (err) => logSupabaseError('BrigadesPage.loadProfiles', err),
      });
    }

    this.route.fragment.subscribe((fragment) => {
      this.scrollToFragment(fragment);
    });
  }

  performerLink(id: string): string[] {
    return ['/brigades', id];
  }

  selectBrigade(id: string) {
    this.selectedBrigadeId.set(id);
  }

  private scrollToFragment(fragment: string | null) {
    if (!fragment || !isPlatformBrowser(this.platformId)) {
      return;
    }

    if (fragment === 'brigade-section') {
      setTimeout(() => {
        document.getElementById('brigade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }
}
