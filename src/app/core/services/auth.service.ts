import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { AuthError, Session, User } from '@supabase/supabase-js';
import type { AuthSignUpMetadata } from '../models/master.model';
import { isDuplicateSignupUser } from '../utils/auth-error.util';
import { SupabaseService } from './supabase.service';

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService);

  private readonly userSignal = signal<User | null>(null);
  private readonly sessionSignal = signal<Session | null>(null);
  private readonly readySignal = signal(false);
  private readonly passwordRecoverySignal = signal(false);
  private initPromise: Promise<void> | null = null;

  readonly user = this.userSignal.asReadonly();
  readonly session = this.sessionSignal.asReadonly();
  readonly ready = this.readySignal.asReadonly();
  readonly passwordRecovery = this.passwordRecoverySignal.asReadonly();

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
      return null;
    }

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      this.userSignal.set(null);
      return null;
    }

    this.userSignal.set(data.user);
    return data.user;
  }

  async signUp(
    email: string,
    password: string,
    metadata: AuthSignUpMetadata,
  ): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const signUpResult = await this.signUpRequest(normalizedEmail, password, metadata);
    if (signUpResult.error || signUpResult.session || !signUpResult.user) {
      return signUpResult;
    }

    if (isDuplicateSignupUser(signUpResult.user)) {
      return signUpResult;
    }

    return this.signIn(normalizedEmail, password);
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

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata.full_name,
          phone: metadata.phone ?? null,
          city: metadata.city ?? null,
          specialty: metadata.specialty ?? null,
          description: metadata.description ?? null,
          account_type: metadata.account_type ?? null,
          pro_role: metadata.pro_role ?? null,
          call_out_fee: metadata.call_out_fee ?? null,
          whatsapp: metadata.whatsapp ?? null,
          telegram: metadata.telegram ?? null,
          instagram: metadata.instagram ?? null,
          facebook: metadata.facebook ?? null,
        },
      },
    });

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

  async resetPasswordForEmail(email: string): Promise<{ error: AuthError | null }> {
    const client = await this.supabase.getClient();
    if (!client) {
      return {
        error: { name: 'AuthError', message: 'Supabase is not configured' } as AuthError,
      };
    }

    const redirectTo = isPlatformBrowser(this.platformId)
      ? `${window.location.origin}/cabinet`
      : undefined;

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

  private async bootstrapAuth(): Promise<void> {
    const client = await this.supabase.getClient();
    if (!client) {
      this.readySignal.set(true);
      return;
    }

    const { data } = await client.auth.getSession();
    this.sessionSignal.set(data.session ?? null);
    this.userSignal.set(data.session?.user ?? null);

    client.auth.onAuthStateChange((event, session) => {
      this.sessionSignal.set(session);
      this.userSignal.set(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        this.passwordRecoverySignal.set(true);
      }
    });

    if (isPlatformBrowser(this.platformId) && this.isRecoveryUrlHash(window.location.hash)) {
      this.passwordRecoverySignal.set(true);
    }

    this.readySignal.set(true);
  }

  private isRecoveryUrlHash(hash: string): boolean {
    const normalized = hash.replace(/^#/, '').toLowerCase();
    return normalized.includes('type=recovery');
  }
}
