import { APP_BASE_HREF_VALUE } from '../config/base-href';

/** URL возврата после подтверждения email / сброса пароля. */
export function buildAuthRedirectUrl(origin: string): string {
  const base = APP_BASE_HREF_VALUE.endsWith('/')
    ? APP_BASE_HREF_VALUE
    : `${APP_BASE_HREF_VALUE}/`;
  const path = `${base}cabinet`.replace(/\/{2,}/g, '/');
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export function hasAuthCallbackInUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.has('code')) {
      return true;
    }
    const hash = parsed.hash.replace(/^#/, '').toLowerCase();
    return (
      hash.includes('access_token=') ||
      hash.includes('type=signup') ||
      hash.includes('type=email')
    );
  } catch {
    return false;
  }
}

export function stripAuthParamsFromUrl(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('code');
  parsed.searchParams.delete('error');
  parsed.searchParams.delete('error_description');
  parsed.hash = '';
  return `${parsed.pathname}${parsed.search}`;
}
