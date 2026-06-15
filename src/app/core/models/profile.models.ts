/** Тип профиля в таблице Supabase `profiles`. */
export type ProfileType = 'worker' | 'brigade' | 'furniture';

/** Строка таблицы `profiles` в Supabase. */
export interface Profile {
  id: string;
  type: ProfileType;
  name: string;
  specialty: string;
  description: string;
  /** Локальный slug (не UUID) для маршрутов и legacy localStorage. */
  slug?: string | null;
  city?: string | null;
  call_out_fee?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  whatsapp_phone?: string | null;
  tg_username?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  header_bg?: string | null;
  created_at?: string | null;
}

export interface ProfileInsert {
  type: ProfileType;
  name: string;
  specialty: string;
  description: string;
  city?: string;
  callOutFee?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}

export interface ProfileUpdate {
  name?: string;
  specialty?: string;
  description?: string;
  city?: string;
  callOutFee?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}
