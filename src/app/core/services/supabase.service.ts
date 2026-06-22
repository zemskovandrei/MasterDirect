import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Observable, from, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FurnitureCompany } from '../models/furniture.models';
import { Profile, ProfileInsert, ProfileType, ProfileUpdate } from '../models/profile.models';
import { PerformerProfile, PerformerSocialLinks, WorkProject } from '../models/portfolio.models';
import type { PortfolioWorkOwnerType } from '../models/portfolio-work.model';
import {
  furnitureCompanyToProfile,
  masterRowToProfile,
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
  resolveJobPhotoForJob,
  toFurnitureOrderDbRow,
} from '../../models/job.model';
import type { FurnitureOrderInsert, MasterRow } from '../models/master.model';
import { profileMatchesCatalogCity } from '../utils/catalog-filter.util';
import { buildFurnitureSlug } from '../utils/furniture-id.util';
import { logSupabaseError, supabaseErrorMessage, isSupabaseNetworkError, supabaseNetworkErrorHint, formatStorageUploadError, isStorageBucketMissingError, isRlsPolicyError, formatSupabaseMutationError } from '../utils/supabase-error.util';
import { compressWorkImageFile } from '../utils/compress-image.util';
import { specialistRowToWritePayload, profilePatchToSpecialistRow } from '../utils/specialist-db.util';
import { mergeSocialLinks } from '../utils/social-links.util';
import { isUuid, normalizeUuid } from '../utils/furniture-id.util';
import { mapJobklientInsertToOrderInsert, mapOrderRowsToJobs } from '../utils/order-db.util';
import { DataService } from './data.service';
import { SupabaseClientService } from './supabase-client.service';

const SUPABASE_NOT_CONFIGURED =
  'Supabase не настроен. Укажите url и anonKey в src/environments/environment.ts';

