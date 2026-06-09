import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, tap } from 'rxjs';
import { FurnitureCompany } from '../models/furniture.models';
import {
  Profile,
  ProfileInsert,
  ProfileType,
  ProfileUpdate,
} from '../models/profile.models';
import { PerformerProfile } from '../models/portfolio.models';
import {
  profileInsertToRow,
  profileToFurnitureCompany,
  profileToPerformer,
} from '../utils/profile-mapper.util';
import { FurnitureStoreService } from './furniture-store.service';
import { PortfolioStoreService } from './portfolio-store.service';

const supabaseUrl = 'ВСТАВЬ_СЮДА_PROJECT_URL';
const supabaseAnonKey = 'ВСТАВЬ_СЮДА_ANON_PUBLIC_KEY';

export interface SupabaseMutationResult<T = Profile> {
  data: T | null;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);

  private client: SupabaseClient | null = null;

  private readonly profilesSignal = signal<Profile[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);

  readonly profiles = this.profilesSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  readonly brigades = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'brigade')
      .map((profile) => this.toPerformer(profile)),
  );

  readonly workers = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'worker')
      .map((profile) => this.toPerformer(profile)),
  );

  readonly furnitureCompanies = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'furniture')
      .map((profile) => this.toFurnitureCompany(profile)),
  );

  /** Загрузка всех профилей из Supabase. */
  loadProfiles(): Observable<Profile[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return from(Promise.resolve([]));
    }

    this.loadingSignal.set(true);

    return from(
      this.getClient()!
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            throw new Error(error.message);
          }
          return (data ?? []) as Profile[];
        }),
    ).pipe(
      tap({
        next: (profiles) => {
          this.profilesSignal.set(profiles);
          this.loadedSignal.set(true);
          this.loadingSignal.set(false);
          this.syncLocalStores(profiles);
        },
        error: () => {
          this.loadingSignal.set(false);
          this.loadedSignal.set(true);
        },
      }),
    );
  }

  /** Профили по типу: worker | brigade | furniture. */
  getProfilesByType(type: ProfileType): Observable<Profile[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return from(Promise.resolve([]));
    }

    return from(
      this.getClient()!
        .from('profiles')
        .select('*')
        .eq('type', type)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            throw new Error(error.message);
          }
          return (data ?? []) as Profile[];
        }),
    );
  }

  insertProfile(input: ProfileInsert): Observable<SupabaseMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return from(Promise.resolve({ data: null, error: 'Browser only' }));
    }

    return from(
      this.getClient()!
        .from('profiles')
        .insert([profileInsertToRow(input)])
        .select('*')
        .single()
        .then(({ data, error }) => ({
          data: (data as Profile | null) ?? null,
          error: error?.message ?? null,
        })),
    ).pipe(
      tap((result) => {
        if (result.data) {
          this.profilesSignal.update((list) => [result.data!, ...list.filter((p) => p.id !== result.data!.id)]);
          this.syncLocalStores(this.profilesSignal());
          this.setSessionForProfile(result.data);
        }
      }),
    );
  }

  updateProfile(id: string, patch: ProfileUpdate): Observable<SupabaseMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return from(Promise.resolve({ data: null, error: 'Browser only' }));
    }

    const row: Record<string, string | null> = {};
    if (patch.name !== undefined) row['name'] = patch.name.trim();
    if (patch.specialty !== undefined) row['specialty'] = patch.specialty.trim();
    if (patch.description !== undefined) row['description'] = patch.description.trim();
    if (patch.city !== undefined) row['city'] = patch.city.trim() || null;

    return from(
      this.getClient()!
        .from('profiles')
        .update(row)
        .eq('id', id)
        .select('*')
        .single()
        .then(({ data, error }) => ({
          data: (data as Profile | null) ?? null,
          error: error?.message ?? null,
        })),
    ).pipe(
      tap((result) => {
        if (result.data) {
          this.profilesSignal.update((list) =>
            list.map((profile) => (profile.id === id ? result.data! : profile)),
          );
          this.syncLocalStores(this.profilesSignal());
        }
      }),
    );
  }

  deleteProfile(id: string): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return from(Promise.resolve({ data: null, error: 'Browser only' }));
    }

    return from(
      this.getClient()!
        .from('profiles')
        .delete()
        .eq('id', id)
        .then(({ error }) => ({
          data: null,
          error: error?.message ?? null,
        })),
    ).pipe(
      tap((result) => {
        if (!result.error) {
          this.profilesSignal.update((list) => list.filter((profile) => profile.id !== id));
          this.syncLocalStores(this.profilesSignal());
          this.portfolioStore.removePerformerIfExists(id);
          this.furnitureStore.removeCompanyIfExists(id);
        }
      }),
    );
  }

  get clientInstance(): SupabaseClient | null {
    return this.getClient();
  }

  private getClient(): SupabaseClient | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    if (!this.client) {
      this.client = createClient(supabaseUrl, supabaseAnonKey);
    }

    return this.client;
  }

  private toPerformer(profile: Profile): PerformerProfile {
    const local =
      profile.type === 'furniture'
        ? undefined
        : this.portfolioStore
            .performers()
            .find((item) => item.id === profile.id && item.type === profile.type);
    return profileToPerformer(profile, local?.works ?? []);
  }

  private toFurnitureCompany(profile: Profile): FurnitureCompany {
    const local = this.furnitureStore.companies().find((item) => item.id === profile.id);
    return profileToFurnitureCompany(profile, local?.works ?? []);
  }

  private syncLocalStores(profiles: Profile[]): void {
    const performers = profiles
      .filter((profile) => profile.type === 'worker' || profile.type === 'brigade')
      .map((profile) => this.toPerformer(profile));
    const companies = profiles
      .filter((profile) => profile.type === 'furniture')
      .map((profile) => this.toFurnitureCompany(profile));

    this.portfolioStore.replacePerformersFromRemote(performers);
    this.furnitureStore.replaceCompaniesFromRemote(companies);
  }

  private setSessionForProfile(profile: Profile) {
    if (profile.type === 'furniture') {
      this.furnitureStore.setSession(profile.id);
      return;
    }

    this.portfolioStore.setSession(profile.id);
  }
}
