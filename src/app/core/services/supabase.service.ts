import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FurnitureCompany } from '../models/furniture.models';
import { Profile, ProfileInsert, ProfileType, ProfileUpdate } from '../models/profile.models';
import { PerformerProfile } from '../models/portfolio.models';
import {
  furnitureCompanyToProfile,
  furnitureOrderRowToProfile,
  masterRowToProfile,
  brigadeRowToProfile,
  performerToProfile,
  profileToFurnitureCompany,
  profileToPerformer,
} from '../utils/profile-mapper.util';
import { FurnitureStoreService } from './furniture-store.service';
import { PortfolioStoreService } from './portfolio-store.service';
import { environment } from '../../../environments/environment';
import {
  Job,
  JobklientJobInsert,
  mapJobklientRowsToJobs,
  toFurnitureOrderDbRow,
  toJobklientDbRow,
} from '../../models/job.model';
import type {
  BrigadeRow,
  FurnitureOrderInsert,
  FurnitureOrderRow,
  MasterRow,
} from '../models/master.model';
import { profileMatchesCatalogCity } from '../utils/catalog-filter.util';
import { logSupabaseError } from '../utils/supabase-error.util';
import { isUuid, normalizeUuid } from '../utils/furniture-id.util';

const SUPABASE_NOT_CONFIGURED =
  'Supabase не настроен. Укажите url и anonKey в src/environments/environment.ts';

const JOBS_CACHE_KEY = 'smartbuild.jobs.v3';
const JOBS_CACHE_TTL_MS = 2 * 60 * 1000;
const JOBS_LIST_COLUMNS =
  'id,title,client_name,phone,city,category,budget,description,status,created_at';

export interface SupabaseMutationResult<T = Profile> {
  data: T | null;
  error: string | null;
}

export interface JobklientInsertResult {
  data: Record<string, unknown> | null;
  error: string | null;
  supabaseError?: unknown;
}

export interface FurnitureOrderInsertResult {
  data: Record<string, unknown> | null;
  error: string | null;
  supabaseError?: unknown;
}

