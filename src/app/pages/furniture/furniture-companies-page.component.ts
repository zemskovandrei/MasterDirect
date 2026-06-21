import {
  Component,
  OnInit,
  PLATFORM_ID,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { CatalogAdminService } from '../../core/services/catalog-admin.service';
import type { FurnitureCompany } from '../../core/models/furniture.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import {
  saveCatalogSelection,
  readCatalogSelection,
} from '../../core/utils/catalog-selection.util';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { CatalogOrderCalculatorSectionComponent } from '../../shared/components/catalog-order-calculator-section/catalog-order-calculator-section.component';

@Component({
  selector: 'app-furniture-companies-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent, SocialLinksComponent, CatalogOrderCalculatorSectionComponent],
  templateUrl: './furniture-companies-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../styles/catalog-pages.css', './furniture-companies-page.component.css'],
})
export class FurnitureCompaniesPageComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly supabase = inject(SupabaseService);
  protected readonly catalogAdmin = inject(CatalogAdminService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly hasSocialLinks = hasSocialLinks;

  protected readonly pageBackground = catalogTabBackgroundStyle('furniture');
  protected readonly selectedCompanyId = signal<string | null>(null);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.loadProfiles().subscribe();
    }

    const selection = readCatalogSelection();
    if (selection?.type === 'furniture') {
      this.selectedCompanyId.set(selection.id);
    }
  }

  toggleSelect(id: string): void {
    this.selectedCompanyId.update((current) => {
      const next = current === id ? null : id;
      saveCatalogSelection(next ? { type: 'furniture', id: next } : null);
      return next;
    });
  }

  async deleteCompany(company: FurnitureCompany) {
    const error = await this.catalogAdmin.deleteFurnitureCompany(company);
    if (error) {
      alert(error);
    }
  }

  deleteWork(company: FurnitureCompany, workId: string, workTitle: string) {
    void this.catalogAdmin.deleteFurnitureWork(company.id, workId, workTitle).then((error) => {
      if (error) {
        alert(error);
      }
    });
  }

  adminLogout() {
    this.catalogAdmin.logout();
  }
}
