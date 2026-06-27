import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { FurnitureCompany } from '../models/furniture.models';
import type { PerformerProfile } from '../models/portfolio.models';
import { AdminAuthService } from './admin-auth.service';
import { TranslationService } from './translation.service';

@Injectable({ providedIn: 'root' })
export class CatalogAdminService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly adminAuth = inject(AdminAuthService);
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

    return null;
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

    return null;
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
    return null;
  }

  private canAct(): boolean {
    return isPlatformBrowser(this.platformId) && this.adminAuth.isAdmin();
  }
}
