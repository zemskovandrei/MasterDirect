import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, of } from 'rxjs';
import { FurnitureCompany } from '../models/furniture.models';
import {
  Profile,
  ProfileInsert,
  ProfileType,
  ProfileUpdate,
} from '../models/profile.models';
import { PerformerProfile } from '../models/portfolio.models';
import {
  furnitureCompanyToProfile,
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
  toJobklientDbRow,
} from '../../models/job.model';
import type { BrigadeRow, MasterRow } from '../models/master.model';

const SUPABASE_NOT_CONFIGURED =
  'Supabase не настроен. Укажите url и anonKey в src/environments/environment.ts';

const JOBS_CACHE_KEY = 'smartbuild.jobs.v3';
const JOBS_CACHE_TTL_MS = 2 * 60 * 1000;
const JOBS_LIST_COLUMNS =
  'id,title,client_name,phone,city,category,budget,description,status,created_at';

const MASTERS_SELECT_COLUMNS =
  'id,full_name,phone,city,specialty,description,account_type,call_out_fee,whatsapp_phone,tg_username,whatsapp,telegram,instagram,facebook,created_at';

const BRIGADES_SELECT_COLUMNS =
  'id,full_name,phone,city,specialty,description,call_out_fee,whatsapp_phone,tg_username,whatsapp,telegram,instagram,facebook,created_at';

export interface SupabaseMutationResult<T = Profile> {
  data: T | null;
  error: string | null;
}

export interface JobklientInsertResult {
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

