import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountType } from '../../core/models/portfolio.models';
import { ProfileType } from '../../core/models/profile.models';
import { AddWorkResult, PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import { MAX_TEXT_WORDS, countWords, maxWordsValidator } from '../../core/utils/word-limit.util';

/** Ключи специализаций для i18n: cabinet.specialties.* */
export const SPECIALTY_OPTION_KEYS = [
  'tiler',
  'electrician',
  'plumber',
  'painter',
  'drywall',
  'turnkey',
  'renovation_turnkey',
  'furnitureAssembly',
  'kitchenInstall',
  'cabinetMaking',
  'commercialInstall',
] as const;

export const ACCOUNT_TYPES: AccountType[] = ['worker', 'brigade', 'furniture'];

/** Фиксированная специализация для типа «Бригадир». */
export const BRIGADE_SPECIALTY_KEY = 'renovation_turnkey';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BeforeAfterComponent, SocialLinksComponent],
  templateUrl: './cabinet.component.html',
  styleUrls: ['./cabinet.component.css'],
})
export class CabinetComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

  protected readonly uploadSuccess = signal(false);
  protected readonly socialSaveSuccess = signal(false);
  protected readonly lastUploadResult = signal<AddWorkResult | null>(null);
  protected readonly copyFeedback = signal<string | null>(null);
  protected readonly hasSocialLinks = hasSocialLinks;
  protected readonly maxTextWords = MAX_TEXT_WORDS;
  protected readonly countWords = countWords;
  protected readonly accountTypes = ACCOUNT_TYPES;
  protected readonly selectedAccountType = signal<AccountType>('worker');
  protected readonly specialtyOptions = SPECIALTY_OPTION_KEYS;
  protected readonly brigadeSpecialtyKey = BRIGADE_SPECIALTY_KEY;
  protected readonly specialtyMenuOpen = signal(false);
  protected readonly specialtyMenuTop = signal(0);
  protected readonly specialtyMenuLeft = signal(0);
  protected readonly specialtyMenuWidth = signal(0);
  protected readonly registerSubmitting = signal(false);
  protected readonly registerStatus = signal<'idle' | 'success' | 'error'>('idle');
  protected readonly registerErrorMessage = signal<string | null>(null);

  protected readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    specialty: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10), maxWordsValidator()]],
    phone: [''],
    whatsapp: [''],
    telegram: [''],
    instagram: [''],
    facebook: [''],
  });

  protected readonly socialForm = this.fb.nonNullable.group({
    phone: [''],
    whatsapp: [''],
    telegram: [''],
    instagram: [''],
    facebook: [''],
  });

  protected readonly workForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: ['', [maxWordsValidator()]],
    clientContact: [''],
  });

  protected beforePreview = signal<string | null>(null);
  protected afterPreview = signal<string | null>(null);
  protected beforeDragging = signal(false);
  protected afterDragging = signal(false);

  private readonly beforeInput = viewChild<ElementRef<HTMLInputElement>>('beforeInput');
  private readonly afterInput = viewChild<ElementRef<HTMLInputElement>>('afterInput');

  constructor() {
    effect(() => {
      const performer = this.store.currentPerformer();
      const company = this.furnitureStore.currentCompany();
      const socialLinks = performer?.socialLinks ?? company?.socialLinks;
      if (!socialLinks && !performer && !company) {
        return;
      }

      this.socialForm.patchValue({
        phone: socialLinks?.phone ?? '',
        whatsapp: socialLinks?.whatsapp ?? '',
        telegram: socialLinks?.telegram ?? '',
        instagram: socialLinks?.instagram ?? '',
        facebook: socialLinks?.facebook ?? '',
      });
    });
  }

  isLoggedIn(): boolean {
    return !!this.store.currentPerformer() || !!this.furnitureStore.currentCompany();
  }

  selectAccountType(type: AccountType) {
    this.selectedAccountType.set(type);
    this.applySpecialtyForAccountType(type);
  }

  isSpecialtyLocked(): boolean {
    return this.selectedAccountType() === 'brigade';
  }

  private applySpecialtyForAccountType(type: AccountType) {
    this.closeSpecialtyMenu();
    const control = this.registerForm.get('specialty');
    if (!control) {
      return;
    }

    if (type === 'brigade') {
      control.setValue(BRIGADE_SPECIALTY_KEY);
      control.markAsDirty();
      return;
    }

    if (control.value === BRIGADE_SPECIALTY_KEY) {
      control.setValue('');
      control.markAsUntouched();
    }
  }

  async register() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const v = this.registerForm.getRawValue();
    const accountType = this.selectedAccountType();
    const profileType: ProfileType =
      accountType === 'furniture' ? 'furniture' : accountType === 'brigade' ? 'brigade' : 'worker';

    this.registerSubmitting.set(true);
    this.registerStatus.set('idle');
    this.registerErrorMessage.set(null);

    try {
      const result = await firstValueFrom(
        this.supabase.insertProfile({
          type: profileType,
          name: v.name,
          specialty: v.specialty,
          description: v.description,
          phone: v.phone,
          whatsapp: v.whatsapp,
          telegram: v.telegram,
          instagram: v.instagram,
          facebook: v.facebook,
        }),
      );

      if (result.error || !result.data) {
        this.registerStatus.set('error');
        this.registerErrorMessage.set(result.error ?? this.translation.t('cabinet.registerError'));
        alert(this.registerErrorMessage() ?? this.translation.t('cabinet.registerError'));
        return;
      }

      this.registerStatus.set('success');
      alert(this.translation.t('cabinet.registerSuccess'));
      this.registerForm.reset();
      this.applySpecialtyForAccountType(this.selectedAccountType());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : this.translation.t('cabinet.registerError');
      this.registerStatus.set('error');
      this.registerErrorMessage.set(message);
      alert(message);
    } finally {
      this.registerSubmitting.set(false);
    }
  }

  saveSocialLinks() {
    const v = this.socialForm.getRawValue();
    const performer = this.store.currentPerformer();
    if (performer) {
      this.store.updateSocialLinks(performer.id, v);
    } else {
      const company = this.furnitureStore.currentCompany();
      if (!company) {
        return;
      }
      this.furnitureStore.updateSocialLinks(company.id, v);
    }
    this.socialSaveSuccess.set(true);
    setTimeout(() => this.socialSaveSuccess.set(false), 4000);
  }

  onFileSelected(side: 'before' | 'after', event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.loadWorkImage(side, file, input);
  }

  onDropzoneDragOver(side: 'before' | 'after', event: DragEvent) {
    event.preventDefault();
    if (side === 'before') {
      this.beforeDragging.set(true);
    } else {
      this.afterDragging.set(true);
    }
  }

  onDropzoneDragLeave(side: 'before' | 'after') {
    if (side === 'before') {
      this.beforeDragging.set(false);
    } else {
      this.afterDragging.set(false);
    }
  }

  onDropzoneDrop(side: 'before' | 'after', event: DragEvent) {
    event.preventDefault();
    this.onDropzoneDragLeave(side);
    const file = event.dataTransfer?.files?.[0];
    if (!file) {
      return;
    }
    const input =
      side === 'before' ? this.beforeInput()?.nativeElement : this.afterInput()?.nativeElement;
    this.loadWorkImage(side, file, input);
  }

  private loadWorkImage(side: 'before' | 'after', file: File, input?: HTMLInputElement) {
    if (!file.type.startsWith('image/')) {
      alert(this.translation.t('cabinet.alertImageOnly'));
      if (input) {
        input.value = '';
      }
      return;
    }

    if (file.size > 800_000) {
      alert(this.translation.t('cabinet.alertFileTooLarge'));
      if (input) {
        input.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (side === 'before') {
        this.beforePreview.set(dataUrl);
      } else {
        this.afterPreview.set(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  private resetFileInputs() {
    const before = this.beforeInput()?.nativeElement;
    const after = this.afterInput()?.nativeElement;
    if (before) {
      before.value = '';
    }
    if (after) {
      after.value = '';
    }
  }

  uploadWork() {
    const performer = this.store.currentPerformer();
    const company = this.furnitureStore.currentCompany();
    if (!performer && !company) {
      return;
    }

    if (this.workForm.invalid) {
      this.workForm.markAllAsTouched();
      return;
    }

    const before = this.beforePreview();
    const after = this.afterPreview();
    if (!before || !after) {
      alert(this.translation.t('cabinet.alertBothPhotos'));
      return;
    }

    const v = this.workForm.getRawValue();

    if (company) {
      const work = this.furnitureStore.addWork(company.id, {
        title: v.title,
        description: v.description,
        beforeImage: before,
        afterImage: after,
      });
      if (work) {
        this.uploadSuccess.set(true);
        this.lastUploadResult.set(null);
        this.workForm.reset();
        this.beforePreview.set(null);
        this.afterPreview.set(null);
        this.resetFileInputs();
        setTimeout(() => this.uploadSuccess.set(false), 6000);
      }
      return;
    }

    const result = this.store.addWork(performer!.id, {
      title: v.title,
      description: v.description,
      beforeImage: before,
      afterImage: after,
      clientContact: v.clientContact,
    });

    if (result) {
      this.uploadSuccess.set(true);
      this.lastUploadResult.set(result);
      this.workForm.reset();
      this.beforePreview.set(null);
      this.afterPreview.set(null);
      this.resetFileInputs();
      setTimeout(() => this.uploadSuccess.set(false), 6000);
    }
  }

  verificationLink(work: {
    verificationToken?: string;
    verificationStatus?: string;
  }): string | null {
    return this.store.verificationLinkForWork(
      work as import('../../core/models/portfolio.models').WorkProject,
    );
  }

  async copyVerificationLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      this.copyFeedback.set(this.translation.t('cabinet.copyOk'));
    } catch {
      this.copyFeedback.set(this.translation.t('cabinet.copyFail'));
    }
    setTimeout(() => this.copyFeedback.set(null), 2500);
  }

  signOut() {
    this.store.signOut();
    this.furnitureStore.signOut();
    this.selectedAccountType.set('worker');
    this.specialtyMenuOpen.set(false);
    this.registerForm.reset();
    this.beforePreview.set(null);
    this.afterPreview.set(null);
    this.resetFileInputs();
  }

  registerFieldInvalid(field: 'name' | 'specialty' | 'description'): boolean {
    const control = this.registerForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  workFieldInvalid(field: 'description'): boolean {
    const control = this.workForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  hasMaxWordsError(form: 'register' | 'work'): boolean {
    const control =
      form === 'register'
        ? this.registerForm.get('description')
        : this.workForm.get('description');
    return !!control?.errors?.['maxWords'];
  }

  wordCountLabel(value: string): string {
    return this.translation
      .t('textLimits.wordCount')
      .replace('{{count}}', String(countWords(value)))
      .replace('{{max}}', String(MAX_TEXT_WORDS));
  }

  maxWordsError(form: 'register' | 'work'): string {
    const control =
      form === 'register'
        ? this.registerForm.get('description')
        : this.workForm.get('description');
    const error = control?.errors?.['maxWords'] as { max: number; actual: number } | undefined;
    if (!error) {
      return '';
    }
    return this.translation
      .t('textLimits.maxWordsError')
      .replace('{{max}}', String(error.max))
      .replace('{{count}}', String(error.actual));
  }

  specialtyDisplay(): string {
    return this.catalogL10n.localizeSpecialtyField(
      this.registerForm.get('specialty')?.value?.trim() ?? '',
    );
  }

  accountTypeLabel(type: AccountType): string {
    switch (type) {
      case 'brigade':
        return this.translation.t('cabinet.badgeBrigadier');
      case 'furniture':
        return this.translation.t('cabinet.accountFurniture');
      default:
        return this.translation.t('cabinet.badgeMaster');
    }
  }

  furnitureSpecialtyDisplay(specialty: string): string {
    return this.catalogL10n.localizeSpecialtyField(specialty);
  }

  specialtyOptionLabel(key: string): string {
    return this.catalogL10n.specialtyLabel(key);
  }

  myWorksLabel(count: number): string {
    return this.translation.t('cabinet.myWorksCount').replace('{{count}}', String(count));
  }

  toggleSpecialtyMenu(event: Event) {
    event.stopPropagation();
    if (this.isSpecialtyLocked()) {
      return;
    }
    if (this.specialtyMenuOpen()) {
      this.closeSpecialtyMenu();
      return;
    }

    const trigger = event.currentTarget as HTMLElement;
    const rect = trigger.getBoundingClientRect();
    this.specialtyMenuTop.set(rect.bottom + 6);
    this.specialtyMenuLeft.set(rect.left);
    this.specialtyMenuWidth.set(rect.width);
    this.specialtyMenuOpen.set(true);
  }

  closeSpecialtyMenu() {
    if (!this.specialtyMenuOpen()) {
      return;
    }
    this.specialtyMenuOpen.set(false);
    this.registerForm.get('specialty')?.markAsTouched();
  }

  isSpecialtySelected(option: string): boolean {
    const value = this.registerForm.get('specialty')?.value ?? '';
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .includes(option);
  }

  toggleSpecialtyOption(option: string, event: Event) {
    event.stopPropagation();
    if (this.isSpecialtyLocked()) {
      return;
    }
    const control = this.registerForm.get('specialty');
    if (!control) {
      return;
    }

    const selected = control.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];

    control.setValue(next.join(', '));
    control.markAsDirty();
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.closeSpecialtyMenu();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange() {
    this.closeSpecialtyMenu();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.specialtyMenuOpen()) {
      this.closeSpecialtyMenu();
    }
  }
}
