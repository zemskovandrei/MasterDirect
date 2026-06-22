import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { FurnitureCompany } from '../models/furniture.models';
import type { PerformerProfile } from '../models/portfolio.models';
import { AdminAuthService } from './admin-auth.service';
import { FurnitureStoreService } from './furniture-store.service';
import { PortfolioStoreService } from './portfolio-store.service';
import { SupabaseService } from './supabase.service';
import { TranslationService } from './translation.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CatalogAdminService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly auth = inject(AuthService);
  private readonly translation = inject(TranslationService);

  isAdmin(): boolean {
    return this.adminAuth.isAdmin();
  }

  logout(): void {
    void this.adminAuth.logout();
  }

  async deletePerformer(performer: PerformerProfile): Promise<string | null> {
    if (!this.canAct()) {
      return 'Browser only';
    }

    const confirmed = window.confirm(
      this.translation
        .t('admin.catalog.deleteProfileConfirm')
        .replace('{{name}}', performer.name),
    );
    if (!confirmed) {
      return null;
    }

    const adminEmail =
      this.auth.user()?.email?.trim().toLowerCase() ||
      environment.supabase.adminEmails[0]?.trim().toLowerCase() ||
      'admin@smartbuild.tech';

    const result = await firstValueFrom(
      this.supabase.deleteSpecialistWithEvidence(performer.id, adminEmail),
    );
    return result.error;
  }

  async deleteFurnitureCompany(company: FurnitureCompany): Promise<string | null> {
    if (!this.canAct()) {
      return 'Browser only';
    }

    const confirmed = window.confirm(
      this.translation
        .t('admin.catalog.deleteProfileConfirm')
        .replace('{{name}}', company.name),
    );
    if (!confirmed) {
      return null;
    }

    const result = await firstValueFrom(this.supabase.deleteFurnitureCompany(company));
    return result.error;
  }

  async deletePerformerWork(performerId: string, workId: string, workTitle: string): Promise<string | null> {
    if (!this.canAct()) {
      return 'Browser only';
    }

    const confirmed = window.confirm(
      this.translation
        .t('admin.catalog.deleteWorkConfirm')
        .replace('{{title}}', workTitle || '—'),
    );
    if (!confirmed) {
      return null;
    }

    const result = await firstValueFrom(this.supabase.deletePortfolioWork(workId));
    if (result.error) {
      return result.error;
    }

    this.portfolioStore.deleteWork(performerId, workId);
    return null;
  }

  async deleteFurnitureWork(companyId: string, workId: string, workTitle: string): Promise<string | null> {
    if (!this.canAct()) {
      return 'Browser only';
    }

    const confirmed = window.confirm(
      this.translation
        .t('admin.catalog.deleteWorkConfirm')
        .replace('{{title}}', workTitle || '—'),
    );
    if (!confirmed) {
      return null;
    }

    const result = await firstValueFrom(this.supabase.deletePortfolioWork(workId));
    if (result.error) {
      return result.error;
    }

    this.furnitureStore.deleteWork(companyId, workId);
    return null;
  }

  private canAct(): boolean {
    return isPlatformBrowser(this.platformId) && this.adminAuth.isAdmin();
  }
}
