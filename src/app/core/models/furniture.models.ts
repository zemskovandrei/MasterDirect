import { PerformerSocialLinks, WorkProject } from './portfolio.models';

export interface FurnitureSession {
  companyId: string;
}

export interface FurnitureCompany {
  /** UUID из Supabase или локальный slug для записей только в localStorage. */
  id: string;
  /** Системный UUID строки в `furniture_orders` (если есть). */
  dbId?: string | null;
  /** Человекочитаемый slug вида `furniture-name-…`. */
  slug?: string | null;
  name: string;
  specialty: string;
  description: string;
  city: string;
  socialLinks?: PerformerSocialLinks;
  whatsapp_phone?: string | null;
  tg_username?: string | null;
  works: WorkProject[];
  isDemo?: boolean;
}
