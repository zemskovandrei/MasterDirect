import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { TranslationService } from '../../core/services/translation.service';
import type { PerformerType } from '../../core/models/portfolio.models';
import type { MasterAccountType } from '../../core/models/master.model';
import {
  PRO_ROLE_ICONS,
  PRO_ROLES,
  defaultSpecialtyForRole,
  mapProRoleToAccountType,
  type ProRole,
  type SpecialtyKey,
} from './register-page.model';
import { evaluatePasswordStrength } from './password-strength.util';
import { APP_BRAND_NAME } from '../../core/constants/brand';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
  ],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
})
export class RegisterPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly store = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly brandName = APP_BRAND_NAME;

  protected readonly proRoles = PRO_ROLES;
  protected readonly proRoleIcons = PRO_ROLE_ICONS;

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly status = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly signInOpen = signal(false);
  protected readonly signInSubmitting = signal(false);
  protected readonly signInError = signal<string | null>(null);

  protected readonly promoStyle = computed(() => ({
    backgroundImage: `url('assets/images/register-hero.png')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  }));

  protected readonly formSideStyle = computed(() => ({
    backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.78) 0%, rgba(248, 250, 252, 0.72) 100%), url('assets/fon2.jpeg')`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
  }));

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(6)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      proRole: ['' as ProRole | '', Validators.required],
      telegram: [''],
      whatsapp: [''],
      facebook: [''],
      instagram: [''],
      acceptTerms: [false, Validators.requiredTrue],
    },
    { validators: (group) => this.passwordMatchValidator(group) },
  );

  protected readonly signInForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  private readonly passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });

  protected readonly passwordStrength = computed(() =>
    evaluatePasswordStrength(this.passwordValue() ?? ''),
  );

  protected proRoleLabel(role: ProRole): string {
    return this.translation.t(`cabinet.proRoles.${role}`);
  }

  protected fieldInvalid(field: keyof typeof this.form.controls): boolean {
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
    this.form.controls.proRole.markAsTouched();
  }

  protected togglePassword(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword.update((v) => !v);
      return;
    }
    this.showConfirmPassword.update((v) => !v);
  }

  protected toggleSignIn(): void {
    this.signInOpen.update((open) => !open);
    this.signInError.set(null);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const proRole = v.proRole as ProRole;
    const accountType = mapProRoleToAccountType(proRole);
    const displayName = `${v.firstName.trim()} ${v.lastName.trim()}`;
    const roleLabel = this.proRoleLabel(proRole);
    const specialtyKey = defaultSpecialtyForRole(proRole);
    const description = `${roleLabel}. ${displayName}. ${this.translation.t('cabinet.defaultDescriptionSuffix')}`;

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

    try {
      const authResult = await this.auth.signUp(v.email, v.password, {
        full_name: displayName,
        phone: v.phone.trim(),
        city: 'batumi',
        specialty: specialtyKey,
        description,
        account_type:
          accountType && accountType !== 'furniture'
            ? (accountType as MasterAccountType)
            : undefined,
        whatsapp: socialLinks.whatsapp,
        telegram: socialLinks.telegram,
        instagram: socialLinks.instagram,
        facebook: socialLinks.facebook,
      });

      if (authResult.error || !authResult.user) {
        const message = authResult.error?.message ?? this.translation.t('cabinet.registerError');
        this.status.set('error');
        this.errorMessage.set(message);
        return;
      }

      if (accountType === 'furniture') {
        this.furnitureStore.registerCompany({
          name: displayName,
          specialty: specialtyKey,
          description,
          city: 'batumi',
          socialLinks,
        });
      } else if (accountType) {
        this.store.registerPerformerWithId(authResult.user.id, {
          type: accountType as PerformerType,
          name: displayName,
          specialty: specialtyKey,
          description,
          socialLinks,
        });
      }

      await firstValueFrom(this.supabase.loadProfiles());
      this.status.set('success');
      this.form.reset({ acceptTerms: false });
    } catch (error) {
      this.status.set('error');
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

    try {
      const result = await this.auth.signIn(email, password);
      if (result.error || !result.user) {
        this.signInError.set(result.error?.message ?? this.translation.t('cabinet.signInError'));
        return;
      }

      await firstValueFrom(this.supabase.loadProfiles());
      this.signInOpen.set(false);
      this.signInForm.reset();
    } catch (error) {
      this.signInError.set(
        error instanceof Error ? error.message : this.translation.t('cabinet.signInError'),
      );
    } finally {
      this.signInSubmitting.set(false);
    }
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
