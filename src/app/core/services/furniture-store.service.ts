import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FurnitureCompany } from '../models/furniture.models';
import { shouldWipeCatalog, wipeCatalogStorage } from '../utils/catalog-wipe.util';

const FURNITURE_KEY = 'smartbuild-tech-furniture';

@Injectable({ providedIn: 'root' })
export class FurnitureStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly companiesSignal = signal<FurnitureCompany[]>([]);

  readonly companies = this.companiesSignal.asReadonly();

  readonly published = computed(() => this.companiesSignal());

  constructor() {
    this.loadFromStorage();
  }

  getCompany(id: string): FurnitureCompany | undefined {
    return this.companiesSignal().find((c) => c.id === id);
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (shouldWipeCatalog()) {
      wipeCatalogStorage();
      this.companiesSignal.set([]);
      return;
    }

    try {
      const raw = localStorage.getItem(FURNITURE_KEY);
      if (!raw) {
        this.companiesSignal.set([]);
        return;
      }

      const companies = (JSON.parse(raw) as FurnitureCompany[]).filter((c) => !c.isDemo);
      this.companiesSignal.set(companies);
    } catch {
      localStorage.removeItem(FURNITURE_KEY);
      this.companiesSignal.set([]);
    }
  }
}
