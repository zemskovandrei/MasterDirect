import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { DataServiceError, toDataServiceError } from '../errors/data-service.error';
import type {
  ListActiveOrdersOptions,
  Order,
  OrderInsert,
  OrderUpdate,
  SiteReview,
  SiteReviewInsert,
  SiteReviewUpdate,
  Specialist,
  SpecialistInsert,
  SpecialistUpdate,
  SpecialistAccountType,
} from '../models/database.models';
import { ORDER_COMPLETED_STATUS, isActiveOrderStatus } from '../models/database.models';
import { specialistRowToWritePayload, type SpecialistWriteInput } from '../utils/specialist-db.util';
import { logSupabaseError } from '../utils/supabase-error.util';
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

    const { data, error } = await client
      .from(this.specialistTable)
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();

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
      .select('*')
      .neq('status', ORDER_COMPLETED_STATUS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (options.userId) {
      query = query.eq('user_id', options.userId);
    }

    const { data, error } = await query;

    const rows = this.requireList<Order>(data, error, 'listActiveOrders');
    return rows.filter((row) => isActiveOrderStatus(row.status));
  }

  async insertOrder(row: OrderInsert): Promise<Order> {
    const client = await this.requireClient();

    const { data, error } = await client.from(this.orderTable).insert(row).select('*').single();

    return this.requireSingle<Order>(data, error, 'insertOrder');
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

  // ─── site_reviews ─────────────────────────────────────────────────────────

  async listApprovedReviews(limit = 50): Promise<SiteReview[]> {
    const client = await this.requireClient();

    const { data, error } = await client
      .from(this.reviewsTable)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    return this.requireList<SiteReview>(data, error, 'listApprovedReviews');
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
    return this.getReviewById(id);
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
      throw new DataServiceError(`${scope}: empty response`);
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
}
