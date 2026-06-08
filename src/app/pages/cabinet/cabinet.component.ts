import { Component, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PerformerType, SUBSCRIPTION_PLANS } from '../../core/models/portfolio.models';
import { AddWorkResult, PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';

/** Ключи специализаций для i18n: cabinet.specialties.* */
export const SPECIALTY_OPTION_KEYS = [
  'tiler',
  'electrician',
  'plumber',
  'painter',
  'drywall',
  'turnkey',
] as const;

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BeforeAfterComponent],
  templateUrl: './cabinet.component.html',
  styleUrls: ['./cabinet.component.css'],
})
export class CabinetComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly store = inject(PortfolioStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly plans = SUBSCRIPTION_PLANS;
  protected readonly defaultPlan: PerformerType = 'worker';
  protected readonly showPlanSelector = false;

  protected readonly uploadSuccess = signal(false);
  protected readonly lastUploadResult = signal<AddWorkResult | null>(null);
  protected readonly copyFeedback = signal<string | null>(null);
  protected readonly selectedPlan = signal<PerformerType>('worker');
  protected readonly specialtyOptions = SPECIALTY_OPTION_KEYS;
  protected readonly specialtyMenuOpen = signal(false);
  protected readonly specialtyMenuTop = signal(0);
  protected readonly specialtyMenuLeft = signal(0);
  protected readonly specialtyMenuWidth = signal(0);

  protected readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    specialty: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
  });

  protected readonly workForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
    clientContact: [''],
  });

  protected beforePreview = signal<string | null>(null);
  protected afterPreview = signal<string | null>(null);
  protected beforeDragging = signal(false);
  protected afterDragging = signal(false);

  private readonly beforeInput = viewChild<ElementRef<HTMLInputElement>>('beforeInput');
  private readonly afterInput = viewChild<ElementRef<HTMLInputElement>>('afterInput');

  selectPlan(type: PerformerType) {
    this.selectedPlan.set(type);
  }

  register() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const v = this.registerForm.getRawValue();
    this.store.registerPerformer({ ...v, type: this.selectedPlan() });
  }

  subscribe() {
    const performer = this.store.currentPerformer();
    if (!performer) {
      return;
    }
    this.store.activateSubscription(performer.id);
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
    if (!performer || performer.type === 'worker' || !performer.subscribed) {
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
    const result = this.store.addWork(performer.id, {
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
    this.selectedPlan.set('worker');
    this.specialtyMenuOpen.set(false);
    this.registerForm.reset();
    this.beforePreview.set(null);
    this.afterPreview.set(null);
    this.resetFileInputs();
  }

  planPrice(type: PerformerType): number {
    return this.plans[type].priceUsd;
  }

  registerFieldInvalid(field: 'name' | 'specialty' | 'description'): boolean {
    const control = this.registerForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  specialtyDisplay(): string {
    return this.catalogL10n.localizeSpecialtyField(
      this.registerForm.get('specialty')?.value?.trim() ?? '',
    );
  }

  planFeatures(type: PerformerType): string[] {
    const translated = this.translation.tArray(`cabinet.plans.${type}.features`);
    return translated.length > 0 ? translated : this.plans[type].features;
  }

  planTitle(type: PerformerType): string {
    const title = this.translation.t(`cabinet.plans.${type}.title`);
    return title !== `cabinet.plans.${type}.title` ? title : this.plans[type].title;
  }

  planDescription(type: PerformerType): string {
    const desc = this.translation.t(`cabinet.plans.${type}.description`);
    return desc !== `cabinet.plans.${type}.description` ? desc : this.plans[type].description;
  }

  specialtyOptionLabel(key: string): string {
    return this.catalogL10n.specialtyLabel(key);
  }

  subscribePayLabel(price: number): string {
    return this.translation.t('cabinet.subscribePay').replace('{{price}}', String(price));
  }

  myWorksLabel(count: number): string {
    return this.translation.t('cabinet.myWorksCount').replace('{{count}}', String(count));
  }

  toggleSpecialtyMenu(event: Event) {
    event.stopPropagation();
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

  planIcon(type: PerformerType): string {
    return type === 'brigade' ? '👷' : '🔧';
  }
}
