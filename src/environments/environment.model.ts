export interface Environment {
  production: boolean;
  supabase: {
    url: string;
    /** Public anon / publishable key (never use service_role in the browser). */
    anonKey: string;
    jobsTable: string;
    mastersTable: string;
    brigadesTable: string;
    furnitureOrdersTable: string;
    reviewsTable: string;
    /** Emails allowed to access admin moderation UI */
    adminEmails: string[];
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
}
