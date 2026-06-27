/** Типы строк и payload для таблиц Supabase (схема проекта). */

export type SpecialistAccountType = 'worker' | 'brigade' | 'furniture';

/** Строка таблицы `specialist` (id → auth.users.id). */
export interface Specialist {
  id: string;
  name: string;
  surname: string;
  phone: string;
  balance?: number | null;
  skills: string[] | null;
  city: string | null;
  is_verified: boolean | null;
  whatsapp_phone: string | null;
  tg_username: string | null;
  instagram: string | null;
  facebook: string | null;
  role: string | null;
  /** Тип карточки в каталоге: мастер / бригада / мебель. */
  account_type: SpecialistAccountType;
  /** Доп. колонки в прод-БД (мебель, архив). */
  is_archive?: boolean | null;
  slug?: string | null;
}

/** Payload для `.insert()` / `.upsert()` в `specialist`. */
export type SpecialistInsert = Specialist;

/** Частичное обновление профиля специалиста. */
export type SpecialistUpdate = Partial<Omit<Specialist, 'id'>>;

export const ORDER_COMPLETED_STATUS = 'completed' as const;

const INACTIVE_ORDER_STATUSES = new Set([
  ORDER_COMPLETED_STATUS,
  'done',
  'archived',
  'deleted',
  'closed',
  'cancelled',
  'canceled',
  'выполнен',
  'выполнено',
  'закрыт',
  'закрыто',
]);

/** Строка таблицы `order` (user_id → specialist.id, nullable для гостевых заявок). */
export interface Order {
  id: number;
  user_id: string | null;
  created_at: string;
  title: string;
  client_name: string;
  client_phone: string;
  city: string;
  budget: number | null;
  category: string;
  description: string | null;
  status: string;
}

/** Payload для `.insert()` в `order`. */
export type OrderInsert = Omit<Order, 'id' | 'created_at'>;

/** Частичное обновление заказа. */
export type OrderUpdate = Partial<Omit<Order, 'id' | 'created_at'>>;

/** Строка таблицы `order_files` (вложения к заявке). */
export interface OrderFile {
  id: string;
  order_id: number;
  file_path: string;
  created_at: string;
}

export type OrderFileInsert = Pick<OrderFile, 'order_id' | 'file_path'>;

export interface ListActiveOrdersOptions {
  limit?: number;
  /** Если задан — только заказы этого специалиста. */
  userId?: string;
}

export function isActiveOrderStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return !INACTIVE_ORDER_STATUSES.has(normalized);
}

/** Строка таблицы `site_reviews`. */
export interface SiteReview {
  id: string;
  created_at: string;
  user_name: string;
  review_text: string;
  status?: 'pending' | 'approved' | 'rejected' | null;
  /** Есть в прод-БД; опционально для обратной совместимости. */
  is_approved?: boolean | null;
}

/** Payload для `.insert()` в `site_reviews`. */
export type SiteReviewInsert = Pick<SiteReview, 'user_name' | 'review_text'> & {
  status?: 'pending' | 'approved' | 'rejected' | null;
  is_approved?: boolean | null;
};

/** Частичное обновление отзыва (модерация). */
export type SiteReviewUpdate = Partial<
  Pick<SiteReview, 'user_name' | 'review_text' | 'status' | 'is_approved'>
>;

/** Строка таблицы `waitlist` для уведомлений о свободных слотах. */
export interface WaitlistEntry {
  id?: string | number;
  master_id: string;
  user_email: string;
  /** В текущей БД колонка названа на русском: `статус`. */
  статус?: string | null;
}

export type WaitlistInsert = Pick<WaitlistEntry, 'master_id' | 'user_email' | 'статус'>;
