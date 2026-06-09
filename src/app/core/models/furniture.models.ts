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
  works: WorkProject[];
  isDemo?: boolean;
}
