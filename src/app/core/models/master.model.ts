export type MasterAccountType = 'worker' | 'brigade' | 'furniture';

/** Строка таблицы `specialist` (реальная схема Supabase). */
export interface MasterRow {
  id: string;
  name: string;
  surname: string;
  phone: string;
  avatar_url?: string | null;
  balance?: number | null;
  skills?: string[] | null;
  city?: string | null;
  is_verified?: boolean | null;
  created_at?: string;
  whatsapp_phone?: string | null;
  tg_username?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  role?: string | null;
  is_archive?: boolean | null;
  slug?: string | null;
  account_type?: MasterAccountType | null;
  /** Устаревшие поля — только для обратной совместимости при чтении. */
  full_name?: string | null;
  specialty?: string | null;
  description?: string | null;
  call_out_fee?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  header_bg?: string | null;
  current_active_orders?: number | null;
  max_active_orders?: number | null;
}

/** Строка таблицы `brigades`. */
export interface BrigadeRow {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url?: string | null;
  city: string | null;
  specialty: string | null;
  description: string | null;
  call_out_fee: string | null;
  balance?: number | null;
  whatsapp_phone: string | null;
  tg_username: string | null;
  whatsapp: string | null;
  telegram: string | null;
  instagram: string | null;
  facebook: string | null;
  created_at?: string;
}

/** Мастер (worker) для UI и калькулятора. */
export interface Master {
  id: string;
  full_name: string;
  phone?: string | null;
  city?: string | null;
  specialty?: string | null;
  description?: string | null;
  call_out_fee?: string | null;
  whatsapp_phone?: string;
  tg_username?: string;
}

/** Бригада для UI и калькулятора. */
export interface Brigade {
  id: string;
  full_name: string;
  phone?: string | null;
  city?: string | null;
  specialty?: string | null;
  description?: string | null;
  call_out_fee?: string | null;
  whatsapp_phone?: string;
  tg_username?: string;
}

export interface ReviewRow {
  id: string;
  master_id?: string | null;
  client_name?: string | null;
  user_name?: string | null;
  review_text: string;
  rating?: number | null;
  kind?: string | null;
  performer_type?: string | null;
  performer_type_key?: string | null;
  performer_name?: string | null;
  before_image?: string | null;
  after_image?: string | null;
  /** Колонка `is_approved` в `site_reviews`. */
  is_approved?: boolean | null;
  created_at?: string;
}

export interface AuthSignUpMetadata {
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatarUrl?: string | null;
  city?: string;
  specialty?: string;
  description?: string;
  account_type?: MasterAccountType | 'furniture';
  pro_role?: string;
  call_out_fee?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}

/** Строка таблицы `furniture_orders` (профиль компании или заказ из калькулятора). */
export interface FurnitureOrderRow {
  id: string;
  slug?: string | null;
  full_name?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  furniture_type?: string | null;
  work_type?: string | null;
  phone?: string | null;
  city?: string | null;
  specialty?: string | null;
  description?: string | null;
  whatsapp_phone?: string | null;
  tg_username?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  created_at?: string;
}

/** Payload для `.insert()` в таблицу `furniture_orders`. */
export interface FurnitureOrderInsert {
  client_name: string;
  client_phone: string;
  furniture_type: string;
  work_type: string;
  city?: string;
  description?: string | null;
}
