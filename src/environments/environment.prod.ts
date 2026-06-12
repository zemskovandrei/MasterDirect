import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  supabase: {
    url: 'https://zrlggaimupenmgnrevts.supabase.co',
    anonKey: 'sb_publishable_vjiQ-kq5m1mYOr7ofj9lJw_7krrgGV9',
    jobsTable: 'jobklient',
    mastersTable: 'masters',
    reviewsTable: 'reviews',
    adminEmails: ['admin@smartbuild.tech'],
  },
};
