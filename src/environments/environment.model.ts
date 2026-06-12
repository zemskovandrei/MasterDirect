export interface Environment {
  production: boolean;
  supabase: {
    url: string;
    anonKey: string;
    jobsTable: string;
    mastersTable: string;
    reviewsTable: string;
    /** Emails allowed to access admin moderation UI */
    adminEmails: string[];
  };
}
