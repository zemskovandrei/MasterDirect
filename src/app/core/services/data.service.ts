import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { DataServiceError, toDataServiceError } from '../errors/data-service.error';
import type {
  ListActiveOrdersOptions,
  Order,
  OrderInsert,
  OrderFileInsert,
  OrderUpdate,
  SiteReview,
  SiteReviewInsert,
  SiteReviewUpdate,
  Specialist,
  SpecialistInsert,
  SpecialistUpdate,
  SpecialistAccountType,
  WaitlistEntry,
  WaitlistInsert,
} from '../models/database.models';
import { ORDER_COMPLETED_STATUS, isActiveOrderStatus } from '../models/database.models';
import { specialistRowToWritePayload, type SpecialistWriteInput } from '../utils/specialist-db.util';
import { logSupabaseError, isSupabaseSchemaColumnError, supabaseErrorMessage } from '../utils/supabase-error.util';
import { SupabaseClientService } from './supabase-client.service';

const NOT_CONFIGURED = 'Supabase не настроен. Укажите url и anonKey в environment.';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabaseClient = inject(SupabaseClientService);

  private get specialistTable(): string {
    return environment.supabase.specialistTable;
  }

  private get orderTable(): string {
    return environment.supabase.jobsTable;
  }

  private get reviewsTable(): string {
    return environment.supabase.reviewsTable;
  }

  // ─── specialist ───────────────────────────────────────────────────────────

  async getSpecialistById(id: string): Promise<Specialist> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.specialistTable)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return this.requireSingle<Specialist>(data, error, 'getSpecialistById');
  }

  async listSpecialists(): Promise<Specialist[]> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.specialistTable)
      .select('*')
      .order('name', { ascending: true });

    return this.requireList<Specialist>(data, error, 'listSpecialists');
  }

  async listSpecialistsByAccountType(accountType: SpecialistAccountType): Promise<Specialist[]> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.specialistTable)
      .select('*')
      .eq('account_type', accountType)
      .order('name', { ascending: true });

    return this.requireList<Specialist>(data, error, 'listSpecialistsByAccountType');
  }

  async upsertSpecialist(row: SpecialistInsert): Promise<Specialist> {
    const client = await this.requireClient();

    let { data, error } = await client
      .from(this.specialistTable)
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

    if (error && this.isMissingAvatarColumnError(error)) {
      const fallbackRow: Partial<SpecialistInsert> = { ...row };
      delete (fallbackRow as { avatar_url?: unknown }).avatar_url;
      ({ data, error } = await client
        .from(this.specialistTable)
        .upsert(fallbackRow as SpecialistInsert, { onConflict: 'id' })
        .select('*')
        .single());
    }

    return this.requireSingle<Specialist>(data, error, 'upsertSpecialist');
  }

  async upsertSpecialistFromRegistration(input: SpecialistWriteInput): Promise<Specialist> {
    const payload = specialistRowToWritePayload(input) as unknown as SpecialistInsert;
    return this.upsertSpecialist(payload);
  }

  async updateSpecialist(id: string, patch: SpecialistUpdate): Promise<Specialist> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.specialistTable)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    return this.requireSingle<Specialist>(data, error, 'updateSpecialist');
  }

  /**
   * Счётчик профилей по типу каталога.
   * Фильтрует по `account_type`, не по `role` (role = pro_role: master, brigade, builder…).
   */
  async countSpecialistsByAccountType(accountType: SpecialistAccountType): Promise<number> {
    const client = await this.requireClient();

    const { count, error } = await client
      .from(this.specialistTable)
      .select('*', { count: 'exact', head: true })
      .eq('account_type', accountType);

    if (error) {
      logSupabaseError('countSpecialistsByAccountType', error);
      throw toDataServiceError(error, 'countSpecialistsByAccountType');
    }

    return count ?? 0;
  }

  async countWorkers(): Promise<number> {
    return this.countSpecialistsByAccountType('worker');
  }

  async countBrigades(): Promise<number> {
    return this.countSpecialistsByAccountType('brigade');
  }

  async countFurnitureCompanies(): Promise<number> {
    return this.countSpecialistsByAccountType('furniture');
  }

  async getRecommendedSpecialists(
    masterSkills: string[],
    currentMasterId: string,
    limit = 3,
  ): Promise<{ data: Specialist[] | null; error: string | null }> {
    const client = await this.requireClient();
    const normalizedSkills = Array.from(
      new Set(masterSkills.map((skill) => skill.trim()).filter(Boolean)),
    );
    const currentId = currentMasterId.trim();

    if (!normalizedSkills.length) {
      return { data: [], error: null };
    }

    const { data, error } = await client
      .from(this.specialistTable)
      .select('*')
      .contains('skills', normalizedSkills)
      .neq('id', currentId)
      .limit(50);

    if (error) {
      logSupabaseError('getRecommendedSpecialists', error);
      return {
        data: null,
        error: supabaseErrorMessage(error) || error.message,
      };
    }

    const candidates = (data ?? []) as Specialist[];

    // В таблице specialist колонки загрузки могут отсутствовать в типе, поэтому фильтруем мягко.
    const available = candidates.filter((specialist) => this.hasAvailableCapacity(specialist));

    return {
      data: available.slice(0, Math.max(1, limit)),
      error: null,
    };
  }

  async getTopMastersByCity(
    city: string,
    limit = 3,
  ): Promise<{ data: Specialist[] | null; error: string | null }> {
    const client = await this.requireClient();
    const normalizedCity = city.trim();

    if (!normalizedCity) {
      return { data: [], error: null };
    }

    const { data, error } = await client
      .from(this.specialistTable)
      .select('*')
      .eq('city', normalizedCity)
      .eq('is_archive', false)
      .order('orders_count', { ascending: false })
      .limit(50);

    if (error) {
      logSupabaseError('getTopMastersByCity', error);
      return {
        data: null,
        error: supabaseErrorMessage(error) || error.message,
      };
    }

    const candidates = (data ?? []) as Specialist[];
    const available = candidates.filter((specialist) => this.hasAvailableCapacity(specialist));

    return {
      data: available.slice(0, Math.max(1, limit)),
      error: null,
    };
  }

  async loadRecommendations(
    skills: string[],
    masterId: string,
    city = 'Batumi',
    limit = 3,
  ): Promise<{ data: Specialist[]; error: string | null }> {
    let result = await this.getRecommendedSpecialists(skills, masterId, limit);

    if (!result.data?.length) {
      result = await this.getTopMastersByCity(city, limit);
    }

    return {
      data: result.data ?? [],
      error: result.error,
    };
  }

  async addToWaitlist(
    masterId: string,
    email: string,
  ): Promise<{ data: WaitlistEntry[] | null; error: string | null }> {
    const client = await this.requireClient();
    const normalizedMasterId = masterId.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedMasterId || !normalizedEmail) {
      return { data: null, error: 'masterId and email are required' };
    }

    const payload: WaitlistInsert = {
      master_id: normalizedMasterId,
      user_email: normalizedEmail,
      статус: 'pending',
    };

    const { data, error } = await client.from('waitlist').insert([payload]).select('*');

    if (error) {
      logSupabaseError('addToWaitlist', error);
      return {
        data: null,
        error: supabaseErrorMessage(error) || error.message,
      };
    }

    return {
      data: (data ?? []) as WaitlistEntry[],
      error: null,
    };
  }

  async confirmByMaster(
    dealId: string,
  ): Promise<{ data: Record<string, unknown>[] | null; error: string | null }> {
    const client = await this.requireClient();
    const normalizedDealId = dealId.trim();

    if (!normalizedDealId) {
      return { data: null, error: 'dealId is required' };
    }

    const { data, error } = await client
      .from('deals')
      .update({ master_confirmed: true })
      .eq('идентификатор', normalizedDealId)
      .select('*');

    if (error) {
      logSupabaseError('confirmByMaster', error);
      return {
        data: null,
        error: supabaseErrorMessage(error) || error.message,
      };
    }

    return {
      data: (data ?? []) as Record<string, unknown>[],
      error: null,
    };
  }

  // ─── order ────────────────────────────────────────────────────────────────

  /**
   * Активные заказы: status ≠ completed + доп. фильтр isActiveOrderStatus.
   * Опционально — только заказы конкретного specialist (user_id).
   */
  async listActiveOrders(options: ListActiveOrdersOptions = {}): Promise<Order[]> {
    const client = await this.requireClient();
    const limit = options.limit ?? 100;

    let query = client
      .from(this.orderTable)
      .select('*, order_files(file_path)')
      .neq('status', ORDER_COMPLETED_STATUS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    let { data, error } = await query;

    if (error?.message?.includes('order_files')) {
      logSupabaseError('listActiveOrders.embed', error);
      let fallbackQuery = client
        .from(this.orderTable)
        .select('*')
        .neq('status', ORDER_COMPLETED_STATUS)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (options.userId) {
        fallbackQuery = fallbackQuery.eq('user_id', options.userId);
      }
      ({ data, error } = await fallbackQuery);
    }

    const rows = this.requireList<Order>(data, error, 'listActiveOrders');
    return rows.filter((row) => isActiveOrderStatus(row.status));
  }

  async insertOrder(row: OrderInsert): Promise<Order> {
    const client = await this.requireClient();

    const { data, error } = await client.from(this.orderTable).insert(row).select('*').single();

    return this.requireSingle<Order>(data, error, 'insertOrder');
  }

  async getOrderById(id: number): Promise<Order> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.orderTable)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    return this.requireSingle<Order>(data, error, 'getOrderById');
  }

  async insertOrderFile(row: OrderFileInsert): Promise<void> {
    const client = await this.requireClient();

    const { error } = await client.from('order_files').insert(row);

    if (error) {
      logSupabaseError('insertOrderFile', error);
      throw toDataServiceError(error, 'insertOrderFile');
    }
  }

  async updateOrder(id: number, patch: OrderUpdate): Promise<Order> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.orderTable)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    return this.requireSingle<Order>(data, error, 'updateOrder');
  }

  async completeOrder(id: number): Promise<Order> {
    return this.updateOrder(id, { status: ORDER_COMPLETED_STATUS });
  }

  async countCompletedOrdersByUser(userId: string): Promise<number> {
    const client = await this.requireClient();
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      return 0;
    }

    const { count, error } = await client
      .from(this.orderTable)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', trimmedUserId)
      .eq('status', ORDER_COMPLETED_STATUS);

    if (error) {
      logSupabaseError('countCompletedOrdersByUser', error);
      throw toDataServiceError(error, 'countCompletedOrdersByUser');
    }

    return count ?? 0;
  }

  // ─── site_reviews ─────────────────────────────────────────────────────────

  async listApprovedReviews(limit = 50): Promise<SiteReview[]> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.reviewsTable)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    const rows = this.requireList<SiteReview>(data, error, 'listApprovedReviews');
    return rows.filter((row) => row.status === 'approved' || row.is_approved === true);
  }

  async listPendingReviews(_limit = 50): Promise<SiteReview[]> {
    // Колонка is_approved отсутствует в базовой схеме site_reviews.
    return [];
  }

  async insertReview(row: SiteReviewInsert): Promise<SiteReview> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.reviewsTable)
      .insert(row)
      .select('*')
      .single();

    return this.requireSingle<SiteReview>(data, error, 'insertReview');
  }

  async updateReview(id: string, patch: SiteReviewUpdate): Promise<SiteReview> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.reviewsTable)
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    return this.requireSingle<SiteReview>(data, error, 'updateReview');
  }

  async approveReview(id: string): Promise<SiteReview> {
    return this.updateReview(id, { status: 'approved', is_approved: true });
  }

  private async getReviewById(id: string): Promise<SiteReview> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.reviewsTable)
      .select('*')
      .eq('id', id)
      .single();

    return this.requireSingle<SiteReview>(data, error, 'getReviewById');
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async requireClient(): Promise<SupabaseClient> {
    if (!isPlatformBrowser(this.platformId)) {
      throw new DataServiceError('Browser only');
    }

    if (!this.supabaseClient.isConfigured()) {
      throw new DataServiceError(NOT_CONFIGURED);
    }

    const client = await this.supabaseClient.getClient();
    if (!client) {
      throw new DataServiceError(NOT_CONFIGURED);
    }

    return client;
  }

  private requireSingle<T>(
    data: T | null,
    error: PostgrestError | null,
    scope: string,
  ): T {
    if (error) {
      logSupabaseError(scope, error);
      throw toDataServiceError(error, scope);
    }

    if (data == null) {
      throw new DataServiceError('Profile not found');
    }

    return data;
  }

  private requireList<T>(
    data: T[] | null,
    error: PostgrestError | null,
    scope: string,
  ): T[] {
    if (error) {
      logSupabaseError(scope, error);
      throw toDataServiceError(error, scope);
    }

    return data ?? [];
  }

  private isMissingAvatarColumnError(error: unknown): boolean {
    if (!isSupabaseSchemaColumnError(error)) {
      return false;
    }
    return supabaseErrorMessage(error).toLowerCase().includes('avatar_url');
  }

  private hasAvailableCapacity(specialist: Specialist): boolean {
    const row = specialist as Specialist & {
      current_active_orders?: unknown;
      max_active_orders?: unknown;
    };

    const currentOrders = this.toNumericValue(row.current_active_orders);
    const maxOrders = this.toNumericValue(row.max_active_orders);

    // Если лимит не задан, считаем мастера доступным.
    if (maxOrders == null) {
      return true;
    }

    return (currentOrders ?? 0) < maxOrders;
  }

  private toNumericValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }
}
