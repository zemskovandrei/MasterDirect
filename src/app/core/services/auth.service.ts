import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import type { AuthSignUpMetadata } from '../models/master.model';
import { isDuplicateSignupUser, isInvalidAuthSessionError } from '../utils/auth-error.util';
import type { AuthErrorMessageKey } from '../utils/auth-error.util';
import { authErrorMessageKey } from '../utils/auth-error.util';
import { logSupabaseError, supabaseErrorMessage } from '../utils/supabase-error.util';
import { DataServiceError } from '../errors/data-service.error';
import { SupabaseService } from './supabase.service';
import { DataService } from './data.service';
import type { SpecialistAccountType } from '../models/database.models';
import {
  buildAuthRedirectUrl,
  hasAuthCallbackInUrl,
  stripAuthParamsFromUrl,
} from '../utils/auth-redirect.util';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

/** Данные профиля `specialist` после auth.signUp (Confirm email выключен). */
export interface RegisterProfilePayload {
  accountType: SpecialistAccountType;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  avatarUrl?: string | null;
  city: string;
  specialty: string;
  proRole?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}

export interface RegisterResult extends AuthResult {
  profileSaved: boolean;
  profileError: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);
  private readonly data = inject(DataService);

  private readonly userSignal = signal<User | null>(null);
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly readySignal = signal(false);
  private readonly passwordRecoverySignal = signal(false);
  private initPromise: Promise<void> | null = null;

  readonly user = this.userSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly passwordRecovery = this.passwordRecoverySignal.asReadonly();
  private readonly emailConfirmationPendingSignal = signal(false);

  readonly emailConfirmationPending = this.emailConfirmationPendingSignal.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.ensureInitialized();
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.readySignal()) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.bootstrapAuth();
    }

    await this.initPromise;
  }

  async getUser(): Promise<User | null> {
    await this.ensureInitialized();

    const client = await this.supabase.getClient();
    if (!client) {
      this.userSignal.set(null);
      return null;
    }

    const user = await this.fetchAuthUser(client);
    this.userSignal.set(user);
    return user;
  }

  private async fetchAuthUser(client: NonNullable<Awaited<ReturnType<SupabaseService['getClient']>>>): Promise<User | null> {
    try {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        if (error && isInvalidAuthSessionError(error)) {
          await this.signOut();
        }
        console.warn('Пользователь не авторизован');
        return null;
      }

      return data.user;
    } catch (e) {
      logSupabaseError('AuthService.getUser', e);
      return null;
    }
  }

  async signUp(
    email: string,
    password: string,
    metadata: AuthSignUpMetadata,
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const signUpResult = await this.signUpRequest(normalizedEmail, password, metadata);
    if (signUpResult.error || !signUpResult.user) {
      return signUpResult;
    }

    if (isDuplicateSignupUser(signUpResult.user)) {
      return signUpResult;
    }

    return signUpResult;
  }

  /**
   * Регистрация: auth.signUp + запись в `specialist`.
   * При выключенном Confirm email Supabase возвращает session сразу — профиль сохраняется в том же шаге.
   */
  async register(
    email: string,
    password: string,
    metadata: AuthSignUpMetadata,
    profile: RegisterProfilePayload,
  ): Promise<RegisterResult> {
    const authResult = await this.signUp(email, password, metadata);

    if (authResult.error || !authResult.user || isDuplicateSignupUser(authResult.user)) {
      return { ...authResult, profileSaved: false, profileError: null };
    }

    if (!authResult.session) {
      return { ...authResult, profileSaved: false, profileError: null };
    }

    try {
      await this.data.upsertSpecialistFromRegistration({
        userId: authResult.user.id,
        fullName: profile.fullName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        avatarUrl: profile.avatarUrl,
        city: profile.city,
        specialty: profile.specialty,
        proRole: profile.proRole,
        accountType: profile.accountType,
        whatsapp: profile.whatsapp,
        telegram: profile.telegram,
        instagram: profile.instagram,
        facebook: profile.facebook,
      });

      return { ...authResult, profileSaved: true, profileError: null };
    } catch (err) {
      await this.signOut();
      const profileError =
        err instanceof DataServiceError
          ? err.message
          : supabaseErrorMessage(err) || 'Profile registration failed';

      return {
        ...authResult,
        user: null,
        session: null,
        profileSaved: false,
        profileError,
      };
    }
  }

  private async signUpRequest(
    email: string,
    password: string,
    metadata: AuthSignUpMetadata,
  ): Promise<AuthResult> {
    const client = await this.supabase.getClient();
    if (!client) {
      return {
        user: null,
        session: null,
        error: { name: 'AuthError', message: 'Supabase is not configured' } as AuthError,
      };
    }

    const userMetadata = this.buildSignUpMetadata(metadata);

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: this.authRedirectUrl(),
        data: userMetadata,
      },
    });

    if (error) {
      logSupabaseError('AuthService.signUp', error);
    }

    if (data.user) {
      this.userSignal.set(data.user);
    }
    if (data.session) {
      this.sessionSignal.set(data.session);
    }

    return {
      user: data.user,
      session: data.session,
      error,
    };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    await this.ensureInitialized();

    const client = await this.supabase.getClient();
    if (!client) {
      return {
        user: null,
        session: null,
        error: { name: 'AuthError', message: 'Supabase is not configured' } as AuthError,
      };
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    this.userSignal.set(data.user ?? null);
    this.sessionSignal.set(data.session ?? null);

    return {
      user: data.user ?? null,
      session: data.session ?? null,
      error,
    };
  }

  async signOut(): Promise<void> {
    const client = await this.supabase.getClient();
    if (client) {
      await client.auth.signOut();
    }

    this.userSignal.set(null);
    this.sessionSignal.set(null);
    this.passwordRecoverySignal.set(false);
  }

  /** Вход по паролю → удаление профиля и учётной записи в Supabase. */
  async deleteAccountWithPassword(
    email: string,
    password: string,
  ): Promise<{ error: string | null; errorKey?: AuthErrorMessageKey; userId?: string }> {
    const signInResult = await this.signIn(email.trim().toLowerCase(), password);
    if (signInResult.error || !signInResult.user) {
      return { error: null, errorKey: authErrorMessageKey(signInResult.error) };
    }

    const userId = signInResult.user.id;
    const client = await this.supabase.getClient();
    if (!client) {
      await this.signOut();
      return { error: 'Supabase is not configured' };
    }

    const { error } = await client.rpc('delete_current_user');
    await this.signOut();

    if (error) {
      return { error: error.message };
    }

    return { error: null, userId };
  }

  async resetPasswordForEmail(email: string): Promise<{ error: AuthError | null }> {
    const client = await this.supabase.getClient();
    if (!client) {
      return {
        error: { name: 'AuthError', message: 'Supabase is not configured' } as AuthError,
      };
    }

    const redirectTo = this.authRedirectUrl();

    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });

    return { error };
  }

  async updatePassword(password: string): Promise<{ error: AuthError | null }> {
    const client = await this.supabase.getClient();
    if (!client) {
      return {
        error: { name: 'AuthError', message: 'Supabase is not configured' } as AuthError,
      };
    }

    const { error } = await client.auth.updateUser({ password });

    if (!error) {
      this.passwordRecoverySignal.set(false);
    }

    return { error };
  }

  clearPasswordRecovery(): void {
    this.passwordRecoverySignal.set(false);
  }

  async resendSignUpConfirmation(email: string): Promise<{ error: AuthError | null }> {
    await this.ensureInitialized();

    const client = await this.supabase.getClient();
    if (!client) {
      return {
        error: { name: 'AuthError', message: 'Supabase is not configured' } as AuthError,
      };
    }

    const { error } = await client.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: this.authRedirectUrl(),
      },
    });

    if (error) {
      logSupabaseError('AuthService.resendSignUpConfirmation', error);
    }

    return { error };
  }

  private async bootstrapAuth(): Promise<void> {
    const client = await this.supabase.getClient();
    if (!client) {
      this.readySignal.set(true);
      return;
    }

    if (isPlatformBrowser(this.platformId)) {
      await this.consumeAuthCallback(client);
    }

    const { data } = await client.auth.getSession();
    this.sessionSignal.set(data.session ?? null);
    this.userSignal.set(data.session?.user ?? null);

    if (data.session) {
      const user = await this.fetchAuthUser(client);
      if (user) {
        this.userSignal.set(user);
        this.sessionSignal.set(data.session);
        void this.supabase.syncAuthProfileFromUser(user);
      } else {
        this.userSignal.set(null);
        this.sessionSignal.set(null);
      }
    }

    client.auth.onAuthStateChange((event, session) => {
      this.sessionSignal.set(session);
      this.userSignal.set(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        this.passwordRecoverySignal.set(true);
      }
      if (event === 'SIGNED_IN' && session?.user) {
        this.emailConfirmationPendingSignal.set(false);
        void this.supabase.syncAuthProfileFromUser(session.user);
      }
    });

    if (isPlatformBrowser(this.platformId) && this.isRecoveryUrlHash(window.location.hash)) {
      this.passwordRecoverySignal.set(true);
    }

    this.readySignal.set(true);
  }

  private async consumeAuthCallback(client: Awaited<ReturnType<SupabaseService['getClient']>>): Promise<void> {
    if (!client || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const href = window.location.href;
    if (!hasAuthCallbackInUrl(href)) {
      return;
    }

    const url = new URL(href);
    const code = url.searchParams.get('code');
    const errorDescription = url.searchParams.get('error_description');
    let confirmed = false;

    if (errorDescription) {
      logSupabaseError('AuthService.authCallback', new Error(errorDescription));
      window.history.replaceState({}, '', stripAuthParamsFromUrl(href));
      return;
    }

    if (code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        logSupabaseError('AuthService.exchangeCodeForSession', error);
      } else if (data.session) {
        this.sessionSignal.set(data.session);
        this.userSignal.set(data.session.user ?? null);
        this.emailConfirmationPendingSignal.set(false);
        void this.supabase.syncAuthProfileFromUser(data.session.user);
        confirmed = true;
      }
      window.history.replaceState({}, '', stripAuthParamsFromUrl(href));
      if (confirmed) {
        await this.router.navigateByUrl('/cabinet');
      }
      return;
    }

    const { data, error } = await client.auth.getSession();
    if (error) {
      logSupabaseError('AuthService.authCallback.getSession', error);
    } else if (data.session) {
      this.sessionSignal.set(data.session);
      this.userSignal.set(data.session.user ?? null);
      this.emailConfirmationPendingSignal.set(false);
      void this.supabase.syncAuthProfileFromUser(data.session.user);
      confirmed = true;
    }

    if (window.location.hash.includes('access_token') || window.location.hash.includes('type=')) {
      window.history.replaceState({}, '', stripAuthParamsFromUrl(href));
    }

    if (confirmed) {
      await this.router.navigateByUrl('/cabinet');
    }
  }

  private authRedirectUrl(): string | undefined {
    if (!isPlatformBrowser(this.platformId)) {
      return undefined;
    }
    return buildAuthRedirectUrl(window.location.origin);
  }

  private isRecoveryUrlHash(hash: string): boolean {
    const normalized = hash.replace(/^#/, '').toLowerCase();
    return normalized.includes('type=recovery');
  }

  /** Ограничиваем размер metadata — длинные строки иногда ломают триггер в БД. */
  private buildSignUpMetadata(metadata: AuthSignUpMetadata): Record<string, string | null> {
    const clip = (value: string | null | undefined, max: number): string | null => {
      const text = value?.trim();
      if (!text) {
        return null;
      }
      return text.length > max ? text.slice(0, max) : text;
    };

    return {
      full_name: clip(metadata.full_name, 120) ?? 'Профиль',
      first_name: clip(metadata.first_name, 64),
      last_name: clip(metadata.last_name, 64),
      phone: clip(metadata.phone, 32),
      city: clip(metadata.city, 64),
      specialty: clip(metadata.specialty, 64),
      description: clip(metadata.description, 500),
      account_type: clip(metadata.account_type ?? null, 32),
      pro_role: clip(metadata.pro_role, 32),
      call_out_fee: clip(metadata.call_out_fee, 32),
      whatsapp: clip(metadata.whatsapp, 64),
      telegram: clip(metadata.telegram, 64),
      instagram: clip(metadata.instagram, 128),
      facebook: clip(metadata.facebook, 128),
    };
  }
}
