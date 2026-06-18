import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
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
  CITY_IDS,
  defaultSpecialtyForRole,
  mapProRoleToAccountType,
  type CityId,
  type ProRole,
} from './register-page.model';
import { evaluatePasswordStrength } from './password-strength.util';
import { APP_BRAND_NAME } from '../../core/constants/brand';

/** Tab roles shown in the wizard header. */
export type RegisterAccountTab = 'master' | 'brigade' | 'furniture';

const TAB_TO_ROLE: Record<RegisterAccountTab, ProRole> = {
  master: 'master',
  brigade: 'brigade',
  furniture: 'furniture_maker',
};

const WIZARD_STEPS = [
  { id: 'profile', label: 'Профиль' },
  { id: 'contacts', label: 'Контакты' },
  { id: 'documents', label: 'Документы' },
  { id: 'security', label: 'Безопасность' },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

type RegisterFormControls = {
  firstName: string;
  middleName: string;
  city: CityId;
  proRole: ProRole;
  email: string;
  phone: string;
  whatsapp: string;
  telegram: string;
  facebook: string;
  instagram: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  protected readonly wizardSteps = WIZARD_STEPS;
  protected readonly cities = CITY_IDS;
  protected readonly accountTabs: { id: RegisterAccountTab; label: string }[] = [
    { id: 'master', label: 'Мастер' },
    { id: 'brigade', label: 'Бригадир' },
    { id: 'furniture', label: 'Мебельщик' },
  ];

  protected readonly currentStep = signal(0);
  protected readonly accountTab = signal<RegisterAccountTab>('master');
  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly status = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly signInOpen = signal(false);
  protected readonly signInSubmitting = signal(false);
  protected readonly signInError = signal<string | null>(null);
  protected readonly profilePreview = signal<string | null>(null);
  protected readonly profileFile = signal<File | null>(null);
  protected readonly documentFiles = signal<File[]>([]);
  protected readonly dragProfile = signal(false);
  protected readonly dragDocuments = signal(false);
  protected readonly stepError = signal<string | null>(null);

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

  protected readonly progressPercent = computed(
    () => ((this.currentStep() + 1) / WIZARD_STEPS.length) * 100,
  );

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      middleName: [''],
      city: ['batumi' as CityId, Validators.required],
      proRole: ['master' as ProRole, Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(6)]],
      whatsapp: [''],
      telegram: [''],
      facebook: [''],
      instagram: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
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

  /** Fields validated before moving to the next wizard step. */
  private readonly stepFieldMap: (keyof RegisterFormControls)[][] = [
    ['firstName', 'proRole', 'city'],
    ['email', 'phone'],
    [],
    ['password', 'confirmPassword', 'acceptTerms'],
  ];

  protected cityLabel(city: CityId): string {
    const labels: Record<CityId, string> = {
      batumi: 'Батуми',
      tbilisi: 'Тбилиси',
    };
    return labels[city];
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

  protected selectAccountTab(tab: RegisterAccountTab): void {
    this.accountTab.set(tab);
    this.form.controls.proRole.setValue(TAB_TO_ROLE[tab]);
    this.form.controls.proRole.markAsTouched();
  }

  protected onProRoleSelect(): void {
    const role = this.form.controls.proRole.value;
    const tab = (Object.entries(TAB_TO_ROLE).find(([, r]) => r === role)?.[0] ??
      'master') as RegisterAccountTab;
    this.accountTab.set(tab);
  }

  protected goToStep(index: number): void {
    if (index < 0 || index >= WIZARD_STEPS.length) {
      return;
    }
    if (index > this.currentStep() && !this.validateStep(this.currentStep())) {
      return;
    }
    this.stepError.set(null);
    this.currentStep.set(index);
  }

  protected nextStep(): void {
    if (!this.validateStep(this.currentStep())) {
      return;
    }
    this.stepError.set(null);
    if (this.currentStep() < WIZARD_STEPS.length - 1) {
      this.currentStep.update((s) => s + 1);
    }
  }

  protected prevStep(): void {
    this.stepError.set(null);
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
    }
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

  protected onDocumentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.documentFiles.update((files) => [...files, ...Array.from(input.files!)]);
    }
  }

  protected onDocumentsDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragDocuments.set(false);
    const dropped = event.dataTransfer?.files;
    if (dropped?.length) {
      this.documentFiles.update((files) => [...files, ...Array.from(dropped)]);
    }
  }

  protected removeDocument(index: number): void {
    this.documentFiles.update((files) => files.filter((_, i) => i !== index));
  }

  protected preventDragDefaults(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  async submit(): Promise<void> {
    if (!this.validateStep(WIZARD_STEPS.length - 1)) {
      this.currentStep.set(WIZARD_STEPS.length - 1);
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const proRole = v.proRole;
    const accountType = mapProRoleToAccountType(proRole);
    const displayName = [v.firstName.trim(), v.middleName.trim()].filter(Boolean).join(' ');
    const roleLabel = this.translation.t(`cabinet.proRoles.${proRole}`);
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
        city: v.city,
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
          city: v.city,
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
      this.form.reset({ city: 'batumi', proRole: 'master', acceptTerms: false });
      this.accountTab.set('master');
      this.currentStep.set(0);
      this.profilePreview.set(null);
      this.profileFile.set(null);
      this.documentFiles.set([]);
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

  protected stepId(): WizardStepId {
    return WIZARD_STEPS[this.currentStep()].id;
  }

  private validateStep(stepIndex: number): boolean {
    const fields = this.stepFieldMap[stepIndex] ?? [];
    let valid = true;

    for (const field of fields) {
      const control = this.form.get(field);
      control?.markAsTouched();
      if (control?.invalid) {
        valid = false;
      }
    }

    if (stepIndex === WIZARD_STEPS.length - 1 && this.form.errors?.['passwordMismatch']) {
      this.form.get('confirmPassword')?.markAsTouched();
      valid = false;
    }

    if (!valid) {
      this.stepError.set(this.translation.t('cabinet.registerStepError'));
    }

    return valid;
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
