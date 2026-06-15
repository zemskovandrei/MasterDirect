import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CabinetSession,
  PerformerProfile,
  PerformerSocialLinks,
  PerformerType,
  WorkProject,
  WorkVerificationStatus,
} from '../models/portfolio.models';
import { normalizeSocialLinks } from '../utils/social-links.util';
import { normalizeCallOutFee } from '../utils/call-out-fee.util';
import {
  buildVerificationUrl,
  generateVerificationCode,
  generateVerificationToken,
  normalizeClientContact,
} from '../utils/work-verification.util';
import {
  markMastersWiped,
  shouldWipeCatalog,
  shouldWipeMasters,
  wipeCatalogStorage,
} from '../utils/catalog-wipe.util';

export interface WorkVerificationContext {
  work: WorkProject;
  performer: PerformerProfile;
}

export interface AddWorkResult {
  work: WorkProject;
  verificationLink: string | null;
  verificationCode: string | null;
}

const PERFORMERS_KEY = 'smartbuild-tech-performers';
const SESSION_KEY = 'smartbuild-tech-cabinet-session';
@Injectable({ providedIn: 'root' })
export class PortfolioStoreService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly performersSignal = signal<PerformerProfile[]>([]);
  private readonly sessionSignal = signal<CabinetSession | null>(null);

  readonly performers = this.performersSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();

  readonly brigades = computed(() => this.performersSignal().filter((p) => p.type === 'brigade'));

  readonly workers = computed(() => this.performersSignal().filter((p) => p.type === 'worker'));

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
    callOutFee?: string;
    socialLinks?: PerformerSocialLinks;
  }): PerformerProfile {
    const id = this.generateId(data.type, data.name);
    return this.registerPerformerWithId(id, data);
  }

  registerPerformerWithId(
    id: string,
    data: {
      type: PerformerType;
      name: string;
      specialty: string;
      description: string;
      callOutFee?: string;
      socialLinks?: PerformerSocialLinks;
    },
  ): PerformerProfile {
    const socialLinks = normalizeSocialLinks(data.socialLinks);
    const callOutFee = normalizeCallOutFee(data.callOutFee ?? '') || null;
    const performer: PerformerProfile = {
      id,
      type: data.type,
      name: data.name.trim(),
      specialty: data.specialty.trim(),
      description: data.description.trim(),
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : undefined,
      callOutFee,
      works: [],
    };

    this.performersSignal.update((list) => {
      const withoutDuplicate = list.filter((item) => item.id !== id);
      return [...withoutDuplicate, performer];
    });
    this.sessionSignal.set({ performerId: id });
    this.persist();
    return performer;
  }

  updatePerformerProfile(
    performerId: string,
    data: { name: string; specialty: string; description: string },
  ): boolean {
    const performer = this.performersSignal().find((item) => item.id === performerId);
    if (!performer) {
      return false;
    }

    this.performersSignal.update((list) =>
      list.map((item) =>
        item.id === performerId
          ? {
              ...item,
              name: data.name.trim(),
              specialty: data.specialty.trim(),
              description: data.description.trim(),
            }
          : item,
      ),
    );
    this.persist();
    return true;
  }

  updatePerformerHeaderBg(performerId: string, headerBg: string): boolean {
    const performer = this.performersSignal().find((item) => item.id === performerId);
    if (!performer) {
      return false;
    }

    this.performersSignal.update((list) =>
      list.map((item) =>
        item.id === performerId ? { ...item, headerBg: headerBg.trim() } : item,
      ),
    );
    this.persist();
    return true;
  }

  deletePerformer(performerId: string): boolean {
    const performer = this.performersSignal().find((item) => item.id === performerId);
    if (!performer) {
      return false;
    }

    this.performersSignal.update((list) => list.filter((item) => item.id !== performerId));

    const session = this.sessionSignal();
    if (session?.performerId === performerId) {
      this.sessionSignal.set(null);
    }

    this.persist();
    return true;
  }

  removePerformerIfExists(performerId: string): void {
    if (!this.performersSignal().some((item) => item.id === performerId)) {
      return;
    }
    this.deletePerformer(performerId);
  }

  setSession(performerId: string): void {
    if (!this.performersSignal().some((item) => item.id === performerId)) {
      return;
    }
    this.sessionSignal.set({ performerId });
    this.persistSession();
  }

  replacePerformersFromRemote(remote: PerformerProfile[]): void {
    const existing = this.performersSignal();
    const merged = remote.map((performer) => {
      const local = existing.find((item) => item.id === performer.id);
      return local ? { ...performer, works: local.works } : performer;
    });

    this.performersSignal.set(merged);
    this.persist();
  }

  updateSocialLinks(performerId: string, socialLinks: PerformerSocialLinks): void {
    const normalized = normalizeSocialLinks(socialLinks);

    this.performersSignal.update((list) =>
      list.map((performer) =>
        performer.id === performerId
          ? {
              ...performer,
              socialLinks: Object.keys(normalized).length > 0 ? normalized : undefined,
            }
          : performer,
      ),
    );
    this.persist();
  }

  addWork(
    performerId: string,
    data: {
      title: string;
      description: string;
      beforeImage: string;
      afterImage: string;
      clientContact?: string;
    },
  ): AddWorkResult | null {
    const performer = this.performersSignal().find((p) => p.id === performerId);
    if (!performer) {
      return null;
    }

    const clientContact = normalizeClientContact(data.clientContact ?? '');
    const wantsVerification = !!clientContact;
    const verificationToken = wantsVerification ? generateVerificationToken() : undefined;
    const verificationCode = wantsVerification ? generateVerificationCode() : undefined;

    const work: WorkProject = {
      id: `work-${Date.now()}`,
      title: data.title.trim(),
      description: data.description.trim(),
      beforeImage: data.beforeImage,
      afterImage: data.afterImage,
      createdAt: new Date().toISOString(),
      verificationStatus: wantsVerification ? 'pending' : 'not_requested',
      clientContact,
      verificationToken,
      verificationCode,
    };

    this.performersSignal.update((list) =>
      list.map((p) => (p.id === performerId ? { ...p, works: [work, ...p.works] } : p)),
    );
    this.persist();

    const origin = this.appOrigin();
    return {
      work,
      verificationLink: verificationToken ? buildVerificationUrl(verificationToken, origin) : null,
      verificationCode: verificationCode ?? null,
    };
  }

  getVerificationContext(token: string): WorkVerificationContext | null {
    const normalized = token.trim();
    if (!normalized) {
      return null;
    }

    for (const performer of this.performersSignal()) {
      const work = performer.works.find(
        (item) => item.verificationToken === normalized && item.verificationStatus === 'pending',
      );
      if (work) {
        return { work, performer };
      }
    }
    return null;
  }

  respondToVerification(
    token: string,
    action: 'confirm' | 'reject',
  ): { status: WorkVerificationStatus; work: WorkProject } | null {
    const context = this.getVerificationContext(token);
    if (!context) {
      return null;
    }

    const nextStatus: WorkVerificationStatus = action === 'confirm' ? 'verified' : 'rejected';
    const now = new Date().toISOString();
    let updatedWork: WorkProject | null = null;

    this.performersSignal.update((list) =>
      list.map((performer) => {
        if (performer.id !== context.performer.id) {
          return performer;
        }

        return {
          ...performer,
          works: performer.works.map((item) => {
            if (item.id !== context.work.id) {
              return item;
            }

            updatedWork = {
              ...item,
              verificationStatus: nextStatus,
              verificationToken: undefined,
              verificationCode: undefined,
              verifiedAt: action === 'confirm' ? now : item.verifiedAt,
              rejectedAt: action === 'reject' ? now : item.rejectedAt,
            };
            return updatedWork;
          }),
        };
      }),
    );

    if (!updatedWork) {
      return null;
    }

    this.persist();
    return { status: nextStatus, work: updatedWork };
  }

  verificationLinkForWork(work: WorkProject): string | null {
    if (!work.verificationToken || work.verificationStatus !== 'pending') {
      return null;
    }
    return buildVerificationUrl(work.verificationToken, this.appOrigin());
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

    if (shouldWipeCatalog()) {
      wipeCatalogStorage();
      this.performersSignal.set([]);
      this.sessionSignal.set(null);
      return;
    }

    try {
      const raw = localStorage.getItem(PERFORMERS_KEY);
      if (!raw) {
        if (shouldWipeMasters()) {
          markMastersWiped();
        }
        this.performersSignal.set([]);
        return;
      }

      let performers = (JSON.parse(raw) as PerformerProfile[])
        .filter((p) => !p.isDemo)
        .map((performer) => ({
          ...performer,
          socialLinks: normalizeSocialLinks(performer.socialLinks),
          works: performer.works.map((item) => this.normalizeWork(item)),
        }));

      if (shouldWipeMasters()) {
        performers = performers.filter((p) => p.type !== 'worker');
        markMastersWiped();
        localStorage.setItem(PERFORMERS_KEY, JSON.stringify(performers));
      }

      this.performersSignal.set(performers);

      const sessionRaw = localStorage.getItem(SESSION_KEY);
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw) as CabinetSession;
        const current = performers.find((p) => p.id === session.performerId);
        if (current) {
          this.sessionSignal.set(session);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch {
      localStorage.removeItem(PERFORMERS_KEY);
      localStorage.removeItem(SESSION_KEY);
      this.performersSignal.set([]);
      this.sessionSignal.set(null);
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const performers = this.performersSignal().filter((p) => !p.isDemo);
    localStorage.setItem(PERFORMERS_KEY, JSON.stringify(performers));
    this.persistSession();
  }

  private normalizeWork(work: WorkProject): WorkProject {
    return {
      ...work,
      verificationStatus: work.verificationStatus ?? 'not_requested',
    };
  }

  private appOrigin(): string {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://smartbuild.tech';
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
