import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
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
import { compressWorkImageFile } from '../../core/utils/compress-image.util';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import { normalizeUuid } from '../../core/utils/furniture-id.util';
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
  private static readonly premiumUnlockThreshold = 5;
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
  protected readonly socialSaveError = signal<string | null>(null);
  protected readonly lastUploadResult = signal<AddWorkResult | null>(null);
  protected readonly copyFeedback = signal<string | null>(null);
  protected readonly completedOrdersCount = signal<number | null>(null);
  protected readonly hasSocialLinks = hasSocialLinks;
  protected readonly maxTextWords = MAX_TEXT_WORDS;
  protected readonly countWords = countWords;

  protected readonly hasCabinetSession = computed(
    () => !!this.store.currentPerformer() || !!this.furnitureStore.currentCompany(),
  );

  protected readonly isLoggedIn = computed(() => this.hasCabinetSession() || !!this.auth.user());

  protected readonly premiumAccessUnlocked = computed(
    () => (this.completedOrdersCount() ?? 0) >= CabinetComponent.premiumUnlockThreshold,
  );

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
  protected readonly videoTitle = signal('');
  protected readonly videoPreviewUrl = signal<string | null>(null);
  protected readonly videoUploading = signal(false);
  protected readonly videoSuccess = signal(false);
  protected readonly videoError = signal<string | null>(null);
  private videoFile: File | null = null;

  private readonly beforeInput = viewChild<ElementRef<HTMLInputElement>>('beforeInput');
  private readonly afterInput = viewChild<ElementRef<HTMLInputElement>>('afterInput');
  private readonly videoInputs = viewChildren<ElementRef<HTMLInputElement>>('videoInput');
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentWorkVideos = computed(
    () =>
      this.store.currentPerformer()?.workVideos ??
      this.furnitureStore.currentCompany()?.workVideos ??
      [],
  );

  constructor() {
    this.destroyRef.onDestroy(() => this.revokeVideoPreview());

    afterNextRender(async () => {
      await this.auth.ensureInitialized();
      if (this.auth.session()) {
        await this.cabinetSession.restoreForCurrentUser();
        await this.refreshPremiumAccess();
      }
    });

    effect(() => {
      if (this.hasCabinetSession()) {
        void this.refreshPremiumAccess();
      } else {
        this.completedOrdersCount.set(null);
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

  protected profileAvatarUrl(): string | null {
    return this.store.currentPerformer()?.avatarUrl ?? this.furnitureStore.currentCompany()?.avatarUrl ?? null;
  }

  private async refreshPremiumAccess(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!userId) {
      this.completedOrdersCount.set(null);
      return;
    }

    try {
      const count = await this.supabase.countCompletedOrdersForUser(userId);
      this.completedOrdersCount.set(count);
    } catch {
      this.completedOrdersCount.set(0);
    }
  }

  async saveSocialLinks() {
    const v = this.socialForm.getRawValue();
    const performer = this.store.currentPerformer();
    const company = this.furnitureStore.currentCompany();
    const profileId =
      normalizeUuid(this.auth.user()?.id) ??
      normalizeUuid(company?.dbId) ??
      performer?.id ??
      company?.id;
    if (!profileId) {
      return;
    }

    this.socialSaveError.set(null);
    const result = await firstValueFrom(this.supabase.updateSocialLinks(profileId, v));
    if (result.error) {
      this.socialSaveError.set(result.error);
      return;
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
    void this.loadWorkImage(side, file, input);
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
    void this.loadWorkImage(side, file, input);
  }

  private async loadWorkImage(side: 'before' | 'after', file: File, input?: HTMLInputElement) {
    if (!file.type.startsWith('image/')) {
      alert(this.translation.t('cabinet.alertImageOnly'));
      if (input) {
        input.value = '';
      }
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert(this.translation.t('cabinet.alertFileTooLarge'));
      if (input) {
        input.value = '';
      }
      return;
    }

    try {
      const dataUrl = await compressWorkImageFile(file);
      if (side === 'before') {
        this.beforePreview.set(dataUrl);
      } else {
        this.afterPreview.set(dataUrl);
      }
    } catch {
      alert(this.translation.t('cabinet.alertImageCompressFailed'));
      if (input) {
        input.value = '';
      }
    }
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

  async deletePerformerWork(workId: string, workTitle: string): Promise<void> {
    const performer = this.store.currentPerformer();
    if (!performer || !workId.trim()) {
      return;
    }

    const confirmed = window.confirm(
      this.translation
        .t('admin.catalog.deleteWorkConfirm')
        .replace('{{title}}', workTitle || '—'),
    );
    if (!confirmed) {
      return;
    }

    this.store.deleteWork(performer.id, workId);
  }

  async deleteFurnitureWork(workId: string, workTitle: string): Promise<void> {
    const company = this.furnitureStore.currentCompany();
    if (!company || !workId.trim()) {
      return;
    }

    const confirmed = window.confirm(
      this.translation
        .t('admin.catalog.deleteWorkConfirm')
        .replace('{{title}}', workTitle || '—'),
    );
    if (!confirmed) {
      return;
    }

    this.furnitureStore.deleteWork(company.id, workId);
  }

  onVideoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      this.videoError.set(this.translation.t('cabinet.alertVideoOnly'));
      input.value = '';
      return;
    }

    if (file.size > 80 * 1024 * 1024) {
      this.videoError.set(this.translation.t('cabinet.alertVideoTooLarge'));
      input.value = '';
      return;
    }

    this.videoError.set(null);
    this.videoFile = file;
    this.revokeVideoPreview();
    this.videoPreviewUrl.set(URL.createObjectURL(file));
  }

  async uploadWorkVideo() {
    const performer = this.store.currentPerformer();
    const company = this.furnitureStore.currentCompany();
    const ownerId = performer?.id ?? company?.dbId ?? company?.id;
    if (!ownerId) {
      return;
    }

    const file = this.videoFile;
    if (!file) {
      this.videoError.set(this.translation.t('cabinet.alertVideoRequired'));
      return;
    }

    this.videoUploading.set(true);
    this.videoError.set(null);

    try {
      const result = await firstValueFrom(
        this.supabase.saveWorkVideo({
          ownerId,
          title: this.videoTitle(),
          file,
        }),
      );
      if (result.error) {
        this.videoError.set(result.error);
        return;
      }

      this.videoSuccess.set(true);
      this.resetVideoForm();
      setTimeout(() => this.videoSuccess.set(false), 5000);
    } finally {
      this.videoUploading.set(false);
    }
  }

  async deleteWorkVideo(videoId: string, videoTitle: string): Promise<void> {
    if (!videoId.trim()) {
      return;
    }

    const confirmed = window.confirm(
      this.translation
        .t('cabinet.deleteVideoConfirm')
        .replace('{{title}}', videoTitle || '—'),
    );
    if (!confirmed) {
      return;
    }

    const result = await firstValueFrom(this.supabase.deleteWorkVideo(videoId));
    if (result.error) {
      alert(result.error);
    }
  }

  private revokeVideoPreview() {
    const url = this.videoPreviewUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
    this.videoPreviewUrl.set(null);
  }

  private resetVideoForm() {
    this.videoFile = null;
    this.videoTitle.set('');
    this.revokeVideoPreview();
    for (const input of this.videoInputs()) {
      input.nativeElement.value = '';
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
    void this.auth.signOut();
    this.store.signOut();
    this.furnitureStore.signOut();
    this.completedOrdersCount.set(null);
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

  myVideosLabel(count: number): string {
    return this.translation.t('cabinet.myVideosCount').replace('{{count}}', String(count));
  }
}
