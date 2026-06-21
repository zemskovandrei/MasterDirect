import type { AuthError, User } from '@supabase/supabase-js';

export type AuthErrorMessageKey =
  | 'cabinet.signInErrorInvalidCredentials'
  | 'cabinet.signInErrorEmailNotConfirmed'
  | 'cabinet.signInErrorUserBanned'
  | 'cabinet.signInErrorRateLimit'
  | 'cabinet.signInErrorNotConfigured'
  | 'cabinet.signInError';

export type RegisterErrorMessageKey =
  | 'cabinet.registerErrorEmailExists'
  | 'cabinet.registerErrorEmailNotConfirmed'
  | 'cabinet.registerErrorDatabase'
  | 'cabinet.registerErrorRateLimit'
  | 'cabinet.registerError';

/** Лимит писем Supabase (signup / resend / reset). */
export function isAuthEmailRateLimitError(error: AuthError | null | undefined): boolean {
  if (!error) {
    return false;
  }
  const code = String(error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();
  const status = Number((error as AuthError & { status?: number }).status ?? 0);
  return (
    status === 429 ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('too many requests')
  );
}

/** Нет активной сессии — нормально для гостя, не логировать как ошибку. */
export function isAuthSessionMissingError(error: AuthError | null | undefined): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();

  return code === 'session_not_found' || message.includes('auth session missing');
}

/** JWT/сессия недействительны (403/401, пользователь удалён, смена проекта Supabase). */
export function isInvalidAuthSessionError(error: AuthError | null | undefined): boolean {
  if (!error || isAuthSessionMissingError(error)) {
    return false;
  }

  const code = String(error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();
  const status = Number((error as AuthError & { status?: number }).status ?? 0);

  return (
    status === 401 ||
    status === 403 ||
    code === 'user_not_found' ||
    code === 'bad_jwt' ||
    code === 'invalid_jwt' ||
    message.includes('does not exist') ||
    message.includes('invalid claim') ||
    message.includes('jwt expired') ||
    message.includes('invalid token')
  );
}

/** Supabase returns an empty identities array when the email is already taken. */
export function isDuplicateSignupUser(user: User | null | undefined): boolean {
  return !!user && (!user.identities || user.identities.length === 0);
}

export function registerErrorMessageKey(
  error: AuthError | null | undefined,
  user?: User | null,
): RegisterErrorMessageKey {
  if (isDuplicateSignupUser(user)) {
    return 'cabinet.registerErrorEmailExists';
  }

  if (!error) {
    return 'cabinet.registerError';
  }

  const code = String(error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'cabinet.registerErrorEmailNotConfirmed';
  }

  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('email already') ||
    message.includes('user already exists')
  ) {
    return 'cabinet.registerErrorEmailExists';
  }

  if (isAuthEmailRateLimitError(error)) {
    return 'cabinet.registerErrorRateLimit';
  }

  if (
    code === 'unexpected_failure' ||
    message.includes('database error saving new user') ||
    message.includes('database error') ||
    message.includes('handle_new_auth_user')
  ) {
    return 'cabinet.registerErrorDatabase';
  }

  const status = Number((error as AuthError & { status?: number }).status ?? 0);
  if (status >= 500) {
    return 'cabinet.registerErrorDatabase';
  }

  return 'cabinet.registerError';
}

export function authErrorMessageKey(error: AuthError | null | undefined): AuthErrorMessageKey {
  if (!error) {
    return 'cabinet.signInError';
  }

  const code = String(error.code ?? '').toLowerCase();
  const message = String(error.message ?? '').toLowerCase();

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'cabinet.signInErrorEmailNotConfirmed';
  }

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid email or password')
  ) {
    return 'cabinet.signInErrorInvalidCredentials';
  }

  if (code === 'user_banned' || message.includes('user is banned')) {
    return 'cabinet.signInErrorUserBanned';
  }

  if (isAuthEmailRateLimitError(error)) {
    return 'cabinet.signInErrorRateLimit';
  }

  if (message.includes('supabase is not configured')) {
    return 'cabinet.signInErrorNotConfigured';
  }

  return 'cabinet.signInError';
}
