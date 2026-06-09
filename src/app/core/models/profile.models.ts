/** Тип профиля в таблице Supabase `profiles`. */
export type ProfileType = 'worker' | 'brigade' | 'furniture';

/** Строка таблицы `profiles` в Supabase. */
export interface Profile {
  id: string;
  type: ProfileType;
  name: string;
  specialty: string;
  description: string;
  city?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  created_at?: string | null;
}

export interface ProfileInsert {
  type: ProfileType;
  name: string;
  specialty: string;
  description: string;
  city?: string;
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
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}
