export interface Environment {
  production: boolean;
  supabase: {
    url: string;
    anonKey: string;
    jobsTable: string;
    mastersTable: string;
    brigadesTable: string;
    reviewsTable: string;
    /** Emails allowed to access admin moderation UI */
    adminEmails: string[];
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
}
