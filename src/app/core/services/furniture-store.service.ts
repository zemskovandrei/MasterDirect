import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FurnitureCompany } from '../models/furniture.models';
import { SEED_FURNITURE_COMPANIES } from '../data/furniture.seed';

const FURNITURE_KEY = 'smartbuild-tech-furniture';

@Injectable({ providedIn: 'root' })
export class FurnitureStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly companiesSignal = signal<FurnitureCompany[]>([...SEED_FURNITURE_COMPANIES]);

  readonly companies = this.companiesSignal.asReadonly();

  readonly published = computed(() =>
    this.companiesSignal().filter((company) => company.subscribed),
  );

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

    try {
      const raw = localStorage.getItem(FURNITURE_KEY);
      if (!raw) {
        return;
      }

      const custom = JSON.parse(raw) as FurnitureCompany[];
      const customOnly = custom.filter((c) => !c.isDemo);
      this.companiesSignal.set([...SEED_FURNITURE_COMPANIES, ...customOnly]);
    } catch {
      /* ignore corrupt storage */
    }
  }
}