const JOBS_CACHE_KEY = 'smartbuild.jobs.v10';
const JOBS_CACHE_TTL_MS = 2 * 60 * 1000;
const JOBS_LIST_COLUMNS =
  'id,created_at,title,budget,description,category,city,status,client_name,client_phone,order_files(file_path)';
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
  firstName?: string;
  lastName?: string;
  phone: string;
  city: string;
  specialty: string;
  description: string;
  proRole?: string;
  slug?: string | null;
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
  private readonly supabaseClientService = inject(SupabaseClientService);
  private readonly dataService = inject(DataService);

  private jobsFetchPromise: Promise<Job[]> | null = null;
  private memoryJobsCache: { at: number; jobs: Job[] } | null = null;
  private profilesRefreshPromise: Promise<Profile[]> | null = null;
    private profilesInitialized = false;

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
      .map((profile) => this.toPerformer(profile))
      .filter((performer) => performer.works.length > 0),
  );

  readonly galleryBrigades = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'brigade')
      .map((profile) => this.toPerformer(profile))
      .filter((performer) => performer.works.length > 0),
  );

  readonly galleryFurnitureCompanies = computed(() =>
    this.profilesSignal()
      .filter((profile) => profile.type === 'furniture')
      .map((profile) => this.toFurnitureCompany(profile))
      .filter((company) => company.works.length > 0),
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
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }

    if (force) {
      this.invalidateJobsCache();
    }

    this.jobsLoadingSignal.set(true);
    this.jobsErrorSignal.set(null);

    try {
      const orders = await this.dataService.listActiveOrders();
      const jobs = this.filterPublicJobs(mapOrderRowsToJobs(orders));
      this.activeJobsSignal.set(jobs);
      this.jobsErrorSignal.set(null);

      if (jobs.length > 0) {
        this.writeJobsCache(jobs);
      } else {
        this.invalidateJobsCache();
      }

      return jobs;
    } catch (error) {
      logSupabaseError('loadJobsForAuthenticatedMaster', error);
      this.activeJobsSignal.set([]);
      this.jobsErrorSignal.set(
        isSupabaseNetworkError(error)
          ? supabaseNetworkErrorHint(environment.supabase.url)
          : supabaseErrorMessage(error) || null,
      );
      return [];
    } finally {
      this.jobsLoadingSignal.set(false);
    }
  }

  getClient(): Promise<SupabaseClient | null> {
    return this.supabaseClientService.getClient();
  }

  private resolveClient(): Promise<SupabaseClient | null> {
    return this.supabaseClientService.getClient();
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

    const fileRefResult = await this.resolveOrderFileRef(file);
    if (fileRefResult.error) {
      logSupabaseError('insertOrder.upload', fileRefResult.error);
      return {
        data: null,
        error: fileRefResult.error,
        supabaseError: fileRefResult.error,
      };
    }

    const clientPhone = input.client_phone?.trim() || input.phone.trim();
    const description = [
      input.description?.trim(),
      fileRefResult.fileRef ? `Фото объекта: ${fileRefResult.fileRef}` : '',
      fileRefResult.attachmentNote,
    ]
      .filter(Boolean)
      .join('\n');

    return this.insertJobklientJobRow({
      ...input,
      client_phone: clientPhone,
      phone: clientPhone,
      file: fileRefResult.fileRef,
      description,
    });
  }

  private async resolveOrderFileRef(file: File): Promise<{
    fileRef: string;
    attachmentNote: string;
    error: string | null;
  }> {
    const uploadResult = await this.uploadOrderFile(file);
    if (!uploadResult.error) {
      return {
        fileRef: uploadResult.publicUrl ?? uploadResult.path,
        attachmentNote: '',
        error: null,
      };
    }

    const storageBlocked =
      isStorageBucketMissingError(uploadResult.error) || isRlsPolicyError(uploadResult.error);

    if (!storageBlocked) {
      return { fileRef: '', attachmentNote: '', error: uploadResult.error };
    }

    if (file.type.startsWith('image/')) {
      try {
        const dataUrl = await compressWorkImageFile(file);
        return { fileRef: dataUrl, attachmentNote: '', error: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось обработать фото';
        return { fileRef: '', attachmentNote: '', error: message };
      }
    }

    return {
      fileRef: '',
      attachmentNote: `Вложение «${file.name}» не сохранено в Storage (настройте bucket и политики orders-files).`,
      error: null,
    };
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

  ensureProfilesLoaded(): Observable<Profile[]> {
    if (this.profilesInitialized && this.loadedSignal()) {
      return of(this.profilesSignal());
    }
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }
    this.profilesInitialized = true;
    return this.loadProfiles();
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

      const slug =
        input.accountType === 'furniture'
          ? `${buildFurnitureSlug(input.fullName)}-${input.userId.replace(/-/g, '').slice(0, 8)}`
          : null;

      const payload = specialistRowToWritePayload({
        userId: input.userId,
        fullName: input.fullName,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        city: input.city,
        specialty: input.specialty,
        proRole: input.proRole,
        accountType: input.accountType,
        slug,
        whatsapp: input.whatsapp,
        telegram: input.telegram,
        instagram: input.instagram,
        facebook: input.facebook,
      });

      const { data: existing } = await client
        .from(environment.supabase.specialistTable)
        .select('id')
        .eq('id', input.userId)
        .maybeSingle();

      const result = existing
        ? await client
            .from(environment.supabase.specialistTable)
            .update(payload)
            .eq('id', input.userId)
        : await client
            .from(environment.supabase.specialistTable)
            .upsert(payload, { onConflict: 'id' });

      if (result.error) {
        logSupabaseError('registerAuthProfile', result.error);
        return { error: supabaseErrorMessage(result.error) || 'Profile registration failed' };
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
      firstName: String(meta['first_name'] ?? '').trim() || undefined,
      lastName: String(meta['last_name'] ?? '').trim() || undefined,
      phone: String(meta['phone'] ?? '').trim(),
      city: String(meta['city'] ?? '').trim(),
      specialty: String(meta['specialty'] ?? '').trim(),
      description: String(meta['description'] ?? fullName).trim(),
      proRole: proRole || undefined,
      whatsapp: String(meta['whatsapp'] ?? ''),
      telegram: String(meta['telegram'] ?? ''),
      instagram: String(meta['instagram'] ?? ''),
      facebook: String(meta['facebook'] ?? ''),
    });
  }

  /** UUID строки в `specialist` (auth.users.id), не slug мебельной компании. */
  private async resolveSpecialistDbId(id: string): Promise<string | null> {
    const trimmed = id.trim();
    if (isUuid(trimmed)) {
      return trimmed;
    }

    const company = this.furnitureStore
      .companies()
      .find((item) => item.id === trimmed || item.slug === trimmed);
    const dbId = normalizeUuid(company?.dbId);
    if (dbId) {
      return dbId;
    }

    const client = await this.resolveClient();
    if (!client) {
      return null;
    }

    const { data } = await client.auth.getSession();
    return normalizeUuid(data.session?.user?.id) || null;
  }

  private buildRegisterInputFromLocalState(userId: string): RegisterAuthProfileInput | null {
    const performer = this.portfolioStore.performers().find((item) => item.id === userId);
    if (performer) {
      const links = performer.socialLinks ?? {};
      return {
        userId,
        accountType: performer.type === 'brigade' ? 'brigade' : 'worker',
        fullName: performer.name,
        phone: links.phone?.trim() || '-',
        city: '',
        specialty: performer.specialty,
        description: performer.description,
        proRole: performer.type === 'brigade' ? 'builder' : 'master',
        whatsapp: links.whatsapp,
        telegram: links.telegram,
        instagram: links.instagram,
        facebook: links.facebook,
      };
    }

    const company = this.furnitureStore
      .companies()
      .find((item) => item.dbId === userId || item.id === userId);
    if (company) {
      const links = company.socialLinks ?? {};
      const slugBase = company.slug ?? buildFurnitureSlug(company.name);
      return {
        userId,
        accountType: 'furniture',
        fullName: company.name,
        phone: links.phone?.trim() || '-',
        city: company.city ?? '',
        specialty: company.specialty,
        description: company.description,
        proRole: 'furniture_maker',
        slug: `${slugBase}-${userId.replace(/-/g, '').slice(0, 8)}`,
        whatsapp: links.whatsapp,
        telegram: links.telegram,
        instagram: links.instagram,
        facebook: links.facebook,
      };
    }

    return null;
  }

  /** Создаёт строку в `specialist`, если пользователь есть в auth, но профиля ещё нет. */
  private async ensureSpecialistRow(dbId: string): Promise<{ error: string | null }> {
    const client = await this.resolveClient();
    if (!client) {
      return { error: this.isConfigured() ? 'Supabase client failed to initialize' : SUPABASE_NOT_CONFIGURED };
    }

    const { data: existing, error: readError } = await client
      .from(environment.supabase.specialistTable)
      .select('id')
      .eq('id', dbId)
      .maybeSingle();

    if (readError) {
      logSupabaseError('ensureSpecialistRow.read', readError);
      return { error: supabaseErrorMessage(readError) || readError.message };
    }

    if (existing) {
      return { error: null };
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData.session?.user;
    if (user?.id === dbId) {
      const sync = await this.syncAuthProfileFromUser(user);
      if (!sync.error) {
        return { error: null };
      }
    }

    const localInput = this.buildRegisterInputFromLocalState(dbId);
    if (localInput) {
      return this.registerAuthProfile(localInput);
    }

    return { error: 'Profile not found' };
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

  updateSocialLinks(id: string, links: PerformerSocialLinks): Observable<SupabaseMutationResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.updateSocialLinksRow(id, links));
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

  deleteSpecialistWithEvidence(
    specialistId: string,
    adminEmail: string,
  ): Observable<SupabaseMutationResult<null>> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ data: null, error: 'Browser only' });
    }

    return from(this.deleteSpecialistWithEvidenceRow(specialistId, adminEmail)).pipe(
      catchError((err) => {
        console.error('Delete specialist with evidence error:', err);
        return of({
          data: null,
          error: err instanceof Error ? err.message : 'Delete failed',
        });
      }),
    );
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

  async countCompletedOrdersForUser(userId: string): Promise<number> {
    if (!isPlatformBrowser(this.platformId)) {
      return 0;
    }

    return this.dataService.countCompletedOrdersByUser(userId);
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

      const dbId = await this.resolveSpecialistDbId(trimmedId);
      if (!dbId) {
        return { data: null, error: 'Profile not found' };
      }

      const ensure = await this.ensureSpecialistRow(dbId);
      if (ensure.error) {
        return { data: null, error: ensure.error };
      }

      const { data, error } = await client
        .from(environment.supabase.specialistTable)
        .update({ header_bg: color })
        .eq('id', dbId)
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

  private async updateSocialLinksRow(
    id: string,
    links: PerformerSocialLinks,
  ): Promise<SupabaseMutationResult> {
    const trimmedId = id.trim();
    if (!trimmedId) {
      return { data: null, error: 'Missing profile id' };
    }

    const dbId = await this.resolveSpecialistDbId(trimmedId);
    if (!dbId) {
      return { data: null, error: 'Profile not found' };
    }

    const performer = this.portfolioStore.performers().find(
      (item) => item.id === trimmedId || item.id === dbId,
    );
    if (performer) {
      this.portfolioStore.updateSocialLinks(performer.id, links);
    }

    const company = this.furnitureStore
      .companies()
      .find((item) => item.id === trimmedId || item.dbId === trimmedId || item.dbId === dbId);
    if (company) {
      this.furnitureStore.updateSocialLinks(company.id, links);
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: this.isConfigured() ? 'Supabase client failed to initialize' : SUPABASE_NOT_CONFIGURED };
      }

      const ensure = await this.ensureSpecialistRow(dbId);
      if (ensure.error) {
        return { data: null, error: ensure.error };
      }

      const { data, error } = await client
        .from(environment.supabase.specialistTable)
        .update(
          profilePatchToSpecialistRow({
            phone: links.phone,
            whatsapp: links.whatsapp,
            telegram: links.telegram,
            instagram: links.instagram,
            facebook: links.facebook,
          }),
        )
        .eq('id', dbId)
        .select('*')
        .maybeSingle();

      if (error) {
        console.error('[SupabaseService] updateSocialLinks:', error.message);
        return { data: null, error: formatSupabaseMutationError(error) };
      }

      if (!data) {
        return { data: null, error: 'Profile not found' };
      }

      await this.refreshProfilesFromDatabase();
      return { data: masterRowToProfile(data as MasterRow), error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      console.error('[SupabaseService] updateSocialLinks:', err);
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

    const existingProfile = this.profilesSignal().find((item) => item.id === id);
    if (!existingProfile) {
      return { data: null, error: 'Profile not found' };
    }

    const dbId = await this.resolveSpecialistDbId(id);
    if (!dbId) {
      return { data: null, error: 'Profile not found' };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const ensure = await this.ensureSpecialistRow(dbId);
      if (ensure.error) {
        return { data: null, error: ensure.error };
      }

      const { data, error } = await client
        .from(environment.supabase.specialistTable)
        .update(profilePatchToSpecialistRow({ name, specialty, city: patch.city, phone: patch.phone, whatsapp: patch.whatsapp, telegram: patch.telegram, instagram: patch.instagram, facebook: patch.facebook }))
        .eq('id', dbId)
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

    if (resolvedType === 'worker') {
      return this.deleteMasterRow(trimmedId);
    }

    return this.deleteSpecialistRow(trimmedId);
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
        .from(environment.supabase.specialistTable)
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
        .from(environment.supabase.specialistTable)
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
        .from(environment.supabase.specialistTable)
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('Delete error (master):', error);
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
      console.error('Delete error (master):', err);
      const message = err instanceof Error ? err.message : 'Delete failed';
      return { data: null, error: message };
    }
  }

  private async deleteSpecialistRow(id: string): Promise<SupabaseMutationResult<null>> {
    if (this.portfolioStore.deletePerformer(id)) {
      this.removeProfileFromState(id);
      void this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    }

    const localCompany = this.findLocalFurnitureCompany(id);
    if (localCompany) {
      this.removeLocalFurnitureCompany(localCompany);
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const { data, error } = await client
        .from(environment.supabase.specialistTable)
        .delete()
        .eq('id', id)
        .select('id');

      if (error) {
        console.error('Delete error (specialist):', error);
        return { data: null, error: error.message };
      }

      if (!data?.length) {
        if (localCompany) {
          return { data: null, error: null };
        }
        const message = 'Profile not found or access denied';
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

  private async deleteSpecialistWithEvidenceRow(
    specialistId: string,
    adminEmail: string,
  ): Promise<SupabaseMutationResult<null>> {
    const targetId = specialistId?.trim();
    const actorEmail = adminEmail?.trim().toLowerCase();

    if (!targetId) {
      return { data: null, error: 'Missing specialist id' };
    }

    if (!actorEmail) {
      return { data: null, error: 'Missing admin email' };
    }

    try {
      const client = await this.resolveClient();
      if (!client) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const { error } = await client.rpc('delete_specialist_with_evidence', {
        target_id: targetId,
        admin_email: actorEmail,
      });

      if (error) {
        return { data: null, error: error.message };
      }

      this.removeProfileFromState(targetId);
      await this.refreshProfilesFromDatabase();
      return { data: null, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      console.error('Delete specialist with evidence error:', err);
      return { data: null, error: message };
    }
  }

  isConfigured(): boolean {
    return this.supabaseClientService.isConfigured();
  }

  private async insertJobklientJobRow(input: JobklientJobInsert): Promise<JobklientInsertResult> {
    try {
      if (!this.isConfigured()) {
        return { data: null, error: SUPABASE_NOT_CONFIGURED };
      }

      const userId = await this.resolveCurrentUserId();
      const row = mapJobklientInsertToOrderInsert(input, userId);
      const order = await this.dataService.insertOrder(row);

      await this.attachOrderFileRecord(order.id, input.file);

      this.invalidateJobsCache();
      return { data: order as unknown as Record<string, unknown>, error: null };
    } catch (err) {
      logSupabaseError('insertJobklientJob', err);
      const message = formatSupabaseMutationError(err);
      return { data: null, error: message, supabaseError: err };
    }
  }

  private async resolveCurrentUserId(): Promise<string | null> {
    const client = await this.resolveClient();
    if (!client) {
      return null;
    }

    const { data } = await client.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  private async attachOrderFileRecord(orderId: number, fileRef?: string | null): Promise<void> {
    const path = fileRef?.trim();
    if (!path || path.startsWith('data:')) {
      return;
    }

    try {
      await this.dataService.insertOrderFile({
        order_id: orderId,
        file_path: path,
      });
    } catch (err) {
      logSupabaseError('attachOrderFileRecord', err);
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
        return { path: '', publicUrl: null, error: formatStorageUploadError(error, ORDER_FILES_BUCKET) };
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
      const description = [
        row.description,
        `Телефон: ${row.client_phone}`,
        `Тип: ${row.furniture_type}`,
        `Работа: ${row.work_type}`,
      ]
        .filter(Boolean)
        .join('\n');

      const payload = {
        title: row.work_type || 'Заявка на мебель',
        city: input.city?.trim() || '—',
        category: 'furniture',
        budget: null,
        description,
        status: 'active',
      };

      const { data, error } = await client
        .from(environment.supabase.jobsTable)
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
          this.jobsErrorSignal.set(
            isSupabaseNetworkError(err)
              ? supabaseNetworkErrorHint(environment.supabase.url)
              : supabaseErrorMessage(err) || 'Failed to load jobs',
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
      const jobs = this.filterPublicJobs(this.memoryJobsCache.jobs).map((job) =>
        this.hydrateJobPhoto(job),
      );
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
        .map((job) => this.hydrateJobPhoto(job))
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

  private hydrateJobPhoto(job: Job): Job {
    const resolved = resolveJobPhotoForJob(job);
    if (!resolved) {
      return job;
    }

    return {
      ...job,
      details: {
        ...job.details,
        photoLink: resolved,
      },
    };
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

  /** Пометка заказа выполненным через DataService. */
  private async completeOrderRow(id: number): Promise<JobklientMutationResult> {
    if (!Number.isFinite(id) || id <= 0) {
      return { error: 'Invalid order id' };
    }

    try {
      const currentOrder = await this.dataService.getOrderById(id);
      if (isCompletedOrderStatus(currentOrder.status)) {
        this.removeJobFromLocalState(String(id));
        this.invalidateJobsCache();
        return { error: null };
      }

      const completedOrder = await this.dataService.completeOrder(id);

      if (completedOrder.user_id) {
        const client = await this.resolveClient();
        if (!client) {
          return { error: SUPABASE_NOT_CONFIGURED };
        }

        const { error: incrementError } = await client.rpc('increment_orders_count', {
          row_id: completedOrder.user_id,
        });

        if (incrementError) {
          logSupabaseError('increment_orders_count', incrementError);
          return {
            error: incrementError.message || 'Failed to increment completed orders count',
          };
        }
      }

      this.removeJobFromLocalState(String(id));
      this.invalidateJobsCache();
      return { error: null };
    } catch (err) {
      logSupabaseError('completeOrderRow', err);
      const message = err instanceof Error ? err.message : 'Complete failed';
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

    const buildQuery = (columns: string) => {
      let query = client
        .from(environment.supabase.jobsTable)
        .select(columns)
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters?.city) {
        query = query.eq('city', filters.city);
      }

      return query;
    };

    let { data, error } = await buildQuery(JOBS_LIST_COLUMNS);

    if (error?.message?.includes('order_files')) {
      logSupabaseError('fetchJobklientRows.embed', error);
      ({ data, error } = await buildQuery(
        'id,created_at,title,budget,description,category,city,status,client_name,client_phone',
      ));
    }

    if (error) {
      logSupabaseError('fetchJobklientRows', error);
      throw new Error(error.message);
    }

    return (data ?? []).filter(
      (row) => !isCompletedOrderStatus((row as { status?: string | null }).status),
    );
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

      const specialistsResult = await client
        .from(environment.supabase.specialistTable)
        .select('*')
        .neq('role', 'admin')
        .order('name', { ascending: true });

      if (specialistsResult.error) {
        logSupabaseError('loadSpecialists', specialistsResult.error);
        this.profilesSignal.set(localProfiles);
        this.loadedSignal.set(true);
        return localProfiles;
      } else {
        for (const row of (specialistsResult.data ?? []) as MasterRow[]) {
          if (!row?.id) {
            continue;
          }

          if (row.is_archive) {
            continue;
          }

          const profile = masterRowToProfile(row);
          if (!this.isVisibleCatalogProfile(profile)) {
            continue;
          }

          remoteProfiles.push(profile);
        }
      }

      const merged = this.mergeCatalogProfiles(remoteProfiles, localProfiles);
      this.syncPortfolioWorksToStores(this.buildWorksMapFromLocalStores(), merged);

      console.info('[SupabaseService] catalog loaded', {
        remote: remoteProfiles.length,
        local: localProfiles.length,
        merged: merged.length,
        works: 0,
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
      profile.whatsapp_phone?.trim() ||
      profile.tg_username?.trim() ||
      profile.whatsapp?.trim() ||
      profile.telegram?.trim()
    );
  }

  private mergeCatalogProfiles(remote: Profile[], local: Profile[]): Profile[] {
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

  private buildWorksMapFromLocalStores(): Map<string, WorkProject[]> {
    const map = new Map(this.portfolioWorksByOwnerSignal());

    for (const performer of this.portfolioStore.performers()) {
      if (performer.works.length > 0) {
        map.set(performer.id, performer.works);
      }
    }

    for (const company of this.furnitureStore.companies()) {
      if (company.works.length > 0) {
        map.set(company.dbId ?? company.id, company.works);
      }
    }

    return map;
  }

  private syncPortfolioWorksToStores(worksMap: Map<string, WorkProject[]>, profiles: Profile[]): void {
    const performers: PerformerProfile[] = [];
    const companies: FurnitureCompany[] = [];

    for (const profile of profiles) {
      const remoteWorks = worksMap.get(profile.id) ?? [];
      const works =
        remoteWorks.length > 0 ? remoteWorks : this.resolveLocalWorks(profile.id);
      if (profile.type === 'furniture') {
        companies.push(profileToFurnitureCompany(profile, works));
      } else {
        performers.push(profileToPerformer(profile, works));
      }
    }

    this.portfolioStore.replacePerformersFromRemote(performers);
    this.furnitureStore.replaceCompaniesFromRemote(companies);
  }

  private async savePortfolioWorkRow(input: {
    ownerId: string;
    ownerType: PortfolioWorkOwnerType;
    work: WorkProject;
  }): Promise<SupabaseMutationResult<WorkProject>> {
    const work: WorkProject = {
      ...input.work,
      id: input.work.id || crypto.randomUUID(),
    };

    this.upsertWorkInCaches(input.ownerId, work);
    return { data: work, error: null };
  }

  private async deletePortfolioWorkRow(workId: string): Promise<SupabaseMutationResult<null>> {
    const trimmedId = workId.trim();
    if (!trimmedId) {
      return { data: null, error: 'Missing work id' };
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
    const performer = profileToPerformer(profile, works);
    return {
      ...performer,
      socialLinks: mergeSocialLinks(performer.socialLinks, local?.socialLinks),
    };
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
    const company = profileToFurnitureCompany(profile, works);
    return {
      ...company,
      socialLinks: mergeSocialLinks(company.socialLinks, local?.socialLinks),
    };
  }
}
