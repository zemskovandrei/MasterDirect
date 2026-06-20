import type { PostgrestError } from '@supabase/supabase-js';
import { supabaseErrorMessage } from '../utils/supabase-error.util';

/** Ошибка CRUD-слоя DataService (обёртка над PostgrestError). */
export class DataServiceError extends Error {
  readonly postgrest?: PostgrestError | null;

  constructor(message: string, postgrest?: PostgrestError | null) {
    super(message);
    this.name = 'DataServiceError';
    this.postgrest = postgrest;
  }
}

export function toDataServiceError(error: PostgrestError | null, scope: string): DataServiceError {
  const message = supabaseErrorMessage(error) || `${scope} failed`;
  return new DataServiceError(message, error);
}
