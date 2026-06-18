import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FurnitureCompany } from '../models/furniture.models';
import { Profile, ProfileInsert, ProfileType, ProfileUpdate } from '../models/profile.models';
import { PerformerProfile, WorkProject } from '../models/portfolio.models';
import {
  portfolioWorkRowToProject,
  portfolioWorkToInsertRow,
  type PortfolioWorkOwnerType,
  type PortfolioWorkRow,
} from '../models/portfolio-work.model';
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
  isCompletedOrderStatus,
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
import { buildFurnitureSlug } from '../utils/furniture-id.util';
import { logSupabaseError } from '../utils/supabase-error.util';
import { isUuid, normalizeUuid } from '../utils/furniture-id.util';

const SUPABASE_NOT_CONFIGURED =
  'Supabase не настроен. Укажите url и anonKey в src/environments/environment.ts';

const JOBS_CACHE_KEY = 'smartbuild.jobs.v6';
const JOBS_CACHE_TTL_MS = 2 * 60 * 1000;
const JOBS_LIST_COLUMNS = 'id,created_at,title,budget,description,category,city,status';
const JOBS_ACTIVE_STATUS = 'active';
const ORDER_COMPLETED_STATUS = 'completed';
const ORDER_FILES_BUCKET = 'orders-files';

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

export interface RegisterAuthProfileInput {
  userId: string;
  accountType: 'worker' | 'brigade' | 'furniture';
  fullName: string;
  phone: string;
  city: string;
  specialty: string;
  description: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
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
  private readonly portfolioWorksByOwnerSignal = signal<Map<string, WorkProject[]>>(new Map());
  private readonly loadedSignal = signal(false);
  private readonly loadingSignal = signal(false);
  /** Фильтр по городу в каталоге — по умолчанию выключен. */
  private readonly catalogCityFilterEnabledSignal = signal(false);
  private readonly catalogCityFilterSignal = signal<string | null>(null);
  private readonly activeJobsSignal = signal<Job[]>([]);
  private readonly jobsLoadingSignal = signal(false);
  private readonly jobsErrorSignal = signal<string | null>(null);

  readonly profiles = this.profilesSignal.asReadonly();
  readonly loaded = this.loadedSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly activeJobs = computed(() =>
    this.activeJobsSignal().filter((job) => !isCompletedOrderStatus(job.status)),
  );
  readonly jobsLoading = this.jobsLoadingSignal.asReadonly();
  readonly jobsError = this.jobsErrorSignal.asReadonly();
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

  /** Все активные специалисты из таблицы `specialist` (мастера и бригады). */
  readonly specialists = computed(() => [...this.workers(), ...this.brigades()]);

  readonly furnitureCompanies = computed(() => {
    const filterEnabled = this.catalogCityFilterEnabledSignal();
    const filterCity = this.catalogCityFilterSignal();

    return this.profilesSignal()
      .filter((profile) => profile.type === 'furniture')
      .filter((profile) => profileMatchesCatalogCity(profile, filterCity, filterEnabled))
      .map((profile) => this.toFurnitureCompany(profile));
  });

