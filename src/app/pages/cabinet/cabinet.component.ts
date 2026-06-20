import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { RegisterPageComponent } from '../register/register-page.component';
import { RegisterPageUiService } from '../register/register-page-ui.service';
import { AddWorkResult, PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { AuthService } from '../../core/services/auth.service';
import { CabinetSessionService } from '../../core/services/cabinet-session.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { firstValueFrom } from 'rxjs';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import { MAX_TEXT_WORDS, countWords, maxWordsValidator } from '../../core/utils/word-limit.util';
import { APP_BRAND_NAME } from '../../core/constants/brand';
import { WORK_VERIFICATION_ENABLED } from '../../core/constants/features';
import { type CabinetTabBackgroundKey } from '../../core/constants/catalog-tab-backgrounds';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    RegisterPageComponent,
    BeforeAfterComponent,
    SocialLinksComponent,
  ],
  templateUrl: './cabinet.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: [
    '../../styles/catalog-pages.css',
    '../../styles/cabinet-backgrounds.scss',
    '../register/register-page.component.scss',
    './cabinet.component.css',
  ],
})
export class CabinetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly registerUi = inject(RegisterPageUiService);
  protected readonly store = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly auth = inject(AuthService);
  protected readonly cabinetSession = inject(CabinetSessionService);
  private readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

  protected readonly brandName = APP_BRAND_NAME;
  protected readonly workVerificationEnabled = WORK_VERIFICATION_ENABLED;
  protected readonly uploadSuccess = signal(false);
  protected readonly socialSaveSuccess = signal(false);
  protected readonly lastUploadResult = signal<AddWorkResult | null>(null);
  protected readonly copyFeedback = signal<string | null>(null);
  protected readonly hasSocialLinks = hasSocialLinks;
  protected readonly maxTextWords = MAX_TEXT_WORDS;
  protected readonly countWords = countWords;

  protected readonly hasCabinetSession = computed(
    () => !!this.store.currentPerformer() || !!this.furnitureStore.currentCompany(),
  );

  protected readonly isLoggedIn = computed(() => this.hasCabinetSession() || !!this.auth.user());

  private readonly routeFragment = toSignal(this.route.fragment, { initialValue: null });

  protected readonly authPageMode = computed<
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

  protected readonly authShellMode = computed<'login' | 'register'>(() =>
    this.authPageMode() === 'register' ? 'register' : 'login',
  );

  protected readonly registerBgRole = computed<'master' | 'brigade' | 'furniture' | null>(() => {
    if (this.hasCabinetSession() || this.authShellMode() !== 'register') {
      return null;
    }
    const role = this.registerUi.selectedProRole();
    if (role === 'builder') {
      return 'brigade';
    }
    if (role === 'furniture_maker') {
      return 'furniture';
    }
    return 'master';
  });

  protected readonly cabinetRole = computed<'worker' | 'brigade' | 'furniture'>(() => {
    const key = this.cabinetBackgroundKey();
    if (key === 'cabinetBrigade') {
      return 'brigade';
    }
    if (key === 'cabinetFurniture') {
      return 'furniture';
    }
    return 'worker';
  });

  protected readonly cabinetDisplayName = computed(() => {
    const performer = this.store.currentPerformer();
    if (performer?.name?.trim()) {
      return performer.name.trim();
    }
    const company = this.furnitureStore.currentCompany();
    if (company?.name?.trim()) {
      return company.name.trim();
    }
    return this.translation.t('cabinet.registerPromoTitle');
  });

  private cabinetBackgroundKey(): CabinetTabBackgroundKey {
    if (this.furnitureStore.currentCompany()) {
      return 'cabinetFurniture';
    }

    const performer = this.store.currentPerformer();
    if (performer?.type === 'brigade') {
      return 'cabinetBrigade';
    }
    if (performer?.type === 'worker') {
      return 'cabinetWorker';
    }

    const accountType = String(this.auth.user()?.user_metadata?.['account_type'] ?? '');
    if (accountType === 'brigade') {
      return 'cabinetBrigade';
    }
    if (accountType === 'furniture') {
      return 'cabinetFurniture';
    }

    return 'cabinetWorker';
  }

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
    afterNextRender(async () => {
      await this.auth.ensureInitialized();
      if (this.auth.session()) {
        await this.cabinetSession.restoreForCurrentUser();
      }
    });

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

  protected profileInitial(): string {
    const performer = this.store.currentPerformer();
    const company = this.furnitureStore.currentCompany();
    const name = performer?.name ?? company?.name ?? '';
    return name.trim().charAt(0).toUpperCase() || '?';
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

  async uploadWork() {
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
      if (!work) {
        return;
      }

      const ownerId = company.dbId ?? company.id;
      const saveResult = await firstValueFrom(
        this.supabase.savePortfolioWork({
          ownerId,
          ownerType: 'furniture',
          work,
        }),
      );

      if (saveResult.error) {
        this.furnitureStore.deleteWork(company.id, work.id);
        alert(saveResult.error);
        return;
      }

      this.uploadSuccess.set(true);
      this.lastUploadResult.set(null);
      this.workForm.reset();
      this.beforePreview.set(null);
      this.afterPreview.set(null);
      this.resetFileInputs();
      setTimeout(() => this.uploadSuccess.set(false), 6000);
      return;
    }

    const result = this.store.addWork(performer!.id, {
      title: v.title,
      description: v.description,
      beforeImage: before,
      afterImage: after,
      clientContact: WORK_VERIFICATION_ENABLED ? v.clientContact : '',
    });

    if (!result) {
      return;
    }

    const ownerType = performer!.type === 'brigade' ? 'brigade' : 'worker';
    const saveResult = await firstValueFrom(
      this.supabase.savePortfolioWork({
        ownerId: performer!.id,
        ownerType,
        work: result.work,
      }),
    );

    if (saveResult.error) {
      this.store.deleteWork(performer!.id, result.work.id);
      alert(saveResult.error);
      return;
    }

    this.uploadSuccess.set(true);
    this.lastUploadResult.set(result);
    this.workForm.reset();
    this.beforePreview.set(null);
    this.afterPreview.set(null);
    this.resetFileInputs();
    setTimeout(() => this.uploadSuccess.set(false), 6000);
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
    void this.auth.signOut();
    this.store.signOut();
    this.furnitureStore.signOut();
    this.beforePreview.set(null);
    this.afterPreview.set(null);
    this.resetFileInputs();
  }

  workFieldInvalid(field: 'description'): boolean {
    const control = this.workForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  maxWordsError(): string {
    const control = this.workForm.get('description');
    const error = control?.errors?.['maxWords'] as { max: number; actual: number } | undefined;
    if (!error) {
      return '';
    }
    return this.translation
      .t('textLimits.maxWordsError')
      .replace('{{max}}', String(error.max))
      .replace('{{count}}', String(error.actual));
  }

  wordCountLabel(value: string): string {
    return this.translation
      .t('textLimits.wordCount')
      .replace('{{count}}', String(countWords(value)))
      .replace('{{max}}', String(MAX_TEXT_WORDS));
  }

  furnitureSpecialtyDisplay(specialty: string): string {
    return this.catalogL10n.localizeSpecialtyField(specialty);
  }

  myWorksLabel(count: number): string {
    return this.translation.t('cabinet.myWorksCount').replace('{{count}}', String(count));
  }
}
