import {
  Component,
  Inject,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { FurnitureCompany } from '../../core/models/furniture.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { isCatalogFurnitureCompanyVisible } from '../../core/utils/catalog-filter.util';
import { normalizeUuid } from '../../core/utils/furniture-id.util';
import { firstValueFrom } from 'rxjs';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { logSupabaseError } from '../../core/utils/supabase-error.util';

@Component({
  selector: 'app-furniture-companies-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './furniture-companies-page.component.html',
  styleUrls: [
    '../../styles/catalog-pages.css',
    '../masters/masters-page.component.css',
    './furniture-companies-page.component.css',
  ],
})
export class FurnitureCompaniesPageComponent {
  protected readonly supabase = inject(SupabaseService);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);

  protected readonly catalogTabBackground = catalogTabBackgroundStyle('furniture');

  protected readonly displayCompanies = computed(() =>
    this.supabase
      .furnitureCompanies()
      .filter((company) => isCatalogFurnitureCompanyVisible(company)),
  );

  protected readonly catalogReady = computed(() => this.supabase.catalogReady());

  protected readonly showAutoMatchEmpty = computed(
    () => this.catalogReady() && this.displayCompanies().length === 0,
  );

  private catalogLoadStarted = false;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {
    afterNextRender(() => {
      this.initCatalog();
    });
  }

  private initCatalog(): void {
    if (!isPlatformBrowser(this.platformId) || this.catalogLoadStarted) {
      return;
    }

    this.catalogLoadStarted = true;
    this.supabase.loadProfiles().subscribe({
      error: (err) => logSupabaseError('FurniturePage.loadProfiles', err),
    });
  }

  async deleteCompany(company: FurnitureCompany): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const dbId = normalizeUuid(company.dbId) || normalizeUuid(company.id) || '';

    console.log('[FurnitureCompaniesPage] deleteCompany dbId=', dbId, {
      slug: company.slug,
      id: company.id,
      dbId: company.dbId,
      name: company.name,
    });

    if (!dbId) {
      console.error('Furniture delete error:', 'Missing furniture order dbId', company);
      alert('Missing furniture order dbId');
      return;
    }

    const confirmed = window.confirm(this.translation.t('admin.masters.deleteConfirm'));
    if (!confirmed) {
      return;
    }

    const result = await firstValueFrom(this.supabase.deleteFurnitureOrder(dbId));
    if (result.error) {
      alert(result.error);
    }
  }

  adminLogout(): void {
    void this.adminAuth.logout();
  }
}