  /** Все исполнители для публичной ленты работ (без фильтра по городу). */
  readonly galleryWorkers = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'worker')
      .map((profile) => this.toPerformer(profile)),
  );

  readonly galleryBrigades = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'brigade')
      .map((profile) => this.toPerformer(profile)),
  );

  readonly galleryFurnitureCompanies = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'furniture')
      .map((profile) => this.toFurnitureCompany(profile)),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
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
    console.log('[SUPABASE SERVICE] Запуск loadJobsForAuthenticatedMaster');

    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    if (force) {
      this.invalidateJobsCache();
    }

    this.jobsLoadingSignal.set(true);
    this.jobsErrorSignal.set(null);

    try {
      const client = await this.resolveClient();
      if (!client) {
        console.error('[SUPABASE SERVICE] Supabase client not configured');
        return [];
      }

      let query = client
        .from(environment.supabase.jobsTable)
        .select('*')
        .neq('status', 'completed')
        .order('created_at', { ascending: false });

      try {
        const authStorageKey = Object.keys(localStorage).find((key) => key.includes('-auth-token'));
        const sessionStr = authStorageKey ? localStorage.getItem(authStorageKey) : null;

        if (sessionStr) {
          const session = JSON.parse(sessionStr) as { user?: { id?: string } };
          const userId = session?.user?.id;
          if (userId) {
            console.log('[SUPABASE SERVICE] Найдена локальная сессия пользователя:', userId);
          }
        } else {
          console.log('[SUPABASE SERVICE] Локальная сессия не найдена. Работаем в режиме гостя.');
        }
      } catch {
        console.log('[SUPABASE SERVICE] Не удалось разобрать локальную сессию, идем как гость.');
      }

      const { data, error } = await query;

      if (error) {
        console.error('[SUPABASE SERVICE] Ошибка при чтении таблицы order:', error);
        logSupabaseError('loadJobsForAuthenticatedMaster', error);
        return [];
      }

      const rows = (data ?? []).filter(
        (row) => !isCompletedOrderStatus((row as { status?: string | null }).status),
      );
      const jobs = this.filterPublicJobs(mapJobklientRowsToJobs(rows));
      this.activeJobsSignal.set(jobs);
      this.jobsErrorSignal.set(null);

      if (jobs.length > 0) {
        this.writeJobsCache(jobs);
      } else {
        this.invalidateJobsCache();
      }

      console.log('[SUPABASE SERVICE] Успешно загружено активных заказов:', jobs.length);
      return jobs;
    } catch (error) {
      console.error('[SUPABASE SERVICE] Критическая ошибка при загрузке:', error);
      logSupabaseError('loadJobsForAuthenticatedMaster', error);
      this.activeJobsSignal.set([]);
      this.jobsErrorSignal.set(null);
      return [];
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

    if (force) {
      this.invalidateJobsCache();
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

  insertOrder(input: JobklientJobInsert, file: File): Observable<JobklientInsertResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.insertOrderAsync(input, file));
  }

  async insertOrderAsync(input: JobklientJobInsert, file: File): Promise<JobklientInsertResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { data: null, error: 'Browser only' };
    }

    const uploadResult = await this.uploadOrderFile(file);
    if (uploadResult.error) {
      logSupabaseError('insertOrder.upload', uploadResult.error);
      return {
        data: null,
        error: uploadResult.error,
        supabaseError: uploadResult.error,
      };
    }

    const fileRef = uploadResult.publicUrl ?? uploadResult.path;
    const clientPhone = input.client_phone?.trim() || input.phone.trim();
    const description = [input.description?.trim(), fileRef ? `Фото объекта: ${fileRef}` : '']
      .filter(Boolean)
      .join('\n');

    return this.insertJobklientJobRow({
      ...input,
      client_phone: clientPhone,
      phone: clientPhone,
      file: fileRef,
      description,
    });
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

  completeOrder(orderId: number): Observable<JobklientMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ error: 'Browser only' });
    }

    const numericId = Math.trunc(Number(orderId));
    return from(this.completeOrderRow(numericId));
  }

  async completeOrderAsync(orderId: number): Promise<JobklientMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { error: 'Browser only' };
    }

    return this.completeOrderRow(Math.trunc(Number(orderId)));
  }

  /** @deprecated Use completeOrder() */
  completeJobklientJob(id: string): Observable<JobklientMutationResult> {
    const orderId = this.parseOrderId(id);
    if (orderId == null) {
      return of({ error: 'Invalid order id' });
    }

    return this.completeOrder(orderId);
  }

  deleteJobklientJob(id: string): Observable<JobklientMutationResult> {
    return this.deleteJob(id);
  }

  /** Удаление заказа из таблицы Supabase `order` по UUID. */
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

  async registerAuthProfile(input: RegisterAuthProfileInput): Promise<{ error: string | null }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { error: 'Browser only' };
    }

    if (!this.isConfigured()) {
      return { error: SUPABASE_NOT_CONFIGURED };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { error: SUPABASE_NOT_CONFIGURED };
      }

      const social = {
        whatsapp: input.whatsapp?.trim() || null,
        telegram: input.telegram?.trim() || null,
        instagram: input.instagram?.trim() || null,
        facebook: input.facebook?.trim() || null,
      };

      if (input.accountType === 'furniture') {
        const slug = buildFurnitureSlug(input.fullName);
        const { error } = await client.from(environment.supabase.furnitureOrdersTable).upsert(
          {
            id: input.userId,
            slug,
            full_name: input.fullName,
            client_name: input.fullName,
            phone: input.phone,
            client_phone: input.phone,
            city: input.city,
            specialty: input.specialty,
            description: input.description,
            furniture_type: input.specialty,
            work_type: 'profile',
            ...social,
          },
          { onConflict: 'id' },
        );

        if (error) {
          logSupabaseError('registerAuthProfile:furniture', error);
          return { error: error.message };
        }
      } else if (input.accountType === 'brigade') {
        const { error } = await client.from(environment.supabase.brigadesTable).upsert(
          {
            id: input.userId,
            full_name: input.fullName,
            phone: input.phone,
            city: input.city,
            specialty: input.specialty,
            description: input.description,
            ...social,
          },
          { onConflict: 'id' },
        );

        if (error) {
          logSupabaseError('registerAuthProfile:brigade', error);
          return { error: error.message };
        }
      } else {
        const { error } = await client.from(environment.supabase.mastersTable).upsert(
          {
            id: input.userId,
            full_name: input.fullName,
            phone: input.phone,
            city: input.city,
            specialty: input.specialty,
            description: input.description,
            account_type: 'worker',
            is_archive: false,
            ...social,
          },
          { onConflict: 'id' },
        );

        if (error) {
          logSupabaseError('registerAuthProfile:worker', error);
          return { error: error.message };
        }
      }

      await this.refreshProfilesFromDatabase();
      return { error: null };
    } catch (err) {
      logSupabaseError('registerAuthProfile', err);
      const message = err instanceof Error ? err.message : 'Profile registration failed';
      return { error: message };
    }
  }

  async syncAuthProfileFromUser(user: {
    id: string;
    user_metadata?: Record<string, unknown>;
    email?: string | null;
  }): Promise<{ error: string | null }> {
    const meta = user.user_metadata ?? {};
    const proRole = String(meta['pro_role'] ?? '');
    const accountTypeRaw = String(meta['account_type'] ?? '');
    const accountType = this.resolveRegisterAccountType(proRole, accountTypeRaw);
    if (!accountType) {
      return { error: 'Unknown account type' };
    }

    const fullName = String(meta['full_name'] ?? user.email?.split('@')[0] ?? 'Профиль').trim();

    return this.registerAuthProfile({
      userId: user.id,
      accountType,
      fullName,
      phone: String(meta['phone'] ?? '').trim(),
      city: String(meta['city'] ?? '').trim(),
      specialty: String(meta['specialty'] ?? '').trim(),
      description: String(meta['description'] ?? fullName).trim(),
      whatsapp: String(meta['whatsapp'] ?? ''),
      telegram: String(meta['telegram'] ?? ''),
      instagram: String(meta['instagram'] ?? ''),
      facebook: String(meta['facebook'] ?? ''),
    });
  }

  private resolveRegisterAccountType(
    proRole: string,
    accountTypeRaw: string,
  ): RegisterAuthProfileInput['accountType'] | null {
    if (proRole === 'furniture_maker' || accountTypeRaw === 'furniture') {
      return 'furniture';
    }
    if (proRole === 'builder' || accountTypeRaw === 'brigade') {
      return 'brigade';
    }
    if (proRole === 'master' || accountTypeRaw === 'worker' || !accountTypeRaw) {
      return 'worker';
    }
    return null;
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

  deleteFurnitureCompany(company: FurnitureCompany): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.deleteFurnitureCompanyRow(company)).pipe(
      catchError((err) => {
        console.error('Furniture delete error:', err);
        return of({
          data: null,
          error: err instanceof Error ? err.message : 'Delete failed',
        });
      }),
    );
  }

  savePortfolioWork(input: {
    ownerId: string;
    ownerType: PortfolioWorkOwnerType;
    work: WorkProject;
  }): Observable<SupabaseMutationResult<WorkProject>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.savePortfolioWorkRow(input)).pipe(
      catchError((err) => {
        logSupabaseError('savePortfolioWork', err);
        return of({
          data: null,
          error: err instanceof Error ? err.message : 'Save failed',
        });
      }),
    );
  }

  deletePortfolioWork(workId: string): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.deletePortfolioWorkRow(workId)).pipe(
      catchError((err) => {
        logSupabaseError('deletePortfolioWork', err);
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

  private removeLocalFurnitureCompany(company: FurnitureCompany): void {
    const keys = new Set(
      [company.id, company.dbId, company.slug]
        .filter((value): value is string => !!value?.trim())
        .map((value) => value.trim()),
    );

    for (const key of keys) {
      this.furnitureStore.removeCompanyIfExists(key);
    }

    this.profilesSignal.update((profiles) =>
      profiles.filter((profile) => {
        if (profile.type !== 'furniture') {
          return true;
        }
        if (keys.has(profile.id)) {
          return false;
        }
        return !(profile.slug && keys.has(profile.slug));
      }),
    );
  }

  private furnitureCompanyKeys(company: FurnitureCompany): string[] {
    return [...new Set(
      [company.dbId, company.slug, company.id]
        .filter((value): value is string => !!value?.trim())
        .map((value) => value.trim()),
    )];
  }

  private findLocalFurnitureCompany(ref: string): FurnitureCompany | undefined {
    const key = ref.trim();
    if (!key) {
      return undefined;
    }

    return this.furnitureStore.companies().find(
      (company) =>
        company.id === key ||
        company.dbId === key ||
        company.slug === key,
    );
  }

  private hasLocalFurnitureReference(ref: string, company?: FurnitureCompany): boolean {
    if (company) {
      return true;
    }

    const key = ref.trim();
    if (!key) {
      return false;
    }

    return this.profilesSignal().some(
      (profile) =>
        profile.type === 'furniture' && (profile.id === key || profile.slug === key),
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

  private async deleteFurnitureCompanyRow(
    company: FurnitureCompany,
  ): Promise<SupabaseMutationResult<null>> {
    const dbId =
      normalizeUuid(company.dbId) ||
      (isUuid(company.id) ? normalizeUuid(company.id) : null) ||
      this.resolveFurnitureOrderDbId(company.id) ||
      this.resolveFurnitureOrderDbId(company.slug ?? '');

    if (!dbId) {
      if (this.hasLocalFurnitureReference(company.id, this.findLocalFurnitureCompany(company.id))) {
        this.removeLocalFurnitureCompany(company);
        return { data: null, error: null };
      }

      const slug = company.slug?.trim() || (!isUuid(company.id) ? company.id.trim() : '');
      if (slug) {
        const deletedBySlug = await this.deleteFurnitureOrderBySlug(slug);
        if (!deletedBySlug.error) {
          this.removeLocalFurnitureCompany(company);
          return { data: null, error: null };
        }
      }

      console.error('Furniture delete error: missing UUID', company);
      return { data: null, error: 'Missing furniture order UUID (dbId)' };
    }

    const result = await this.deleteFurnitureOrderRow(dbId);
    if (!result.error) {
      this.removeLocalFurnitureCompany(company);
    }
    return result;
  }

  private async deleteFurnitureOrderBySlug(slug: string): Promise<SupabaseMutationResult<null>> {
    const trimmedSlug = slug.trim();
    if (!trimmedSlug) {
      return { data: null, error: 'Missing furniture slug' };
    }

    try {
      if (!this.isConfigured()) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const { error } = await client
        .from(environment.supabase.furnitureOrdersTable)
        .delete()
        .eq('slug', trimmedSlug);

      if (error) {
        return { data: null, error: error.message };
      }

      this.removeLocalFurnitureBySlug(trimmedSlug);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { data: null, error: message };
    }
  }

  private async deleteFurnitureOrderRow(id: string): Promise<SupabaseMutationResult<null>> {
    const trimmedId = id?.trim() ?? '';
    const dbId = normalizeUuid(trimmedId) || this.resolveFurnitureOrderDbId(trimmedId);

    if (!dbId) {
      const localCompany = this.findLocalFurnitureCompany(trimmedId);
      if (this.hasLocalFurnitureReference(trimmedId, localCompany)) {
        if (localCompany) {
          this.removeLocalFurnitureCompany(localCompany);
        } else {
          this.removeLocalFurnitureBySlug(trimmedId);
        }
        return { data: null, error: null };
      }

      if (!isUuid(trimmedId)) {
        const deletedBySlug = await this.deleteFurnitureOrderBySlug(trimmedId);
        if (!deletedBySlug.error) {
          return { data: null, error: null };
        }
      }

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
        .update({ is_archive: true })
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('Archive error:', error);
        return { data: null, error: error.message };
      }

      if (!data?.length) {
        const message = 'Master not found or access denied';
        console.error('Archive error:', message);
        return { data: null, error: message };
      }

      this.removeProfileFromState(id);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      console.error('Archive error:', err);
      const message = err instanceof Error ? err.message : 'Archive failed';
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
        .update({ is_archive: true })
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

  private async uploadOrderFile(
    file: File,
  ): Promise<{ path: string; publicUrl: string | null; error: string | null }> {
    try {
      if (!this.isConfigured()) {
        return { path: '', publicUrl: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const client = await this.resolveClient();
      if (!client) {
        return { path: '', publicUrl: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const safeName = file.name.replace(/[^\w.-]+/g, '_') || 'upload.bin';
      const path = `${Date.now()}-${safeName}`;

      const { error } = await client.storage.from(ORDER_FILES_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

      if (error) {
        logSupabaseError('uploadOrderFile', error);
        return { path: '', publicUrl: null, error: error.message };
      }

      const { data } = client.storage.from(ORDER_FILES_BUCKET).getPublicUrl(path);
      return { path, publicUrl: data.publicUrl, error: null };
    } catch (err) {
      logSupabaseError('uploadOrderFile', err);
      const message = err instanceof Error ? err.message : 'File upload failed';
      return { path: '', publicUrl: null, error: message };
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
        const jobs = this.filterPublicJobs(mapJobklientRowsToJobs(data));
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
      const jobs = this.filterPublicJobs(this.memoryJobsCache.jobs);
      if (jobs.length === 0) {
        return null;
      }

      return { at: this.memoryJobsCache.at, jobs };
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

      const jobs = parsed.jobs
        .map((job) => ({
          ...job,
          createdAt: job.createdAt ? new Date(job.createdAt) : null,
        }))
        .filter((job) => !isCompletedOrderStatus(job.status));

      if (jobs.length === 0) {
        return null;
      }

      this.memoryJobsCache = { at: parsed.at, jobs };
      return this.memoryJobsCache;
    } catch {
      return null;
    }
  }

  private writeJobsCache(jobs: Job[]): void {
    const visibleJobs = this.filterPublicJobs(jobs);
    const entry = {
      at: Date.now(),
      jobs: visibleJobs,
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
          jobs: visibleJobs.map((job) => ({
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

  private filterPublicJobs(jobs: Job[]): Job[] {
    return jobs.filter((job) => !isCompletedOrderStatus(job.status));
  }

  private parseOrderId(value: string | number | null | undefined): number | null {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }

    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }

    return Math.trunc(parsed);
  }

  /** Хардкод-дебаг: пометка заказа выполненным в таблице `order`. */
  private async completeOrderRow(id: any): Promise<any> {
    console.log('!!! ХАРДКОД ДЕБАГ ЗАПУЩЕН !!!');
    console.log('Пришедший ID:', id, 'Тип данных:', typeof id);

    if (!id) {
      console.error('Ошибка: ID вообще пустой или undefined!');
      throw new Error('Order id is missing before calling Supabase');
    }

    try {
      const targetId = Number(id);
      console.log('Отправляем запрос в Supabase для ID как number:', targetId);

      const client = await this.resolveClient();
      if (!client) {
        throw new Error(SUPABASE_NOT_CONFIGURED);
      }

      const { data, error, count } = await client
        .from('order')
        .update({ status: 'completed' })
        .eq('id', targetId)
        .select();

      console.log('ОТВЕТ БАЗЫ НАПРЯМУЮ:', { data, error, count });

      if (error) {
        console.error('Supabase вернул ошибку выполнения SQL:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn('Внимание: Запрос прошел, но ни одна строка не обновилась! (data пустой)');
      } else {
        this.removeJobFromLocalState(String(targetId));
        this.invalidateJobsCache();
      }

      return data;
    } catch (err) {
      console.error('Перехвачено исключение внутри try-catch метода:', err);
      throw err;
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
      .neq('status', 'completed')
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

    return (data ?? []).filter(
      (row) => !isCompletedOrderStatus((row as { status?: string | null }).status),
    );
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
      const localProfiles = this.buildProfilesFromLocalStores();
      const client = await this.resolveClient();

      if (!client) {
        if (!this.isConfigured()) {
          logSupabaseError('refreshProfilesFromDatabase', new Error(SUPABASE_NOT_CONFIGURED));
        } else {
          logSupabaseError(
            'refreshProfilesFromDatabase',
            new Error('Supabase client failed to initialize'),
          );
        }

        this.profilesSignal.set(localProfiles);
        this.loadedSignal.set(true);
        return localProfiles;
      }

      const remoteProfiles: Profile[] = [];
      const specialistArchiveFilter = 'is_archive.is.null,is_archive.eq.false';

      const [specialistsResult, brigadesResult, furnitureResult] = await Promise.all([
        client
          .from(environment.supabase.mastersTable)
          .select('*')
          .or(specialistArchiveFilter)
          .order('created_at', { ascending: false }),
        client
          .from(environment.supabase.brigadesTable)
          .select('*')
          .order('created_at', { ascending: false }),
        client
          .from(environment.supabase.furnitureOrdersTable)
          .select('*')
          .or('slug.not.is.null,full_name.not.is.null,client_name.not.is.null')
          .order('created_at', { ascending: false }),
      ]);

      if (specialistsResult.error) {
        logSupabaseError('loadSpecialists', specialistsResult.error);
      } else {
        for (const row of (specialistsResult.data ?? []) as MasterRow[]) {
          if (!row?.id) {
            continue;
          }

          const profile = masterRowToProfile(row);
          if (!this.isVisibleCatalogProfile(profile)) {
            continue;
          }

          remoteProfiles.push(profile);
        }
      }

      if (brigadesResult.error) {
        logSupabaseError('loadBrigades', brigadesResult.error);
      } else {
        for (const row of (brigadesResult.data ?? []) as BrigadeRow[]) {
          if (!row?.id) {
            continue;
          }

          if (remoteProfiles.some((profile) => profile.id === row.id)) {
            continue;
          }

          const profile = brigadeRowToProfile(row);
          if (!this.isVisibleCatalogProfile(profile)) {
            continue;
          }

          remoteProfiles.push(profile);
        }
      }

      if (furnitureResult.error) {
        logSupabaseError('loadFurnitureOrders', furnitureResult.error);
      } else {
        for (const row of (furnitureResult.data ?? []) as FurnitureOrderRow[]) {
          const profile = furnitureOrderRowToProfile(row);
          if (!profile || !this.isVisibleCatalogProfile(profile)) {
            continue;
          }

          remoteProfiles.push(profile);
        }
      }

      const merged = this.mergeCatalogProfiles(remoteProfiles, localProfiles);
      const worksMap = await this.fetchPortfolioWorksMap(client);
      this.portfolioWorksByOwnerSignal.set(worksMap);
      this.syncPortfolioWorksToStores(worksMap, merged);

      console.info('[SupabaseService] catalog loaded', {
        remote: remoteProfiles.length,
        local: localProfiles.length,
        merged: merged.length,
        works: worksMap.size,
      });

      this.profilesSignal.set(merged);
      this.loadedSignal.set(true);
      return merged;
    } catch (err) {
      logSupabaseError('refreshProfilesFromDatabase', err);
      const fallback = this.buildProfilesFromLocalStores();
      this.profilesSignal.set(fallback);
      this.loadedSignal.set(true);
      return fallback;
    } finally {
      this.loadingSignal.set(false);
    }
  }

  private isVisibleCatalogProfile(profile: Profile): boolean {
    return !!(
      profile.name?.trim() ||
      profile.phone?.trim() ||
      profile.whatsapp_phone?.trim()
    );
  }

  private mergeCatalogProfiles(remote: Profile[], local: Profile[]): Profile[] {
    if (remote.length === 0) {
      return local;
    }

    const byId = new Map<string, Profile>();

    for (const profile of remote) {
      byId.set(profile.id, profile);
    }

    for (const profile of local) {
      const existing = byId.get(profile.id);
      if (existing && !existing.slug && profile.slug) {
        byId.set(profile.id, { ...existing, slug: profile.slug });
      }
    }

    return Array.from(byId.values());
  }

  private async fetchPortfolioWorksMap(
    client: SupabaseClient,
  ): Promise<Map<string, WorkProject[]>> {
    const worksMap = new Map<string, WorkProject[]>();

    const { data, error } = await client
      .from(environment.supabase.portfolioWorksTable)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      logSupabaseError('fetchPortfolioWorks', error);
      return worksMap;
    }

    for (const row of (data ?? []) as PortfolioWorkRow[]) {
      if (!row?.owner_id) {
        continue;
      }

      const work = portfolioWorkRowToProject(row);
      const ownerWorks = worksMap.get(row.owner_id) ?? [];
      ownerWorks.push(work);
      worksMap.set(row.owner_id, ownerWorks);
    }

    return worksMap;
  }

  private syncPortfolioWorksToStores(worksMap: Map<string, WorkProject[]>, profiles: Profile[]): void {
    const performers: PerformerProfile[] = [];
    const companies: FurnitureCompany[] = [];

    for (const profile of profiles) {
      const works = worksMap.get(profile.id) ?? [];
      if (profile.type === 'furniture') {
        companies.push(profileToFurnitureCompany(profile, works));
      } else {
        performers.push(profileToPerformer(profile, works));
      }
    }

    if (performers.length > 0) {
      this.portfolioStore.replacePerformersFromRemote(performers);
    }

    if (companies.length > 0) {
      this.furnitureStore.replaceCompaniesFromRemote(companies);
    }
  }

  private async savePortfolioWorkRow(input: {
    ownerId: string;
    ownerType: PortfolioWorkOwnerType;
    work: WorkProject;
  }): Promise<SupabaseMutationResult<WorkProject>> {
    if (!this.isConfigured()) {
      return { data: null, error: SUPABASE_NOT_CONFIGURED };
    }

    const client = await this.resolveClient();
    if (!client) {
      return { data: null, error: SUPABASE_NOT_CONFIGURED };
    }

    const work: WorkProject = {
      ...input.work,
      id: input.work.id || crypto.randomUUID(),
    };

    const row = portfolioWorkToInsertRow({
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      work,
    });

    const { data, error } = await client
      .from(environment.supabase.portfolioWorksTable)
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      return { data: null, error: error.message };
    }

    const saved = portfolioWorkRowToProject(data as PortfolioWorkRow);
    this.upsertWorkInCaches(input.ownerId, saved);
    return { data: saved, error: null };
  }

  private async deletePortfolioWorkRow(workId: string): Promise<SupabaseMutationResult<null>> {
    const trimmedId = workId.trim();
    if (!trimmedId) {
      return { data: null, error: 'Missing work id' };
    }

    if (!this.isConfigured()) {
      return { data: null, error: SUPABASE_NOT_CONFIGURED };
    }

    const client = await this.resolveClient();
    if (!client) {
      return { data: null, error: SUPABASE_NOT_CONFIGURED };
    }

    const { error } = await client
      .from(environment.supabase.portfolioWorksTable)
      .delete()
      .eq('id', trimmedId);

    if (error) {
      return { data: null, error: error.message };
    }

    this.removeWorkFromCaches(trimmedId);
    return { data: null, error: null };
  }

  private upsertWorkInCaches(ownerId: string, work: WorkProject): void {
    const ownerWorks = this.mergeOwnerWorks(ownerId, work);
    const worksMap = new Map(this.portfolioWorksByOwnerSignal());
    worksMap.set(ownerId, ownerWorks);
    this.portfolioWorksByOwnerSignal.set(worksMap);

    if (this.portfolioStore.getPerformer('worker', ownerId) || this.portfolioStore.getPerformer('brigade', ownerId)) {
      this.portfolioStore.setWorksForPerformer(ownerId, ownerWorks);
      return;
    }

    const company =
      this.furnitureStore.getCompany(ownerId) ??
      this.furnitureStore.companies().find((item) => item.dbId === ownerId);
    if (company) {
      this.furnitureStore.setWorksForCompany(company.id, ownerWorks);
    }
  }

  private removeWorkFromCaches(workId: string): void {
    const worksMap = new Map(this.portfolioWorksByOwnerSignal());
    for (const [ownerId, works] of worksMap.entries()) {
      const nextWorks = works.filter((work) => work.id !== workId);
      if (nextWorks.length === works.length) {
        continue;
      }
      worksMap.set(ownerId, nextWorks);
      if (this.portfolioStore.getPerformer('worker', ownerId) || this.portfolioStore.getPerformer('brigade', ownerId)) {
        this.portfolioStore.setWorksForPerformer(ownerId, nextWorks);
      } else {
        const company =
          this.furnitureStore.getCompany(ownerId) ??
          this.furnitureStore.companies().find((item) => item.dbId === ownerId);
        if (company) {
          this.furnitureStore.setWorksForCompany(company.id, nextWorks);
        }
      }
    }
    this.portfolioWorksByOwnerSignal.set(worksMap);
    this.portfolioStore.performers().forEach((performer) => {
      if (performer.works.some((work) => work.id === workId)) {
        this.portfolioStore.deleteWork(performer.id, workId);
      }
    });
    this.furnitureStore.companies().forEach((company) => {
      if (company.works.some((work) => work.id === workId)) {
        this.furnitureStore.deleteWork(company.id, workId);
      }
    });
  }

  private mergeOwnerWorks(ownerId: string, work: WorkProject): WorkProject[] {
    const fromDb = this.portfolioWorksByOwnerSignal().get(ownerId) ?? [];
    const local = this.resolveLocalWorks(ownerId);
    const merged = new Map<string, WorkProject>();

    for (const item of [...local, ...fromDb]) {
      merged.set(item.id, item);
    }
    merged.set(work.id, work);

    return Array.from(merged.values()).sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
  }

  private resolveLocalWorks(ownerId: string): WorkProject[] {
    const performer =
      this.portfolioStore.getPerformer('worker', ownerId) ??
      this.portfolioStore.getPerformer('brigade', ownerId) ??
      this.portfolioStore.performers().find((item) => item.id === ownerId);
    if (performer) {
      return performer.works;
    }

    const company =
      this.furnitureStore.getCompany(ownerId) ??
      this.furnitureStore.companies().find((item) => item.dbId === ownerId);
    return company?.works ?? [];
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
    const dbWorks = this.portfolioWorksByOwnerSignal().get(profile.id);
    const local =
      profile.type === 'furniture'
        ? undefined
        : this.portfolioStore
            .performers()
            .find((item) => item.id === profile.id && item.type === profile.type);
    const works = dbWorks ?? local?.works ?? [];
    return profileToPerformer(profile, works);
  }

  private toFurnitureCompany(profile: Profile): FurnitureCompany {
    const dbWorks = this.portfolioWorksByOwnerSignal().get(profile.id);
    const local = this.furnitureStore
      .companies()
      .find(
        (item) =>
          item.id === profile.id ||
          item.dbId === profile.id ||
          (profile.slug != null && (item.slug === profile.slug || item.id === profile.slug)),
      );
    const works = dbWorks ?? local?.works ?? [];
    return profileToFurnitureCompany(profile, works);
  }
}
