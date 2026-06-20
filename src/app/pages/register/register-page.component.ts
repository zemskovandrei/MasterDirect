import {
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { merge, of, firstValueFrom } from 'rxjs';
import { RegisterPageUiService } from './register-page-ui.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { CabinetSessionService } from '../../core/services/cabinet-session.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { TranslationService } from '../../core/services/translation.service';
import type { PerformerType, WorkProject } from '../../core/models/portfolio.models';
import type { MasterAccountType } from '../../core/models/master.model';
import {
  CITY_IDS,
  SPECIALTY_KEYS,
  defaultSpecialtyForRole,
  mapProRoleToAccountType,
  type CityId,
  type ProRole,
  type SpecialtyKey,
} from './register-page.model';
import { evaluatePasswordStrength } from './password-strength.util';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { beforeAfterWork } from '../../core/utils/before-after.util';
import { APP_BRAND_NAME } from '../../core/constants/brand';
import {
  authErrorMessageKey,
  isAuthEmailRateLimitError,
  isDuplicateSignupUser,
  registerErrorMessageKey,
  type RegisterErrorMessageKey,
} from '../../core/utils/auth-error.util';
import { buildFurnitureSlug } from '../../core/utils/furniture-id.util';
import { wipeCatalogStorage } from '../../core/utils/catalog-wipe.util';

/** Roles shown on the registration form. */
export const REGISTRATION_ROLES: ProRole[] = ['builder', 'master', 'furniture_maker'];

/** SQL для Supabase — убирает signup 500 (триггер на auth.users). */
export const SIGNUP_FIX_SQL = `do $$
declare trigger_row record;
begin
  for trigger_row in
    select t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_row.trigger_name);
  end loop;
end $$;`;

type RegisterFormControls = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  proRole: ProRole;
  specialty: SpecialtyKey;
  city: CityId;
  telegram: string;
  whatsapp: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  password: string;
  confirmPassword: string;
  workTitle: string;
  acceptTerms: boolean;
};

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BeforeAfterComponent],
  templateUrl: './register-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cabinetSession = inject(CabinetSessionService);
  private readonly supabase = inject(SupabaseService);
  private readonly store = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);
  private readonly registerUi = inject(RegisterPageUiService);
  protected readonly translation = inject(TranslationService);

  protected readonly brandName = APP_BRAND_NAME;
  protected readonly registrationRoles = REGISTRATION_ROLES;
  protected readonly signupFixSql = SIGNUP_FIX_SQL;
  protected readonly cities = CITY_IDS;
  protected readonly specialties = SPECIALTY_KEYS;

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly status = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly successMessageKey = signal<
    'cabinet.registerSuccess' | 'cabinet.registerSuccessEmailConfirmation'
  >('cabinet.registerSuccess');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly errorMessageKey = signal<RegisterErrorMessageKey | null>(null);
  protected readonly signInSubmitting = signal(false);
  protected readonly signInError = signal<string | null>(null);
  protected readonly signInErrorKey = signal<string | null>(null);
  protected readonly resendEmailSubmitting = signal(false);
  protected readonly resendEmailMessage = signal<string | null>(null);
  protected readonly forgotPasswordSubmitting = signal(false);
  protected readonly forgotPasswordMessage = signal<string | null>(null);
  protected readonly forgotPasswordError = signal<string | null>(null);
  protected readonly resetPasswordSubmitting = signal(false);
  protected readonly resetPasswordError = signal<string | null>(null);
  protected readonly profilePreview = signal<string | null>(null);
  protected readonly profileFile = signal<File | null>(null);
  protected readonly dragProfile = signal(false);
  protected readonly beforePreview = signal<string | null>(null);
  protected readonly afterPreview = signal<string | null>(null);
  protected readonly beforeDragging = signal(false);
  protected readonly afterDragging = signal(false);

  private readonly beforeInput = viewChild<ElementRef<HTMLInputElement>>('beforeInput');
  private readonly afterInput = viewChild<ElementRef<HTMLInputElement>>('afterInput');

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.minLength(6)]],
      email: ['', [Validators.required, Validators.email]],
      proRole: ['master' as ProRole, Validators.required],
      specialty: ['electrician' as SpecialtyKey, Validators.required],
      city: ['batumi' as CityId, Validators.required],
      telegram: [''],
      whatsapp: [''],
      instagram: [''],
      facebook: [''],
      tiktok: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      workTitle: [''],
      acceptTerms: [false, Validators.requiredTrue],
    },
    { validators: (group) => this.passwordMatchValidator(group) },
  );

  private readonly proRole = toSignal(
    merge(of(this.form.controls.proRole.value), this.form.controls.proRole.valueChanges),
    { initialValue: this.form.controls.proRole.value },
  );

  private readonly routeFragment = toSignal(this.route.fragment, { initialValue: null });

  protected readonly authMode = computed<
    'login' | 'register' | 'forgot-password' | 'reset-password'
  >(() => {
    if (this.auth.passwordRecovery()) {
      return 'reset-password';
    }
    const fragment = this.routeFragment();
    if (fragment === 'register') {
      return 'register';
    }
    if (fragment === 'forgot-password') {
      return 'forgot-password';
    }
    return 'login';
  });

  readonly selectedProRole = this.proRole;

  protected readonly registerPreviewWork = computed(() => {
    const before = this.beforePreview();
    const after = this.afterPreview();
    if (!before || !after) {
      return null;
    }
    const title =
      this.form.controls.workTitle.value.trim() ||
      this.specialtyLabel(this.form.controls.specialty.value);
    return beforeAfterWork('register-preview', before, after, title);
  });

  constructor() {
    this.registerUi.selectedProRole.set(this.form.controls.proRole.value);
  }

  protected readonly deleteAccountSubmitting = signal(false);
  protected readonly deleteAccountError = signal<string | null>(null);
  protected readonly deleteAccountSuccess = signal<string | null>(null);
  protected readonly showDeleteAccountPanel = signal(false);

  protected readonly deleteAccountForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly signInForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly forgotPasswordForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly resetPasswordForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: (group) => this.passwordMatchValidator(group) },
  );

  private readonly resetPasswordValue = toSignal(
    this.resetPasswordForm.controls.password.valueChanges,
    {
      initialValue: '',
    },
  );

  protected readonly resetPasswordStrength = computed(() =>
    evaluatePasswordStrength(this.resetPasswordValue() ?? ''),
  );

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly passwordStrength = computed(() =>
    evaluatePasswordStrength(this.passwordValue() ?? ''),
  );

  protected cityLabel(city: CityId): string {
    const labels: Record<CityId, string> = {
      batumi: 'Батуми',
      tbilisi: 'Тбилиси',
    };
    return labels[city];
  }

  protected specialtyLabel(key: SpecialtyKey): string {
    return this.translation.t(`cabinet.specialties.${key}`);
  }

  protected specialtyDescription(key: SpecialtyKey): string {
    const value = this.translation.t(`cabinet.specialtyDescriptions.${key}`);
    return value !== `cabinet.specialtyDescriptions.${key}` ? value : '';
  }

  protected proRoleDescription(role: ProRole): string {
    const value = this.translation.t(`cabinet.proRoleDescriptions.${role}`);
    return value !== `cabinet.proRoleDescriptions.${role}` ? value : '';
  }

  protected fieldInvalid(field: keyof RegisterFormControls): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  protected passwordMismatch(): boolean {
    return (
      !!this.form.errors?.['passwordMismatch'] &&
      (this.form.get('confirmPassword')?.touched ?? false)
    );
  }

  protected onRoleChange(): void {
    const role = this.form.controls.proRole.value;
    this.registerUi.selectedProRole.set(role);
    this.form.controls.specialty.setValue(defaultSpecialtyForRole(role));
  }

  protected togglePassword(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword.update((v) => !v);
      return;
    }
    this.showConfirmPassword.update((v) => !v);
  }

  protected openLogin(): void {
    this.signInError.set(null);
    this.forgotPasswordMessage.set(null);
    this.forgotPasswordError.set(null);
    this.auth.clearPasswordRecovery();
    void this.router.navigate([], { fragment: 'login', replaceUrl: true });
  }

  protected openRegister(): void {
    this.signInError.set(null);
    this.forgotPasswordMessage.set(null);
    this.forgotPasswordError.set(null);
    void this.router.navigate([], { fragment: 'register', replaceUrl: true });
  }

  protected openForgotPassword(): void {
    const email = this.signInForm.controls.email.value.trim();
    if (email) {
      this.forgotPasswordForm.controls.email.setValue(email);
    }
    this.signInError.set(null);
    this.forgotPasswordMessage.set(null);
    this.forgotPasswordError.set(null);
    void this.router.navigate([], { fragment: 'forgot-password', replaceUrl: true });
  }

  protected forgotPasswordFieldInvalid(field: 'email'): boolean {
    const control = this.forgotPasswordForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  protected resetPasswordFieldInvalid(field: 'password' | 'confirmPassword'): boolean {
    const control = this.resetPasswordForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  protected resetPasswordMismatch(): boolean {
    return (
      !!this.resetPasswordForm.errors?.['passwordMismatch'] &&
      (this.resetPasswordForm.get('confirmPassword')?.touched ?? false)
    );
  }

  async requestPasswordReset(): Promise<void> {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    const { email } = this.forgotPasswordForm.getRawValue();
    this.forgotPasswordSubmitting.set(true);
    this.forgotPasswordMessage.set(null);
    this.forgotPasswordError.set(null);

    try {
      const { error } = await this.auth.resetPasswordForEmail(email);
      if (error) {
        const key = authErrorMessageKey(error);
        this.forgotPasswordError.set(this.translation.t(key));
        return;
      }
      this.forgotPasswordMessage.set(this.translation.t('cabinet.forgotPasswordSuccess'));
    } catch {
      this.forgotPasswordError.set(this.translation.t('cabinet.forgotPasswordError'));
    } finally {
      this.forgotPasswordSubmitting.set(false);
    }
  }

  async submitNewPassword(): Promise<void> {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    const { password } = this.resetPasswordForm.getRawValue();
    this.resetPasswordSubmitting.set(true);
    this.resetPasswordError.set(null);

    try {
      const { error } = await this.auth.updatePassword(password);
      if (error) {
        const key = authErrorMessageKey(error);
        this.resetPasswordError.set(this.translation.t(key));
        return;
      }

      this.resetPasswordForm.reset();
      await firstValueFrom(this.supabase.loadProfiles());
      const restored = await this.cabinetSession.restoreForCurrentUser();
      if (restored) {
        void this.router.navigate(['/cabinet'], { replaceUrl: true });
        return;
      }

      this.forgotPasswordMessage.set(this.translation.t('cabinet.resetPasswordSuccess'));
      this.openLogin();
    } catch {
      this.resetPasswordError.set(this.translation.t('cabinet.resetPasswordError'));
    } finally {
      this.resetPasswordSubmitting.set(false);
    }
  }

  protected signInFieldInvalid(field: 'email' | 'password'): boolean {
    const control = this.signInForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  protected onProfileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.setProfileFile(file);
    }
  }

  protected onProfileDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragProfile.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.setProfileFile(file);
    }
  }

  protected onBeforeAfterSelected(side: 'before' | 'after', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.loadBeforeAfterImage(side, file, input);
  }

  protected onBeforeAfterDragOver(side: 'before' | 'after', event: DragEvent): void {
    event.preventDefault();
    if (side === 'before') {
      this.beforeDragging.set(true);
    } else {
      this.afterDragging.set(true);
    }
  }

  protected onBeforeAfterDragLeave(side: 'before' | 'after'): void {
    if (side === 'before') {
      this.beforeDragging.set(false);
    } else {
      this.afterDragging.set(false);
    }
  }

  protected onBeforeAfterDrop(side: 'before' | 'after', event: DragEvent): void {
    event.preventDefault();
    this.onBeforeAfterDragLeave(side);
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    const input =
      side === 'before' ? this.beforeInput()?.nativeElement : this.afterInput()?.nativeElement;
    this.loadBeforeAfterImage(side, file, input);
  }

  protected preventDragDefaults(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const beforeAfterError = this.beforeAfterPairError();
    if (beforeAfterError) {
      this.status.set('error');
      this.errorMessage.set(beforeAfterError);
      return;
    }

    const v = this.form.getRawValue();
    const proRole = v.proRole;
    const accountType = mapProRoleToAccountType(proRole);
    const displayName = `${v.firstName.trim()} ${v.lastName.trim()}`;
    const roleLabel = this.translation.t(`cabinet.proRoles.${proRole}`);
    const specialtyLabel = this.specialtyLabel(v.specialty);
    const specialtyDesc = this.specialtyDescription(v.specialty);
    const description =
      specialtyDesc ||
      `${roleLabel}. ${specialtyLabel}. ${displayName}. ${this.translation.t('cabinet.defaultDescriptionSuffix')}`;

    const socialLinks = {
      phone: v.phone.trim(),
      whatsapp: v.whatsapp.trim() || undefined,
      telegram: v.telegram.trim() || undefined,
      instagram: v.instagram.trim() || undefined,
      facebook: v.facebook.trim() || undefined,
    };

    this.submitting.set(true);
    this.status.set('idle');
    this.errorMessage.set(null);
    this.errorMessageKey.set(null);

    const profileType =
      accountType === 'furniture'
        ? 'furniture'
        : accountType === 'brigade'
          ? 'brigade'
          : 'worker';

    try {
      const authResult = await this.auth.register(
        v.email,
        v.password,
        {
          full_name: displayName,
          first_name: v.firstName.trim(),
          last_name: v.lastName.trim(),
          phone: v.phone.trim(),
          city: v.city,
          specialty: v.specialty,
          description,
          pro_role: proRole,
          account_type:
            accountType === 'furniture'
              ? 'furniture'
              : accountType
                ? (accountType as MasterAccountType)
                : undefined,
          whatsapp: socialLinks.whatsapp,
          telegram: socialLinks.telegram,
          instagram: socialLinks.instagram,
          facebook: socialLinks.facebook,
        },
        {
          accountType: profileType,
          fullName: displayName,
          firstName: v.firstName.trim(),
          lastName: v.lastName.trim(),
          phone: v.phone.trim(),
          city: v.city,
          specialty: v.specialty,
          proRole,
          whatsapp: socialLinks.whatsapp,
          telegram: socialLinks.telegram,
          instagram: socialLinks.instagram,
          facebook: socialLinks.facebook,
        },
      );

      if (isDuplicateSignupUser(authResult.user)) {
        await this.auth.signOut();
        this.status.set('error');
        this.errorMessage.set(this.translation.t('cabinet.registerErrorEmailExists'));
        this.errorMessageKey.set('cabinet.registerErrorEmailExists');
        this.openDeleteAccountPanel(this.form.controls.email.value);
        return;
      }

      if (authResult.error || !authResult.user) {
        const key = registerErrorMessageKey(authResult.error, authResult.user);
        await this.auth.signOut();
        this.status.set('error');
        this.errorMessageKey.set(key);
        const detail = authResult.error?.message?.trim();
        const base = this.translation.t(key);
        if (detail) {
          this.errorMessage.set(`${base}\n${detail}`);
        } else {
          this.errorMessage.set(base);
        }
        return;
      }

      if (!authResult.session) {
        this.successMessageKey.set('cabinet.registerSuccessEmailConfirmation');
        this.status.set('success');
        this.resetForm();
        return;
      }

      if (authResult.profileError) {
        await this.auth.signOut();
        this.status.set('error');
        this.errorMessageKey.set('cabinet.registerError');
        this.errorMessage.set(authResult.profileError);
        return;
      }

      if (accountType === 'furniture') {
        const slug = buildFurnitureSlug(displayName);
        this.furnitureStore.registerCompanyWithId(slug, {
          name: displayName,
          specialty: v.specialty,
          description,
          city: v.city,
          socialLinks,
          dbId: authResult.user.id,
          slug,
        });
      } else if (accountType) {
        this.store.registerPerformerWithId(authResult.user.id, {
          type: accountType as PerformerType,
          name: displayName,
          specialty: v.specialty,
          description,
          socialLinks,
        });
      }

      const beforeImage = this.beforePreview();
      const afterImage = this.afterPreview();
      if (beforeImage && afterImage) {
        const workTitle = v.workTitle.trim() || specialtyLabel;
        const ownerId = authResult.user.id;
        const ownerType =
          accountType === 'furniture'
            ? 'furniture'
            : accountType === 'brigade'
              ? 'brigade'
              : 'worker';

        let work: WorkProject | null = null;

        if (accountType === 'furniture') {
          const company = this.furnitureStore.currentCompany();
          if (company) {
            work = this.furnitureStore.addWork(company.id, {
              title: workTitle,
              description: '',
              beforeImage,
              afterImage,
            });
          }
        } else if (accountType) {
          const added = this.store.addWork(authResult.user.id, {
            title: workTitle,
            description: '',
            beforeImage,
            afterImage,
          });
          work = added?.work ?? null;
        }

        if (work) {
          const saveResult = await firstValueFrom(
            this.supabase.savePortfolioWork({ ownerId, ownerType, work }),
          );
          if (saveResult.error) {
            if (accountType === 'furniture') {
              const company = this.furnitureStore.currentCompany();
              if (company) {
                this.furnitureStore.deleteWork(company.id, work.id);
              }
            } else {
              this.store.deleteWork(authResult.user.id, work.id);
            }
            await this.auth.signOut();
            this.status.set('error');
            this.errorMessage.set(saveResult.error);
            return;
          }
        }
      }

      await firstValueFrom(this.supabase.loadProfiles());
      await this.cabinetSession.restoreForCurrentUser();
      this.successMessageKey.set('cabinet.registerSuccess');
      this.resetForm();
      void this.router.navigate(['/cabinet'], { replaceUrl: true });
    } catch (error) {
      this.status.set('error');
      this.errorMessageKey.set('cabinet.registerError');
      this.errorMessage.set(
        error instanceof Error ? error.message : this.translation.t('cabinet.registerError'),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async signInExisting(): Promise<void> {
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.signInForm.getRawValue();
    this.signInSubmitting.set(true);
    this.signInError.set(null);
    this.signInErrorKey.set(null);
    this.resendEmailMessage.set(null);

    try {
      await this.auth.ensureInitialized();
      const result = await this.auth.signIn(email, password);
      if (result.error || !result.user) {
        const key = authErrorMessageKey(result.error);
        this.signInErrorKey.set(key);
        this.signInError.set(this.translation.t(key));
        return;
      }

      await firstValueFrom(this.supabase.loadProfiles());
      const restored = await this.cabinetSession.restoreForCurrentUser();
      if (!restored) {
        this.signInErrorKey.set('cabinet.signInError');
        this.signInError.set(this.translation.t('cabinet.signInError'));
        await this.auth.signOut();
        return;
      }
      this.signInForm.reset();
      void this.router.navigate(['/cabinet'], { replaceUrl: true });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : '';
      const key =
        message.includes('invalid login credentials') ||
        message.includes('invalid email or password')
          ? 'cabinet.signInErrorInvalidCredentials'
          : 'cabinet.signInError';
      this.signInErrorKey.set(key);
      this.signInError.set(this.translation.t(key));
    } finally {
      this.signInSubmitting.set(false);
    }
  }

  async resendConfirmationEmail(): Promise<void> {
    const email = this.signInForm.controls.email.value.trim();
    if (!email) {
      this.resendEmailMessage.set(this.translation.t('cabinet.resendConfirmationNeedEmail'));
      return;
    }

    this.resendEmailSubmitting.set(true);
    this.resendEmailMessage.set(null);

    try {
      const { error } = await this.auth.resendSignUpConfirmation(email);
      if (error) {
        const key = isAuthEmailRateLimitError(error)
          ? 'cabinet.signInErrorRateLimit'
          : 'cabinet.resendConfirmationError';
        this.signInErrorKey.set(key);
        this.resendEmailMessage.set(this.translation.t(key));
        return;
      }
      this.resendEmailMessage.set(this.translation.t('cabinet.resendConfirmationSuccess'));
    } finally {
      this.resendEmailSubmitting.set(false);
    }
  }

  openDeleteAccountPanel(email = ''): void {
    const normalized = email.trim().toLowerCase();
    if (normalized) {
      this.deleteAccountForm.patchValue({ email: normalized });
    }
    this.showDeleteAccountPanel.set(true);
    this.deleteAccountError.set(null);
    this.deleteAccountSuccess.set(null);
  }

  deleteAccountFieldInvalid(field: 'email' | 'password'): boolean {
    const control = this.deleteAccountForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  async deleteAccountAndReset(): Promise<void> {
    this.deleteAccountForm.markAllAsTouched();
    if (this.deleteAccountForm.invalid || this.deleteAccountSubmitting()) {
      return;
    }

    const { email, password } = this.deleteAccountForm.getRawValue();
    this.deleteAccountSubmitting.set(true);
    this.deleteAccountError.set(null);
    this.deleteAccountSuccess.set(null);

    try {
      const result = await this.auth.deleteAccountWithPassword(email, password);
      if (result.errorKey) {
        this.deleteAccountError.set(this.translation.t(result.errorKey));
        return;
      }
      if (result.error) {
        const rpcMissing =
          result.error.includes('delete_current_user') ||
          result.error.includes('Could not find the function');
        this.deleteAccountError.set(
          rpcMissing
            ? this.translation.t('cabinet.deleteAccountRpcMissing')
            : result.error,
        );
        return;
      }

      if (result.userId) {
        this.store.deletePerformer(result.userId);
        this.furnitureStore.removeCompanyIfExists(result.userId);
      }
      wipeCatalogStorage();

      this.resetForm();
      this.signInForm.reset();
      this.deleteAccountForm.reset();
      this.status.set('idle');
      this.errorMessage.set(null);
      this.deleteAccountSuccess.set(this.translation.t('cabinet.deleteAccountSuccess'));
      this.showDeleteAccountPanel.set(false);
    } catch (error) {
      this.deleteAccountError.set(
        error instanceof Error ? error.message : this.translation.t('cabinet.deleteAccountError'),
      );
    } finally {
      this.deleteAccountSubmitting.set(false);
    }
  }

  private resetForm(): void {
    this.form.reset({
      proRole: 'master',
      specialty: 'electrician',
      city: 'batumi',
      acceptTerms: false,
    });
    this.registerUi.selectedProRole.set('master');
    this.profilePreview.set(null);
    this.profileFile.set(null);
    this.beforePreview.set(null);
    this.afterPreview.set(null);
  }

  private beforeAfterPairError(): string | null {
    const before = this.beforePreview();
    const after = this.afterPreview();
    if ((before && !after) || (!before && after)) {
      return this.translation.t('cabinet.alertBothPhotos');
    }
    return null;
  }

  private loadBeforeAfterImage(
    side: 'before' | 'after',
    file: File,
    input?: HTMLInputElement,
  ): void {
    if (!file.type.startsWith('image/')) {
      this.errorMessage.set(this.translation.t('cabinet.alertImageOnly'));
      if (input) {
        input.value = '';
      }
      return;
    }

    if (file.size > 800_000) {
      this.errorMessage.set(this.translation.t('cabinet.alertFileTooLarge'));
      if (input) {
        input.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (side === 'before') {
        this.beforePreview.set(dataUrl);
      } else {
        this.afterPreview.set(dataUrl);
      }
      this.errorMessage.set(null);
    };
    reader.readAsDataURL(file);
  }

  private setProfileFile(file: File): void {
    this.profileFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.profilePreview.set(String(reader.result));
    reader.readAsDataURL(file);
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    if (!password || !confirmPassword) {
      return null;
    }
    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
