import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  supabase: {
    url: 'https://xixafoznxsupsxotdjqx.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeGFmb3pueHN1cHN4b3RkanF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5NzQwMjcsImV4cCI6MjA5NzU1MDAyN30.NS0mWe26Mf6-qs4a0iZCEl9U4T9a-ckyDsR-w87pXks',
    jobsTable: 'order',
    specialistTable: 'specialist',
    reviewsTable: 'site_reviews',
    adminEmails: ['admin@smartbuild.tech'],
  },
  telegram: {
    botToken: '',
    chatId: '',
  },
};
