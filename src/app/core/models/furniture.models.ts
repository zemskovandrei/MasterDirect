import { WorkProject } from './portfolio.models';

export interface FurnitureCompany {
  id: string;
  name: string;
  specialty: string;
  description: string;
  city: string;
  works: WorkProject[];
  subscribed: boolean;
  isDemo?: boolean;
}
