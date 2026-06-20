/** Единый формат логов ошибок Supabase в консоли браузера (F12). */
export function logSupabaseError(context: string, error: unknown): void {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if ('code' in record || 'details' in record || 'hint' in record) {
      console.error('Supabase Error:', {
        context,
        code: record['code'],
        message: record['message'],
        details: record['details'],
        hint: record['hint'],
        status: record['status'],
        error,
      });
      return;
    }
  }

  if (error instanceof Error) {
    console.error('Supabase Error:', {
      context,
      message: error.message,
      name: error.name,
      cause: error.cause,
      stack: error.stack,
    });
    return;
  }

  console.error('Supabase Error:', { context, error });
}

export function supabaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) {
      return message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '';
}

/** Браузер не смог достучаться до Supabase (DNS, офлайн, VPN, блокировка). */
export function isSupabaseNetworkError(error: unknown): boolean {
  const message = supabaseErrorMessage(error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('err_name_not_resolved') ||
    message.includes('could not resolve') ||
    message.includes('enotfound') ||
    message.includes('getaddrinfo')
  );
}

export function supabaseNetworkErrorHint(projectUrl: string): string {
  const host = projectUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return `Не удаётся подключиться к Supabase (${host}). Проверьте интернет и DNS, URL проекта в environment.ts и статус проекта в Supabase Dashboard (Settings → API).`;
}

/** PostgREST / Postgres: колонка или поле отсутствует в схеме. */
export function isSupabaseSchemaColumnError(error: unknown): boolean {
  const text = supabaseErrorMessage(error).toLowerCase();
  return (
    (text.includes('column') && (text.includes('does not exist') || text.includes('could not find'))) ||
    text.includes('schema cache') ||
    text.includes('42703')
  );
}

export function logFetchResponseError(
  context: string,
  response: Response,
  body: string,
): void {
  console.error('Supabase Error:', {
    context,
    status: response.status,
    statusText: response.statusText,
    url: response.url,
    body,
  });
}
