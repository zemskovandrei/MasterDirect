import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CabinetSession,
  PerformerProfile,
  PerformerType,
  WorkProject,
} from '../models/portfolio.models';
import { SEED_PERFORMERS } from '../data/portfolio.seed';

const PERFORMERS_KEY = 'smartbuild-tech-performers';
const SESSION_KEY = 'smartbuild-tech-cabinet-session';

@Injectable({ providedIn: 'root' })
export class PortfolioStoreService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly performersSignal = signal<PerformerProfile[]>([...SEED_PERFORMERS]);
  private readonly sessionSignal = signal<CabinetSession | null>(null);

  readonly performers = this.performersSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();

  readonly brigades = computed(() =>
    this.performersSignal().filter((p) => p.type === 'brigade' && p.subscribed),
  );

  readonly workers = computed(() =>
    this.performersSignal().filter((p) => p.type === 'worker' && p.subscribed),
  );

  readonly currentPerformer = computed(() => {
    const session = this.sessionSignal();
    if (!session) {
      return null;
    }
    return this.performersSignal().find((p) => p.id === session.performerId) ?? null;
  });

  constructor() {
    this.loadFromStorage();
  }

  getPerformer(type: PerformerType, id: string): PerformerProfile | undefined {
    return this.performersSignal().find((p) => p.type === type && p.id === id);
  }

  registerPerformer(data: {
    type: PerformerType;
    name: string;
    specialty: string;
    description: string;
  }): PerformerProfile {
    const id = this.generateId(data.type, data.name);
    const performer: PerformerProfile = {
      id,
      type: data.type,
      name: data.name.trim(),
      specialty: data.specialty.trim(),
      description: data.description.trim(),
      works: [],
      subscribed: false,
    };

    this.performersSignal.update((list) => [...list, performer]);
    this.sessionSignal.set({ performerId: id });
    this.persist();
    return performer;
  }

  activateSubscription(performerId: string): void {
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + 1);

    this.performersSignal.update((list) =>
      list.map((p) =>
        p.id === performerId
          ? { ...p, subscribed: true, subscriptionEndsAt: endsAt.toISOString() }
          : p,
      ),
    );
    this.persist();
  }

  addWork(
    performerId: string,
    data: { title: string; description: string; beforeImage: string; afterImage: string },
  ): WorkProject | null {
    const performer = this.performersSignal().find((p) => p.id === performerId);
    if (!performer?.subscribed) {
      return null;
    }

    const work: WorkProject = {
      id: `work-${Date.now()}`,
      title: data.title.trim(),
      description: data.description.trim(),
      beforeImage: data.beforeImage,
      afterImage: data.afterImage,
      createdAt: new Date().toISOString(),
    };

    this.performersSignal.update((list) =>
      list.map((p) => (p.id === performerId ? { ...p, works: [work, ...p.works] } : p)),
    );
    this.persist();
    return work;
  }

  signIn(performerId: string): boolean {
    const exists = this.performersSignal().some((p) => p.id === performerId);
    if (!exists) {
      return false;
    }
    this.sessionSignal.set({ performerId });
    this.persistSession();
    return true;
  }

  signOut(): void {
    this.sessionSignal.set(null);
    this.persistSession();
  }

  private generateId(type: PerformerType, name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 24);
    const prefix = type === 'brigade' ? 'brigada' : 'master';
    return `${prefix}-${slug || 'new'}-${Date.now().toString(36)}`;
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const raw = localStorage.getItem(PERFORMERS_KEY);
      if (raw) {
        const custom = JSON.parse(raw) as PerformerProfile[];
        const customOnly = custom.filter((p) => !p.isDemo);
        this.performersSignal.set([...SEED_PERFORMERS, ...customOnly]);
      }

      const sessionRaw = localStorage.getItem(SESSION_KEY);
      if (sessionRaw) {
        this.sessionSignal.set(JSON.parse(sessionRaw) as CabinetSession);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const customOnly = this.performersSignal().filter((p) => !p.isDemo);
    localStorage.setItem(PERFORMERS_KEY, JSON.stringify(customOnly));
    this.persistSession();
  }

  private persistSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const session = this.sessionSignal();
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}
