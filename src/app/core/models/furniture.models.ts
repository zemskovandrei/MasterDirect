import { PerformerSocialLinks, WorkProject } from './portfolio.models';

export interface FurnitureSession {
  companyId: string;
}

export interface FurnitureCompany {
  id: string;
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
