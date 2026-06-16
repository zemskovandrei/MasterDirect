import type { Environment } from './environment.model';

/** Dev build — same remote Supabase project as production. */
export const environment: Environment = {
  production: false,
  supabase: {
    url: 'https://zrlggaimupenmgnrevts.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybGdnYWltdXBlbm1nbnJldnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMjc4NzUsImV4cCI6MjA5NjYwMzg3NX0.uNF8sHVDl3HWrzfB3-359KR4t2Zed4fRZeevjqQUQNA',
    jobsTable: 'order',
    mastersTable: 'specialist',
    brigadesTable: 'brigades',
    furnitureOrdersTable: 'furniture_orders',
    reviewsTable: 'reviews',
    adminEmails: ['admin@smartbuild.tech'],
  },
  telegram: {
    botToken: '',
    chatId: '',
  },
};