export interface JobklientMutationResult {
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);

  private supabaseClient: SupabaseClient | null = null;
  private clientPromise: Promise<SupabaseClient | null> | null = null;
  private jobsFetchPromise: Promise<Job[]> | null = null;
  private memoryJobsCache: { at: number; jobs: Job[] } | null = null;
  private profilesRefreshPromise: Promise<Profile[]> | null = null;

  private readonly profilesSignal = signal<Profile[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);
  /** Фильтр по городу в каталоге — по умолчанию выключен. */
  private readonly catalogCityFilterEnabledSignal = signal(false);
  private readonly catalogCityFilterSignal = signal<string | null>(null);
  private readonly activeJobsSignal = signal<Job[]>([]);
  private readonly jobsLoadingSignal = signal(false);
  private readonly jobsErrorSignal = signal<string | null>(null);
  private readonly jobsAccessDeniedSignal = signal(false);

  readonly profiles = this.profilesSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly activeJobs = this.activeJobsSignal.asReadonly();
  readonly jobsLoading = this.jobsLoadingSignal.asReadonly();
  readonly jobsError = this.jobsErrorSignal.asReadonly();
  readonly jobsAccessDenied = this.jobsAccessDeniedSignal.asReadonly();
  readonly catalogCityFilterEnabled = this.catalogCityFilterEnabledSignal.asReadonly();
  readonly catalogCityFilter = this.catalogCityFilterSignal.asReadonly();
  readonly catalogReady = computed(() => this.loadedSignal() && !this.loadingSignal());

  readonly brigades = computed(() => {
    const filterEnabled = this.catalogCityFilterEnabledSignal();
    const filterCity = this.catalogCityFilterSignal();

    return this.profilesSignal()
      .filter((profile) => profile.type === 'brigade')
      .filter((profile) => profileMatchesCatalogCity(profile, filterCity, filterEnabled))
      .map((profile) => this.toPerformer(profile));
  });

  readonly workers = computed(() => {
    const filterEnabled = this.catalogCityFilterEnabledSignal();
    const filterCity = this.catalogCityFilterSignal();

    return this.profilesSignal()
      .filter((profile) => profile.type === 'worker')
      .filter((profile) => profileMatchesCatalogCity(profile, filterCity, filterEnabled))
      .map((profile) => this.toPerformer(profile));
  });

  readonly furnitureCompanies = computed(() => {
    const filterEnabled = this.catalogCityFilterEnabledSignal();
    const filterCity = this.catalogCityFilterSignal();

    return this.profilesSignal()
      .filter((profile) => profile.type === 'furniture')
      .filter((profile) => profileMatchesCatalogCity(profile, filterCity, filterEnabled))
      .map((profile) => this.toFurnitureCompany(profile));
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const cached = this.readJobsCache();
      if (cached) {
        this.activeJobsSignal.set(cached.jobs);
      }

      console.info('[SupabaseService] runtime config', {
        production: environment.production,
        url: environment.supabase.url,
        jobsTable: environment.supabase.jobsTable,
        configured: this.isConfigured(),
      });
    }
  }

  prefetchActiveJobs(): void {
    if (!isPlatformBrowser(this.platformId) || !this.isConfigured()) {
      return;
    }

    void this.loadActiveJobs();
  }

  async loadJobsForAuthenticatedMaster(force = false): Promise<Job[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    if (!this.isConfigured()) {
      logSupabaseError('loadJobsForAuthenticatedMaster', new Error(SUPABASE_NOT_CONFIGURED));
      throw new Error(SUPABASE_NOT_CONFIGURED);
    }

    this.jobsLoadingSignal.set(true);
    this.jobsErrorSignal.set(null);
    this.jobsAccessDeniedSignal.set(false);

    try {
      const client = await this.resolveClient();
      if (!client) {
        throw new Error(SUPABASE_NOT_CONFIGURED);
      }

      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();

      if (authError) {
        logSupabaseError('loadJobsForAuthenticatedMaster.auth', authError);
      }

      if (authError || !user) {
        this.jobsAccessDeniedSignal.set(true);
        this.activeJobsSignal.set([]);
        return [];
      }

      const { data: master, error: masterError } = await client
        .from(environment.supabase.mastersTable)
        .select('city')
        .eq('id', user.id)
        .maybeSingle();

      if (masterError) {
        logSupabaseError('loadJobsForAuthenticatedMaster.masterCity', masterError);
        throw new Error(masterError.message);
      }

      const masterCity = master?.city?.trim();
      if (!masterCity) {
        this.activeJobsSignal.set([]);
        this.jobsErrorSignal.set('Master city is not set');
        return [];
      }

      const cached = force ? null : this.readJobsCache();
      if (cached && cached.jobs.length > 0 && !force) {
        const filtered = cached.jobs.filter((job) => job.city === masterCity);
        this.activeJobsSignal.set(filtered);
        if (Date.now() - cached.at < JOBS_CACHE_TTL_MS) {
          return filtered;
        }
      }

      const rows = await this.fetchJobklientRows({ city: masterCity });
      const jobs = mapJobklientRowsToJobs(rows);
      this.activeJobsSignal.set(jobs);
      if (jobs.length > 0) {
        this.writeJobsCache(jobs);
      } else {
        this.invalidateJobsCache();
      }
      return jobs;
    } catch (err) {
      logSupabaseError('loadJobsForAuthenticatedMaster', err);
      this.activeJobsSignal.set([]);
      this.jobsErrorSignal.set(err instanceof Error ? err.message : 'Failed to load jobs');
      throw err;
    } finally {
      this.jobsLoadingSignal.set(false);
    }
  }

  getClient(): Promise<SupabaseClient | null> {
    return this.resolveClient();
  }

  async loadActiveJobs(force = false): Promise<Job[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    if (!this.isConfigured()) {
      logSupabaseError('loadActiveJobs', new Error(SUPABASE_NOT_CONFIGURED));
      throw new Error(SUPABASE_NOT_CONFIGURED);
    }

    const cached = force ? null : this.readJobsCache();
    if (cached && cached.jobs.length > 0) {
      this.activeJobsSignal.set(cached.jobs);
      this.jobsErrorSignal.set(null);

      if (Date.now() - cached.at < JOBS_CACHE_TTL_MS) {
        return cached.jobs;
      }

      void this.refreshActiveJobs(false);
      return cached.jobs;
    }

    this.jobsLoadingSignal.set(true);
    this.jobsErrorSignal.set(null);
    return this.refreshActiveJobs(true);
  }

  /** @deprecated Use loadActiveJobs() */
  async getActiveJobs(): Promise<Job[]> {
    return this.loadActiveJobs();
  }

  /** @deprecated Use loadActiveJobs() */
  async fetchActiveJobs(): Promise<Job[]> {
    return this.loadActiveJobs();
  }

  insertJobklientJob(input: JobklientJobInsert): Observable<JobklientInsertResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.insertJobklientJobRow(input));
  }

  async insertJobklientJobAsync(input: JobklientJobInsert): Promise<JobklientInsertResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { data: null, error: 'Browser only' };
    }

    return this.insertJobklientJobRow(input);
  }

  insertFurnitureOrder(input: FurnitureOrderInsert): Observable<FurnitureOrderInsertResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.insertFurnitureOrderRow(input));
  }

  async insertFurnitureOrderAsync(
    input: FurnitureOrderInsert,
  ): Promise<FurnitureOrderInsertResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { data: null, error: 'Browser only' };
    }

    return this.insertFurnitureOrderRow(input);
  }

  completeJobklientJob(id: string): Observable<JobklientMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ error: 'Browser only' });
    }

    return from(this.updateJobklientStatusRow(id, 'Completed'));
  }

  deleteJobklientJob(id: string): Observable<JobklientMutationResult> {
    return this.deleteJob(id);
  }

  /** Удаление заказа из таблицы Supabase `jobklient` по UUID. */
  deleteJob(id: string): Observable<JobklientMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ error: 'Browser only' });
    }

    return from(this.deleteJobklientJobRow(id)).pipe(
      catchError((err) => {
        console.error('Jobklient delete error:', err);
        return of({ error: err instanceof Error ? err.message : 'Delete failed' });
      }),
    );
  }

  loadProfiles(): Observable<Profile[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return from(this.refreshProfilesFromDatabase()).pipe(
      catchError((err) => {
        logSupabaseError('loadProfiles', err);
        return of([]);
      }),
    );
  }

  getProfilesByType(type: ProfileType): Observable<Profile[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return from(
      this.refreshProfilesFromDatabase().then((profiles) =>
        profiles.filter((profile) => profile.type === type),
      ),
    ).pipe(
      catchError((err) => {
        logSupabaseError(`getProfilesByType:${type}`, err);
        return of([]);
      }),
    );
  }

  insertProfile(input: ProfileInsert): Observable<SupabaseMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    const socialLinks = {
      phone: input.phone,
      whatsapp: input.whatsapp,
      telegram: input.telegram,
      instagram: input.instagram,
      facebook: input.facebook,
    };

    let profile: Profile;

    if (input.type === 'furniture') {
      const company = this.furnitureStore.registerCompany({
        name: input.name,
        specialty: input.specialty,
        description: input.description,
        city: input.city,
        socialLinks,
      });
      profile = furnitureCompanyToProfile(company);
    } else {
      const performer = this.portfolioStore.registerPerformer({
        type: input.type,
        name: input.name,
        specialty: input.specialty,
        description: input.description,
        callOutFee: input.callOutFee,
        socialLinks,
      });
      profile = performerToProfile(performer);
    }

    this.refreshProfilesFromLocalStores();
    return of({ data: profile, error: null });
  }

  updateProfile(id: string, patch: ProfileUpdate): Observable<SupabaseMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.updateProfileRow(id, patch));
  }

  deleteProfile(id: string, type?: ProfileType): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.deleteProfileRow(id, type)).pipe(
      catchError((err) => {
        console.error('Delete error:', err);
        return of({
          data: null,
          error: err instanceof Error ? err.message : 'Delete failed',
        });
      }),
    );
  }

  deleteMaster(id: string): Observable<SupabaseMutationResult<null>> {
    return this.deleteProfile(id, 'worker');
  }

  deleteBrigade(id: string): Observable<SupabaseMutationResult<null>> {
    return this.deleteProfile(id, 'brigade');
  }

  deleteFurnitureOrder(id: string): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.deleteFurnitureOrderRow(id)).pipe(
      catchError((err) => {
        console.error('Furniture delete error:', err);
        return of({
          data: null,
          error: err instanceof Error ? err.message : 'Delete failed',
        });
      }),
    );
  }

  async updateMasterHeaderBg(
    masterId: string,
    headerBg: string,
  ): Promise<SupabaseMutationResult> {
    const trimmedId = masterId?.trim();
    const color = headerBg?.trim();
    if (!trimmedId || !color) {
      return { data: null, error: 'Invalid theme data' };
    }

    if (!isPlatformBrowser(this.platformId)) {
      return { data: null, error: 'Browser only' };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const { data, error } = await client
        .from(environment.supabase.mastersTable)
        .update({ header_bg: color })
        .eq('id', trimmedId)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('[SupabaseService] updateMasterHeaderBg:', error.message);
        return { data: null, error: error.message };
      }

      if (!data) {
        return { data: null, error: 'Profile not found' };
      }

      await this.refreshProfilesFromDatabase();
      return { data: masterRowToProfile(data as MasterRow), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      console.error('[SupabaseService] updateMasterHeaderBg:', err);
      return { data: null, error: message };
    }
  }

  private async updateProfileRow(
    id: string,
    patch: ProfileUpdate,
  ): Promise<SupabaseMutationResult> {
    const name = patch.name?.trim();
    const specialty = patch.specialty?.trim();
    const description = patch.description?.trim();

    if (!name || !specialty || !description) {
      return { data: null, error: 'Invalid profile data' };
    }

    const updatedLocally = this.portfolioStore.updatePerformerProfile(id, {
      name,
      specialty,
      description,
    });

    if (updatedLocally) {
      const profiles = await this.refreshProfilesFromDatabase();
      const profile = profiles.find((item) => item.id === id) ?? null;
      return { data: profile, error: null };
    }

    const masterProfile = this.profilesSignal().find(
      (item) => item.id === id && item.type !== 'furniture',
    );
    if (!masterProfile) {
      return { data: null, error: 'Profile not found' };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const patchPayload = {
        full_name: name,
        specialty,
        description,
      };

      if (masterProfile.type === 'brigade') {
        const { data: brigadeData, error: brigadeError } = await client
          .from(environment.supabase.brigadesTable)
          .update(patchPayload)
          .eq('id', id)
          .select('*')
          .maybeSingle();

        if (brigadeError) {
          console.error('[SupabaseService] updateProfile (brigades):', brigadeError.message);
          return { data: null, error: brigadeError.message };
        }

        if (brigadeData) {
          await this.refreshProfilesFromDatabase();
          return { data: brigadeRowToProfile(brigadeData as BrigadeRow), error: null };
        }
      }

      const { data, error } = await client
        .from(environment.supabase.mastersTable)
        .update(patchPayload)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('[SupabaseService] updateProfile:', error.message);
        return { data: null, error: error.message };
      }

      if (!data) {
        return { data: null, error: 'Profile not found' };
      }

      await this.refreshProfilesFromDatabase();
      return { data: masterRowToProfile(data as MasterRow), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      console.error('[SupabaseService] updateProfile:', err);
      return { data: null, error: message };
    }
  }

  private async deleteProfileRow(
    id: string,
    type?: ProfileType,
  ): Promise<SupabaseMutationResult<null>> {
    const trimmedId = id?.trim();
    if (!trimmedId) {
      console.error('Delete error:', 'Missing profile id');
      return { data: null, error: 'Missing profile id' };
    }

    const profile = this.profilesSignal().find((item) => item.id === trimmedId);
    const resolvedType = type ?? profile?.type;

    if (resolvedType === 'furniture') {
      return this.deleteFurnitureOrderRow(trimmedId);
    }

    if (resolvedType === 'brigade') {
      return this.deleteBrigadeRow(trimmedId);
    }

    return this.deleteMasterRow(trimmedId);
  }

  private removeProfileFromState(id: string): void {
    const target = id.trim();
    this.profilesSignal.update((profiles) =>
      profiles.filter((profile) => profile.id !== target && profile.slug !== target),
    );
    this.portfolioStore.deletePerformer(target);
    this.furnitureStore.removeCompanyIfExists(target);
  }

  private removeLocalFurnitureBySlug(slug: string): void {
    const target = slug.trim();
    if (!target) {
      return;
    }

    this.furnitureStore.removeCompanyIfExists(target);
    this.profilesSignal.update((profiles) =>
      profiles.filter((profile) => profile.id !== target && profile.slug !== target),
    );
  }

  private resolveFurnitureOrderDbId(idOrSlug: string): string | null {
    const key = idOrSlug.trim();
    if (!key) {
      return null;
    }

    if (isUuid(key)) {
      return key;
    }

    const furnitureProfiles = this.profilesSignal().filter(
      (profile) => profile.type === 'furniture',
    );
    const matchedProfile = furnitureProfiles.find(
      (profile) => profile.id === key || profile.slug === key,
    );
    if (matchedProfile && isUuid(matchedProfile.id)) {
      return matchedProfile.id;
    }

    const localCompany = this.furnitureStore.getCompany(key);
    if (!localCompany) {
      return null;
    }

    const localDbId = normalizeUuid(localCompany.dbId);
    if (localDbId) {
      return localDbId;
    }

    const byName = furnitureProfiles.find(
      (profile) =>
        isUuid(profile.id) &&
        profile.name.trim().toLowerCase() === localCompany.name.trim().toLowerCase(),
    );
    return byName && isUuid(byName.id) ? byName.id : null;
  }

  private logFurnitureDeleteResponse(
    error: { message?: string; details?: string } | null,
    dbId: string,
  ): void {
    if (error) {
      console.error(
        'КРИТИЧЕСКАЯ ОШИБКА Supabase при удалении мебели:',
        error.message,
        error.details,
        {
          dbId,
        },
      );
      return;
    }

    console.log('Успешный ответ Supabase при удалении мебели:', { id: dbId });
  }

  private async deleteFurnitureOrderRow(id: string): Promise<SupabaseMutationResult<null>> {
    const dbId = normalizeUuid(id?.trim()) || this.resolveFurnitureOrderDbId(id?.trim() ?? '');
    if (!dbId) {
      console.error('Furniture delete error: missing UUID', id);
      return { data: null, error: 'Missing furniture order UUID (dbId)' };
    }

    try {
      if (!this.isConfigured()) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      console.log('[SupabaseService] deleteFurnitureOrder: DELETE by id', dbId);

      const { error } = await client
        .from(environment.supabase.furnitureOrdersTable)
        .delete()
        .eq('id', dbId);

      this.logFurnitureDeleteResponse(error, dbId);

      if (error) {
        return { data: null, error: error.message };
      }

      this.removeProfileFromState(dbId);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      console.error('КРИТИЧЕСКАЯ ОШИБКА Supabase при удалении мебели:', err);
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { data: null, error: message };
    }
  }

  private async deleteMasterRow(id: string): Promise<SupabaseMutationResult<null>> {
    if (this.portfolioStore.deletePerformer(id)) {
      this.removeProfileFromState(id);
      void this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const { data, error } = await client
        .from(environment.supabase.mastersTable)
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('Delete error:', error);
        return { data: null, error: error.message };
      }

      if (!data?.length) {
        const message = 'Master not found or access denied';
        console.error('Delete error:', message);
        return { data: null, error: message };
      }

      this.removeProfileFromState(id);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      console.error('Delete error:', err);
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { data: null, error: message };
    }
  }

  private async deleteBrigadeRow(id: string): Promise<SupabaseMutationResult<null>> {
    if (this.portfolioStore.deletePerformer(id)) {
      this.removeProfileFromState(id);
      void this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const { data: brigadeRows, error: brigadeError } = await client
        .from(environment.supabase.brigadesTable)
        .delete()
        .eq('id', id)
        .select('id');

      const { data: masterRows, error: masterError } = await client
        .from(environment.supabase.mastersTable)
        .delete()
        .eq('id', id)
        .select('id');

      if (brigadeError) {
        console.error('Delete error (brigades):', brigadeError);
      }
      if (masterError) {
        console.error('Delete error (masters):', masterError);
      }

      if (brigadeError && masterError) {
        return { data: null, error: brigadeError.message || masterError.message };
      }

      const deletedCount = (brigadeRows?.length ?? 0) + (masterRows?.length ?? 0);
      if (deletedCount === 0) {
        const message =
          brigadeError?.message || masterError?.message || 'Brigade not found or access denied';
        console.error('Delete error:', message);
        return { data: null, error: message };
      }

      this.removeProfileFromState(id);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      console.error('Delete error:', err);
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { data: null, error: message };
    }
  }

  get clientInstance(): SupabaseClient | null {
    return this.supabaseClient;
  }

  private get supabase(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new Error(SUPABASE_NOT_CONFIGURED);
    }

    return this.supabaseClient;
  }

  isConfigured(): boolean {
    const { url, anonKey } = environment.supabase;
    if (!url?.trim() || !anonKey?.trim()) {
      return false;
    }

    if (url.includes('YOUR_SUPABASE') || anonKey.includes('YOUR_SUPABASE')) {
      return false;
    }

    if (/localhost|127\.0\.0\.1/i.test(url)) {
      return false;
    }

    const hasSupabaseHost = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i.test(url.trim());
    const hasPublicKey =
      anonKey.startsWith('eyJ') ||
      anonKey.startsWith('sb_publishable_') ||
      anonKey.startsWith('sb_');

    return hasSupabaseHost && hasPublicKey && anonKey.length > 20;
  }

  private async insertJobklientJobRow(input: JobklientJobInsert): Promise<JobklientInsertResult> {
    try {
      if (!this.isConfigured()) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      // Только колонки таблицы jobklient (snake_case), без лишних полей.
      const row = toJobklientDbRow(input);

      const { data, error } = await client
        .from(environment.supabase.jobsTable)
        .insert([row])
        .select('*')
        .single();

      if (error) {
        logSupabaseError('insertJobklientJob', error);
        console.error('[SupabaseService] insertJobklientJob payload:', row);
        return {
          data: null,
          error: error.message,
          supabaseError: error,
        };
      }

      this.invalidateJobsCache();
      return { data: (data as Record<string, unknown> | null) ?? null, error: null };
    } catch (err) {
      logSupabaseError('insertJobklientJob', err);
      const message = err instanceof Error ? err.message : 'Insert failed';
      return { data: null, error: message, supabaseError: err };
    }
  }

  private async insertFurnitureOrderRow(
    input: FurnitureOrderInsert,
  ): Promise<FurnitureOrderInsertResult> {
    try {
      if (!this.isConfigured()) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const row = toFurnitureOrderDbRow(input);
      const payload = {
        client_name: row.client_name,
        client_phone: row.client_phone,
        furniture_type: row.furniture_type,
        work_type: row.work_type,
        description: row.description,
      };

      const { data, error } = await client
        .from(environment.supabase.furnitureOrdersTable)
        .insert([payload])
        .select('*')
        .single();

      if (error) {
        logSupabaseError('insertFurnitureOrder', error);
        console.error('[SupabaseService] insertFurnitureOrder payload:', payload);
        return {
          data: null,
          error: error.message,
          supabaseError: error,
        };
      }

      return { data: (data as Record<string, unknown> | null) ?? null, error: null };
    } catch (err) {
      logSupabaseError('insertFurnitureOrder', err);
      const message = err instanceof Error ? err.message : 'Insert failed';
      return { data: null, error: message, supabaseError: err };
    }
  }

  private async refreshActiveJobs(showLoading: boolean): Promise<Job[]> {
    if (this.jobsFetchPromise) {
      return this.jobsFetchPromise;
    }

    if (showLoading) {
      this.jobsLoadingSignal.set(true);
    }

    this.jobsFetchPromise = (async () => {
      try {
        const data = await this.fetchJobklientRows();
        const jobs = mapJobklientRowsToJobs(data);
        this.activeJobsSignal.set(jobs);
        this.jobsErrorSignal.set(null);
        if (jobs.length > 0) {
          this.writeJobsCache(jobs);
        } else {
          this.invalidateJobsCache();
        }
        return jobs;
      } catch (err) {
        logSupabaseError('loadActiveJobs', err);
        if (showLoading || this.activeJobsSignal().length === 0) {
          this.activeJobsSignal.set([]);
          this.jobsErrorSignal.set(err instanceof Error ? err.message : 'Failed to load jobs');
        }
        throw err;
      } finally {
        this.jobsLoadingSignal.set(false);
        this.jobsFetchPromise = null;
      }
    })();

    return this.jobsFetchPromise;
  }

  private readJobsCache(): { at: number; jobs: Job[] } | null {
    if (this.memoryJobsCache) {
      return this.memoryJobsCache;
    }

    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const raw = sessionStorage.getItem(JOBS_CACHE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as {
        at: number;
        jobs: Array<Omit<Job, 'createdAt'> & { createdAt: string | null }>;
      };

      if (!Array.isArray(parsed.jobs)) {
        return null;
      }

      const jobs = parsed.jobs.map((job) => ({
        ...job,
        createdAt: job.createdAt ? new Date(job.createdAt) : null,
      }));

      this.memoryJobsCache = { at: parsed.at, jobs };
      return this.memoryJobsCache;
    } catch {
      return null;
    }
  }

  private writeJobsCache(jobs: Job[]): void {
    const entry = {
      at: Date.now(),
      jobs,
    };

    this.memoryJobsCache = entry;

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      sessionStorage.setItem(
        JOBS_CACHE_KEY,
        JSON.stringify({
          at: entry.at,
          jobs: jobs.map((job) => ({
            ...job,
            createdAt: job.createdAt?.toISOString() ?? null,
          })),
        }),
      );
    } catch {
      // Ignore quota or private mode errors.
    }
  }

  private invalidateJobsCache(): void {
    this.memoryJobsCache = null;

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      sessionStorage.removeItem(JOBS_CACHE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }

  private async updateJobklientStatusRow(
    id: string,
    status: string,
  ): Promise<JobklientMutationResult> {
    try {
      if (!this.isConfigured()) {
        return { error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { error: SUPABASE_NOT_CONFIGURED };
      }

      const { error } = await client
        .from(environment.supabase.jobsTable)
        .update({ status })
        .eq('id', id);

      if (error) {
        logSupabaseError('updateJobklientStatus', error);
        return { error: error.message };
      }

      this.removeJobFromLocalState(id);
      return { error: null };
    } catch (err) {
      logSupabaseError('updateJobklientStatus', err);
      const message = err instanceof Error ? err.message : 'Update failed';
      return { error: message };
    }
  }

  private async deleteJobklientJobRow(id: string): Promise<JobklientMutationResult> {
    const jobId = normalizeUuid(id?.trim());
    if (!jobId) {
      console.error('Jobklient delete error: missing UUID', id);
      return { error: 'Missing job id' };
    }

    try {
      if (!this.isConfigured()) {
        return { error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { error: SUPABASE_NOT_CONFIGURED };
      }

      console.log('[SupabaseService] deleteJobklientJob: DELETE by id', jobId);

      const { error } = await client.from(environment.supabase.jobsTable).delete().eq('id', jobId);

      if (error) {
        console.error('Jobklient delete error:', error.message, error.details);
        logSupabaseError('deleteJobklientJob', error);
        return { error: error.message };
      }

      console.log('Успешный ответ Supabase при удалении jobklient:', { id: jobId });
      this.removeJobFromLocalState(jobId);
      return { error: null };
    } catch (err) {
      console.error('Jobklient delete error:', err);
      logSupabaseError('deleteJobklientJob', err);
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { error: message };
    }
  }

  private removeJobFromLocalState(id: string): void {
    this.activeJobsSignal.update((jobs) => jobs.filter((job) => job.id !== id));

    const cached = this.readJobsCache();
    if (cached) {
      const nextJobs = cached.jobs.filter((job) => job.id !== id);
      if (nextJobs.length > 0) {
        this.writeJobsCache(nextJobs);
      } else {
        this.invalidateJobsCache();
      }
    }
  }

  private async fetchJobklientRows(filters?: { city?: string }): Promise<unknown[]> {
    const client = await this.resolveClient();
    if (!client) {
      throw new Error(SUPABASE_NOT_CONFIGURED);
    }

    let query = client
      .from(environment.supabase.jobsTable)
      .select(JOBS_LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters?.city) {
      query = query.eq('city', filters.city);
    }

    const { data, error } = await query;

    if (error) {
      logSupabaseError('fetchJobklientRows', error);
      throw new Error(error.message);
    }

    return data ?? [];
  }

  private resolveClient(): Promise<SupabaseClient | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(null);
    }

    if (!this.isConfigured()) {
      logSupabaseError('resolveClient', new Error(SUPABASE_NOT_CONFIGURED));
      return Promise.resolve(null);
    }

    if (this.supabaseClient) {
      return Promise.resolve(this.supabaseClient);
    }

    if (!this.clientPromise) {
      const { url, anonKey } = environment.supabase;
      this.clientPromise = import('@supabase/supabase-js')
        .then(({ createClient }) => {
          this.supabaseClient = createClient(url, anonKey, {
            auth: {
              persistSession: true,
              autoRefreshToken: true,
            },
            global: {
              // Нативный fetch браузера — без лишних заголовков Angular HttpClient.
              fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
            },
          });
          return this.supabaseClient;
        })
        .catch((err) => {
          logSupabaseError('createClient', err);
          this.clientPromise = null;
          return null;
        });
    }

    return this.clientPromise;
  }

  setCatalogCityFilter(city: string | null, enabled = false): void {
    this.catalogCityFilterSignal.set(city?.trim() || null);
    this.catalogCityFilterEnabledSignal.set(enabled);
  }

  private refreshProfilesFromDatabase(): Promise<Profile[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve([]);
    }

    if (!this.profilesRefreshPromise) {
      this.profilesRefreshPromise = this.fetchProfilesFromDatabase().finally(() => {
        this.profilesRefreshPromise = null;
      });
    }

    return this.profilesRefreshPromise;
  }

  private async fetchProfilesFromDatabase(): Promise<Profile[]> {
    this.loadingSignal.set(true);

    try {
      const client = await this.resolveClient();
      let masterProfiles: Profile[] = [];
      let brigadeProfiles: Profile[] = [];
      let furnitureProfilesFromDb: Profile[] = [];

      if (!client) {
        logSupabaseError(
          'refreshProfilesFromDatabase',
          new Error(
            this.isConfigured() ? 'Supabase client failed to initialize' : SUPABASE_NOT_CONFIGURED,
          ),
        );
        return this.profilesSignal();
      }

      {
        const { data: mastersData, error: mastersError } = await client
          .from(environment.supabase.mastersTable)
          .select('*')
          .order('created_at', { ascending: false });

        if (mastersError) {
          logSupabaseError('loadMasters', mastersError);
        } else if (mastersData) {
          for (const row of mastersData as MasterRow[]) {
            if (!row?.id) {
              continue;
            }

            const profile = masterRowToProfile(row);
            if (profile.name.trim().length === 0) {
              continue;
            }
            if (row.account_type === 'brigade') {
              brigadeProfiles.push(profile);
            } else {
              // worker, null или любое другое значение — показываем в каталоге мастеров
              masterProfiles.push(profile);
            }
          }
        }

        const brigadeById = new Map<string, Profile>(
          brigadeProfiles.map((profile) => [profile.id, profile]),
        );

        const { data: brigadesData, error: brigadesError } = await client
          .from(environment.supabase.brigadesTable)
          .select('*')
          .order('created_at', { ascending: false });

        if (brigadesError) {
          logSupabaseError('loadBrigades', brigadesError);
        } else {
          for (const row of (brigadesData as BrigadeRow[] | null) ?? []) {
            if (!row?.id) {
              continue;
            }

            const profile = brigadeRowToProfile(row);
            if (profile.name.trim().length > 0) {
              brigadeById.set(profile.id, profile);
            }
          }
        }

        brigadeProfiles = [...brigadeById.values()];

        const { data: furnitureData, error: furnitureError } = await client
          .from(environment.supabase.furnitureOrdersTable)
          .select('*')
          .order('created_at', { ascending: false });

        if (furnitureError) {
          logSupabaseError('loadFurnitureOrders', furnitureError);
        } else {
          furnitureProfilesFromDb =
            (furnitureData as FurnitureOrderRow[] | null)
              ?.map(furnitureOrderRowToProfile)
              .filter(
                (profile): profile is Profile => profile != null && profile.name.trim().length > 0,
              ) ?? [];
        }

        console.info('[SupabaseService] catalog loaded', {
          workers: masterProfiles.length,
          brigades: brigadeProfiles.length,
          furniture: furnitureProfilesFromDb.length,
        });

        const localFurnitureProfiles = this.furnitureStore
          .companies()
          .map((company) => furnitureCompanyToProfile(company));
        const furnitureById = new Map<string, Profile>();
        const dbNames = new Set(
          furnitureProfilesFromDb.map((profile) => profile.name.trim().toLowerCase()),
        );

        for (const profile of furnitureProfilesFromDb) {
          furnitureById.set(profile.id, profile);
        }

        for (const profile of localFurnitureProfiles) {
          if (isUuid(profile.id)) {
            furnitureById.set(profile.id, profile);
            continue;
          }

          if (dbNames.has(profile.name.trim().toLowerCase())) {
            continue;
          }

          furnitureById.set(profile.id, profile);
        }
        const furnitureProfiles = [...furnitureById.values()];
        const profiles = [...brigadeProfiles, ...masterProfiles, ...furnitureProfiles];
        this.profilesSignal.set(profiles);
        this.loadedSignal.set(true);
        return profiles;
      }
    } catch (err) {
      logSupabaseError('refreshProfilesFromDatabase', err);
      throw err;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private buildProfilesFromLocalStores(): Profile[] {
    const performers = this.portfolioStore
      .performers()
      .map((performer) => performerToProfile(performer));
    const companies = this.furnitureStore
      .companies()
      .map((company) => furnitureCompanyToProfile(company));

    return [...performers, ...companies];
  }

  private refreshProfilesFromLocalStores(): void {
    void this.refreshProfilesFromDatabase();
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
    const local = this.furnitureStore
      .companies()
      .find(
        (item) =>
          item.id === profile.id ||
          item.dbId === profile.id ||
          (profile.slug != null && (item.slug === profile.slug || item.id === profile.slug)),
      );
    return profileToFurnitureCompany(profile, local?.works ?? []);
  }
}
