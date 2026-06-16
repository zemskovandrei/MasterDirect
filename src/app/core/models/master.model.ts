export type MasterAccountType = 'worker' | 'brigade';

/** Строка таблицы `specialist` (мастера / worker). */
export interface MasterRow {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  specialty: string | null;
  description: string | null;
  account_type: MasterAccountType | null;
  call_out_fee: string | null;
  whatsapp_phone: string | null;
  tg_username: string | null;
  whatsapp: string | null;
  telegram: string | null;
  instagram: string | null;
  facebook: string | null;
  header_bg?: string | null;
  is_archive?: boolean | null;
  created_at?: string;
}

/** Строка таблицы `brigades`. */
export interface BrigadeRow {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  specialty: string | null;
  description: string | null;
  call_out_fee: string | null;
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
  master_id: string | null;
  client_name: string;
  review_text: string;
  rating: number | null;
  kind: string | null;
  performer_type: string | null;
  performer_type_key: string | null;
  performer_name: string | null;
  before_image: string | null;
  after_image: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface AuthSignUpMetadata {
  full_name: string;
  phone?: string;
  city?: string;
  specialty?: string;
  description?: string;
  account_type?: MasterAccountType;
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
