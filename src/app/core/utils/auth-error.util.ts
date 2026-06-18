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
  | 'cabinet.registerError';

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

  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('already been registered') ||
    message.includes('email already') ||
    message.includes('user already exists')
  ) {
    return 'cabinet.registerErrorEmailExists';
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

  if (message.includes('rate limit') || code === 'over_email_send_rate_limit') {
    return 'cabinet.signInErrorRateLimit';
  }

  if (message.includes('supabase is not configured')) {
    return 'cabinet.signInErrorNotConfigured';
  }

  return 'cabinet.signInError';
}
