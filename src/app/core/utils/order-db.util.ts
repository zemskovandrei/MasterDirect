import type { Order, OrderInsert } from '../models/database.models';
import type { Job, JobklientJobInsert, JobklientJobRow } from '../../models/job.model';
import { mapJobklientRowToJob, toJobklientDbRow } from '../../models/job.model';

/** Payload калькулятора → типизированный insert для таблицы `order`. */
export function mapJobklientInsertToOrderInsert(
  input: JobklientJobInsert,
  userId: string | null = null,
): OrderInsert {
  const row = toJobklientDbRow(input);
  const budget =
    typeof row.budget === 'number' && Number.isFinite(row.budget) ? row.budget : null;

  return {
    user_id: userId,
    title: row.title,
    client_name: row.client_name,
    client_phone: row.client_phone,
    city: row.city,
    budget,
    category: row.category,
    description: row.description,
    status: row.status,
  };
}

/** Преобразует строку `order` из Supabase в UI-модель `Job`. */
export function mapOrderRowToJob(
  row: Order & { order_files?: Array<{ file_path?: string | null }> | null },
  index: number,
): Job | null {
  const legacyRow: JobklientJobRow = {
    id: row.id,
    title: row.title,
    client_name: row.client_name,
    client_phone: row.client_phone,
    phone: row.client_phone,
    city: row.city,
    budget: row.budget,
    category: row.category,
    description: row.description,
    status: row.status,
    created_at: row.created_at,
    order_files: row.order_files ?? null,
  };

  return mapJobklientRowToJob(legacyRow, index);
}

export function mapOrderRowsToJobs(
  rows: Array<Order & { order_files?: Array<{ file_path?: string | null }> | null }>,
): Job[] {
  return rows
    .map((row, index) => mapOrderRowToJob(row, index))
    .filter((job): job is Job => job != null);
}
