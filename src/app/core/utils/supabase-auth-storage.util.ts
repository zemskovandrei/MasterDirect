/** Project ref из URL вида https://xxxx.supabase.co */
export function supabaseProjectRefFromUrl(url: string): string {
  try {
    const host = new URL(url.trim()).hostname;
    return host.split('.')[0] ?? '';
  } catch {
    return '';
  }
}

/** Удаляет сессии других Supabase-проектов из localStorage (после смены environment). */
export function purgeLegacySupabaseAuthStorage(currentProjectRef: string): void {
  if (typeof window === 'undefined' || !currentProjectRef) {
    return;
  }

  const prefix = `sb-${currentProjectRef}-`;
  const keysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) {
      continue;
    }
    if (!key.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
