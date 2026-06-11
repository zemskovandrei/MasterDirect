export interface Environment {
  production: boolean;
  supabase: {
    url: string;
    anonKey: string;
    /** PostgREST table for active job listings (public schema), e.g. jobklient. */
    jobsTable: string;
  };
}
