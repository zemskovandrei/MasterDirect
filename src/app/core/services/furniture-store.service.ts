import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FurnitureCompany, FurnitureSession } from '../models/furniture.models';
import { PerformerSocialLinks, WorkProject } from '../models/portfolio.models';
import { normalizeSocialLinks } from '../utils/social-links.util';
import { shouldWipeCatalog, wipeCatalogStorage } from '../utils/catalog-wipe.util';

const FURNITURE_KEY = 'smartbuild-tech-furniture';
const FURNITURE_SESSION_KEY = 'smartbuild-tech-furniture-session';

@Injectable({ providedIn: 'root' })
export class FurnitureStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly companiesSignal = signal<FurnitureCompany[]>([]);
  private readonly sessionSignal = signal<FurnitureSession | null>(null);

  readonly companies = this.companiesSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();

  readonly published = computed(() => this.companiesSignal());

  readonly currentCompany = computed(() => {
    const session = this.sessionSignal();
    if (!session) {
      return null;
    }
    return this.companiesSignal().find((c) => c.id === session.companyId) ?? null;
  });

  constructor() {
    this.loadFromStorage();
  }

  getCompany(id: string): FurnitureCompany | undefined {
    return this.companiesSignal().find((c) => c.id === id);
  }

  registerCompany(data: {
    name: string;
    specialty: string;
    description: string;
    city?: string;
    socialLinks?: PerformerSocialLinks;
  }): FurnitureCompany {
    const id = this.generateId(data.name);
    const socialLinks = normalizeSocialLinks(data.socialLinks);
    const company: FurnitureCompany = {
      id,
      name: data.name.trim(),
      specialty: data.specialty.trim(),
      description: data.description.trim(),
      city: data.city?.trim() ?? '',
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
      works: [],
    };

    this.companiesSignal.update((list) => [...list, company]);
    this.sessionSignal.set({ companyId: id });
    this.persist();
    return company;
  }

  setSession(companyId: string): void {
    if (!this.companiesSignal().some((company) => company.id === companyId)) {
      return;
    }
    this.sessionSignal.set({ companyId });
    this.persistSession();
  }

  removeCompanyIfExists(companyId: string): void {
    if (!this.companiesSignal().some((company) => company.id === companyId)) {
      return;
    }
    this.companiesSignal.update((list) => list.filter((company) => company.id !== companyId));
    const session = this.sessionSignal();
    if (session?.companyId === companyId) {
      this.sessionSignal.set(null);
    }
    this.persist();
  }

  replaceCompaniesFromRemote(remote: FurnitureCompany[]): void {
    const existing = this.companiesSignal();
    const merged = remote.map((company) => {
      const local = existing.find((item) => item.id === company.id);
      return local ? { ...company, works: local.works } : company;
    });
    this.companiesSignal.set(merged);
    this.persist();
  }

  updateSocialLinks(companyId: string, socialLinks: PerformerSocialLinks): void {
    const normalized = normalizeSocialLinks(socialLinks);

    this.companiesSignal.update((list) =>
      list.map((company) =>
        company.id === companyId
          ? {
              ...company,
              socialLinks: Object.keys(normalized).length > 0 ? normalized : undefined,
            }
          : company,
      ),
    );
    this.persist();
  }

  addWork(
    companyId: string,
    data: {
      title: string;
      description: string;
      beforeImage: string;
      afterImage: string;
    },
  ): WorkProject | null {
    const company = this.companiesSignal().find((c) => c.id === companyId);
    if (!company) {
      return null;
    }

    const work: WorkProject = {
      id: `work-${Date.now()}`,
      title: data.title.trim(),
      description: data.description.trim(),
      beforeImage: data.beforeImage,
      afterImage: data.afterImage,
      createdAt: new Date().toISOString(),
      verificationStatus: 'not_requested',
    };

    this.companiesSignal.update((list) =>
      list.map((c) => (c.id === companyId ? { ...c, works: [work, ...c.works] } : c)),
    );
    this.persist();
    return work;
  }

  signOut(): void {
    this.sessionSignal.set(null);
    this.persistSession();
  }

  private generateId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
    return `furniture-${slug || 'new'}-${Date.now().toString(36)}`;
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (shouldWipeCatalog()) {
      wipeCatalogStorage();
      this.companiesSignal.set([]);
      this.sessionSignal.set(null);
      return;
    }

    try {
      const raw = localStorage.getItem(FURNITURE_KEY);
      if (!raw) {
        this.companiesSignal.set([]);
      } else {
        const companies = (JSON.parse(raw) as FurnitureCompany[])
          .filter((c) => !c.isDemo)
          .map((company) => ({
            ...company,
            socialLinks: normalizeSocialLinks(company.socialLinks),
          }));
        this.companiesSignal.set(companies);
      }

      const sessionRaw = localStorage.getItem(FURNITURE_SESSION_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw) as FurnitureSession;
        if (this.companiesSignal().some((c) => c.id === session.companyId)) {
          this.sessionSignal.set(session);
        } else {
          localStorage.removeItem(FURNITURE_SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(FURNITURE_KEY);
      localStorage.removeItem(FURNITURE_SESSION_KEY);
      this.companiesSignal.set([]);
      this.sessionSignal.set(null);
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const companies = this.companiesSignal().filter((c) => !c.isDemo);
    localStorage.setItem(FURNITURE_KEY, JSON.stringify(companies));
    this.persistSession();
  }

  private persistSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const session = this.sessionSignal();
    if (session) {
      localStorage.setItem(FURNITURE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(FURNITURE_SESSION_KEY);
    }
  }
}
