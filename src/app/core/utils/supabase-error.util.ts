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