  private readonly profilesSignal = signal<Profile[]>([]);
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);
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

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const cached = this.readJobsCache();
      if (cached) {
        this.activeJobsSignal.set(cached.jobs);
      }
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

      const query = new URLSearchParams({
        select: JOBS_LIST_COLUMNS,
        order: 'created_at.desc',
        limit: '100',
        city: `eq.${masterCity}`,
      });
      const rows = await this.fetchJobklientRows(query);
      const jobs = mapJobklientRowsToJobs(rows);
      this.activeJobsSignal.set(jobs);
      if (jobs.length > 0) {
        this.writeJobsCache(jobs);
      } else {
        this.invalidateJobsCache();
      }
      return jobs;
    } catch (err) {
      console.error('[SupabaseService] loadJobsForAuthenticatedMaster:', err);
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

  completeJobklientJob(id: string): Observable<JobklientMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ error: 'Browser only' });
    }

    return from(this.updateJobklientStatusRow(id, 'Completed'));
  }

  deleteJobklientJob(id: string): Observable<JobklientMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ error: 'Browser only' });
    }

    return from(this.deleteJobklientJobRow(id));
  }

  loadProfiles(): Observable<Profile[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    return from(this.refreshProfilesFromDatabase());
  }

  getProfilesByType(type: ProfileType): Observable<Profile[]> {
    return from(
      this.refreshProfilesFromDatabase().then((profiles) =>
        profiles.filter((profile) => profile.type === type),
      ),
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

  deleteProfile(id: string): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.deleteProfileRow(id));
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

      const { data, error } = await client
        .from(environment.supabase.mastersTable)
        .update({
          full_name: name,
          specialty,
          description,
        })
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

  private async deleteProfileRow(id: string): Promise<SupabaseMutationResult<null>> {
    if (this.portfolioStore.deletePerformer(id)) {
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    }

    const companyExists = this.furnitureStore.companies().some((company) => company.id === id);
    if (companyExists) {
      this.furnitureStore.removeCompanyIfExists(id);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
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

      const { error } = await client.from(environment.supabase.mastersTable).delete().eq('id', id);

      if (error) {
        console.error('[SupabaseService] deleteProfile:', error.message);
        return { data: null, error: error.message };
      }

      this.portfolioStore.deletePerformer(id);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      console.error('[SupabaseService] deleteProfile:', err);
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
    return (
      url.startsWith('https://') &&
      !url.includes('YOUR_SUPABASE') &&
      !url.includes('mqnrevts') &&
      anonKey.length > 20 &&
      !anonKey.includes('YOUR_SUPABASE')
    );
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
        console.error('Полный объект ошибки Supabase:', error);
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
      console.error('Полный объект ошибки Supabase:', err);
      const message = err instanceof Error ? err.message : 'Insert failed';
      console.error('[SupabaseService] insertJobklientJob:', err);
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
        console.error('[SupabaseService] loadActiveJobs:', err);
        if (showLoading || this.activeJobsSignal().length === 0) {
          this.activeJobsSignal.set([]);
          this.jobsErrorSignal.set(
            err instanceof Error ? err.message : 'Failed to load jobs',
          );
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

      const { url, anonKey, jobsTable } = environment.supabase;
      const endpoint = `${url}/rest/v1/${jobsTable}?id=eq.${encodeURIComponent(id)}`;
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const message = await response.text();
        return { error: message || `HTTP ${response.status}` };
      }

      this.removeJobFromLocalState(id);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      console.error('[SupabaseService] updateJobklientStatus:', err);
      return { error: message };
    }
  }

  private async deleteJobklientJobRow(id: string): Promise<JobklientMutationResult> {
    try {
      if (!this.isConfigured()) {
        return { error: SUPABASE_NOT_CONFIGURED };
      }

      const { url, anonKey, jobsTable } = environment.supabase;
      const endpoint = `${url}/rest/v1/${jobsTable}?id=eq.${encodeURIComponent(id)}`;
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Prefer: 'return=minimal',
        },
      });

      if (!response.ok) {
        const message = await response.text();
        return { error: message || `HTTP ${response.status}` };
      }

      this.removeJobFromLocalState(id);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      console.error('[SupabaseService] deleteJobklientJob:', err);
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

  private async fetchJobklientRows(query?: URLSearchParams): Promise<unknown[]> {
    const { url, anonKey, jobsTable } = environment.supabase;
    const params =
      query ??
      new URLSearchParams({
        select: JOBS_LIST_COLUMNS,
        order: 'created_at.desc',
        limit: '100',
      });
    const endpoint = `${url}/rest/v1/${jobsTable}?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Prefer: 'count=none',
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  private resolveClient(): Promise<SupabaseClient | null> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(null);
    }

    if (!this.isConfigured()) {
      return Promise.resolve(null);
    }

    if (this.supabaseClient) {
      return Promise.resolve(this.supabaseClient);
    }

    if (!this.clientPromise) {
      const { url, anonKey } = environment.supabase;
      this.clientPromise = import('@supabase/supabase-js')
        .then(({ createClient }) => {
          this.supabaseClient = createClient(url, anonKey);
          return this.supabaseClient;
        })
        .catch(() => {
          this.clientPromise = null;
          return null;
        });
    }

    return this.clientPromise;
  }

  private async refreshProfilesFromDatabase(): Promise<Profile[]> {
    this.loadingSignal.set(true);

    try {
      const client = await this.resolveClient();
      let masterProfiles: Profile[] = [];
      let brigadeProfiles: Profile[] = [];

      if (client) {
        const { data: mastersData, error: mastersError } = await client
          .from(environment.supabase.mastersTable)
          .select(MASTERS_SELECT_COLUMNS)
          .eq('account_type', 'worker')
          .order('created_at', { ascending: false });

        if (mastersError) {
          console.error('[SupabaseService] load masters:', mastersError.message);
        } else {
          masterProfiles =
            (mastersData as MasterRow[] | null)?.map(masterRowToProfile) ?? [];
        }

        const { data: brigadesData, error: brigadesError } = await client
          .from(environment.supabase.brigadesTable)
          .select(BRIGADES_SELECT_COLUMNS)
          .order('created_at', { ascending: false });

        if (brigadesError) {
          console.warn('[SupabaseService] load brigades table:', brigadesError.message);
          const { data: fallbackBrigades } = await client
            .from(environment.supabase.mastersTable)
            .select(MASTERS_SELECT_COLUMNS)
            .eq('account_type', 'brigade')
            .order('created_at', { ascending: false });

          brigadeProfiles =
            (fallbackBrigades as MasterRow[] | null)?.map(masterRowToProfile) ?? [];
        } else {
          brigadeProfiles =
            (brigadesData as BrigadeRow[] | null)?.map(brigadeRowToProfile) ?? [];
        }
      }

      const furnitureProfiles = this.furnitureStore
        .companies()
        .map((company) => furnitureCompanyToProfile(company));
      const profiles = [...brigadeProfiles, ...masterProfiles, ...furnitureProfiles];
      this.profilesSignal.set(profiles);
      this.loadedSignal.set(true);
      return profiles;
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
    const local = this.furnitureStore.companies().find((item) => item.id === profile.id);
    return profileToFurnitureCompany(profile, local?.works ?? []);
  }
}
