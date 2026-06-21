import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ReviewPerformerTypeKey,
  ReviewSubmission,
  WorkProject,
} from '../../core/models/portfolio.models';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { TranslationService } from '../../core/services/translation.service';
import { MAX_TEXT_WORDS, countWords, maxWordsValidator } from '../../core/utils/word-limit.util';
import { beforeAfterWork } from '../../core/utils/before-after.util';
import { compressWorkImageFile } from '../../core/utils/compress-image.util';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import {
  reviewsHeroVisualStyle,
  reviewsPageBackgroundStyle,
} from '../../core/constants/catalog-tab-backgrounds';
import { CatalogOrderCalculatorSectionComponent } from '../../shared/components/catalog-order-calculator-section/catalog-order-calculator-section.component';

export type ReviewCategoryKey = 'brigade' | 'master' | 'furniture' | 'renovation';
export type ReviewFormMode = 'review' | 'recommendation' | 'siteFeedback';

interface PerformerOption {
  id: string;
  name: string;
  subtitle: string;
}

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BeforeAfterComponent, CatalogOrderCalculatorSectionComponent],
  templateUrl: './reviews-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../styles/catalog-pages.css', './reviews-page.component.css'],
})
export class ReviewsPageComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly portfolioStore = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly pageBackground = computed(() =>
    reviewsPageBackgroundStyle(this.formMode(), this.category()),
  );

  protected readonly heroVisualStyle = computed(() =>
    reviewsHeroVisualStyle(this.formMode(), this.category()),
  );

  protected readonly pageAccentClass = computed(() => {
    const mode = this.formMode();
    const cat = this.category();
    return `reviews-page--mode-${mode}${mode !== 'siteFeedback' ? ` reviews-page--cat-${cat}` : ''}`;
  });

  protected readonly formModeIcon = (mode: ReviewFormMode): string => {
    switch (mode) {
      case 'review':
        return '✍️';
      case 'recommendation':
        return '🙌';
      case 'siteFeedback':
        return '💡';
    }
  };

  protected readonly categoryIcon = (cat: ReviewCategoryKey): string => {
    switch (cat) {
      case 'brigade':
        return '🏗️';
      case 'master':
        return '🔧';
      case 'furniture':
        return '🪑';
      case 'renovation':
        return '🏠';
    }
  };

  protected readonly category = signal<ReviewCategoryKey>('brigade');
  protected readonly formMode = signal<ReviewFormMode>('review');
  protected readonly performerQuery = signal('');
  protected readonly performerMenuOpen = signal(false);
  protected readonly submitSuccess = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly hoverRating = signal(0);

  protected readonly beforePreview = signal<string | null>(null);
  protected readonly afterPreview = signal<string | null>(null);
  protected readonly beforeDragging = signal(false);
  protected readonly afterDragging = signal(false);

  private readonly beforeInput = viewChild<ElementRef<HTMLInputElement>>('beforeInput');
  private readonly afterInput = viewChild<ElementRef<HTMLInputElement>>('afterInput');

  protected readonly maxTextWords = MAX_TEXT_WORDS;
  protected readonly countWords = countWords;

  protected readonly reviewForm = this.fb.nonNullable.group({
    clientName: ['', [Validators.required, Validators.minLength(2)]],
    performerId: [''],
    performerFreeText: [''],
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    review: ['', [Validators.required, Validators.minLength(20), maxWordsValidator()]],
    recommendConfirm: [false],
  });

  protected readonly formModes: ReviewFormMode[] = ['review', 'recommendation', 'siteFeedback'];

  protected readonly performerOptions = computed<PerformerOption[]>(() => {
    switch (this.category()) {
      case 'brigade':
        return this.supabase.brigades().map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.specialty,
        }));
      case 'master':
        return this.supabase.workers().map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.specialty,
        }));
      case 'furniture':
        return this.furnitureStore.published().map((c) => ({
          id: c.id,
          name: c.name,
          subtitle: c.city,
        }));
      case 'renovation':
        return [];
    }
  });

  protected readonly filteredPerformers = computed(() => {
    const query = this.performerQuery().trim().toLowerCase();
    const list = this.performerOptions();
    if (!query) {
      return list;
    }
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(query) || item.subtitle.toLowerCase().includes(query),
    );
  });

  protected readonly selectedPerformerName = computed(() => {
    const id = this.reviewForm.get('performerId')?.value;
    if (!id) {
      return '';
    }
    return this.performerOptions().find((p) => p.id === id)?.name ?? '';
  });

  protected readonly categories: ReviewCategoryKey[] = [
    'brigade',
    'master',
    'furniture',
    'renovation',
  ];

  selectCategory(next: ReviewCategoryKey) {
    this.category.set(next);
    this.performerQuery.set('');
    this.performerMenuOpen.set(false);
    this.reviewForm.patchValue({ performerId: '', performerFreeText: '' });
    this.reviewForm.get('performerId')?.markAsUntouched();
    this.reviewForm.get('performerFreeText')?.markAsUntouched();
  }

  selectFormMode(mode: ReviewFormMode) {
    this.formMode.set(mode);
    this.applyFormModeValidators();
    this.reviewForm.get('recommendConfirm')?.markAsUntouched();
    this.reviewForm.get('rating')?.markAsUntouched();
    this.reviewForm.get('review')?.markAsUntouched();
  }

  isRecommendationMode(): boolean {
    return this.formMode() === 'recommendation';
  }

  isSiteFeedbackMode(): boolean {
    return this.formMode() === 'siteFeedback';
  }

  setRating(value: number) {
    this.reviewForm.patchValue({ rating: value });
    this.reviewForm.get('rating')?.markAsTouched();
  }

  onPerformerInput(value: string) {
    this.performerQuery.set(value);
    this.performerMenuOpen.set(true);
    const match = this.performerOptions().find(
      (p) => p.name.toLowerCase() === value.trim().toLowerCase(),
    );
    this.reviewForm.patchValue({ performerId: match?.id ?? '' });
  }

  selectPerformer(option: PerformerOption) {
    this.performerQuery.set(option.name);
    this.reviewForm.patchValue({ performerId: option.id });
    this.reviewForm.get('performerId')?.markAsDirty();
    this.performerMenuOpen.set(false);
  }

  async submitReview() {
    this.submitError.set(null);

    if (this.isSiteFeedbackMode()) {
      const reviewControl = this.reviewForm.get('review');
      if (!reviewControl?.value?.trim()) {
        reviewControl?.setErrors({ required: true });
      }

      if (this.reviewForm.get('clientName')?.invalid || reviewControl?.invalid) {
        this.reviewForm.markAllAsTouched();
        return;
      }

      const v = this.reviewForm.getRawValue();
      const created = await this.reviewStore.addReview({
        name: v.clientName,
        performerType: 'Сайт',
        performerTypeKey: 'site',
        category: this.translation.t('reviewsPage.siteFeedback.categoryLabel'),
        review: v.review,
        kind: 'siteFeedback',
      });

      if (!created) {
        this.submitError.set(this.translation.t('reviewsPage.errors.submitFailed'));
        return;
      }

      this.finishSubmitSuccess();
      return;
    }

    if (this.category() === 'renovation') {
      const freeText = this.reviewForm.get('performerFreeText')?.value.trim() ?? '';
      if (!freeText) {
        this.reviewForm.get('performerFreeText')?.setErrors({ required: true });
      }
    } else if (!this.reviewForm.get('performerId')?.value) {
      this.reviewForm.get('performerId')?.setErrors({ required: true });
    }

    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    const v = this.reviewForm.getRawValue();
    const kind = this.formMode();
    const { performerType, performerTypeKey } = this.mapCategory(this.category());
    const sharedPayload = {
      name: v.clientName,
      performerType,
      performerTypeKey,
      review: v.review,
      kind,
      rating: kind === 'recommendation' ? 5 : v.rating,
      beforeImage: kind === 'review' ? (this.beforePreview() ?? undefined) : undefined,
      afterImage: kind === 'review' ? (this.afterPreview() ?? undefined) : undefined,
    };

    if (this.category() === 'renovation') {
      const performerName = v.performerFreeText.trim();
      const created = await this.reviewStore.addReview({
        ...sharedPayload,
        category: performerName,
      });
      if (!created) {
        this.submitError.set(this.translation.t('reviewsPage.errors.submitFailed'));
        return;
      }
    } else {
      const performer = this.performerOptions().find((p) => p.id === v.performerId);
      if (!performer) {
        this.reviewForm.get('performerId')?.setErrors({ required: true });
        this.reviewForm.get('performerId')?.markAsTouched();
        return;
      }

      const created = await this.reviewStore.addReview({
        ...sharedPayload,
        category: performer.name,
        performerId: performer.id,
      });
      if (!created) {
        this.submitError.set(this.translation.t('reviewsPage.errors.submitFailed'));
        return;
      }
    }

    this.finishSubmitSuccess();
  }

  private finishSubmitSuccess(): void {
    this.submitSuccess.set(true);
    this.reviewForm.reset({
      clientName: '',
      performerId: '',
      performerFreeText: '',
      rating: 0,
      review: '',
      recommendConfirm: false,
    });
    this.applyFormModeValidators();
    this.performerQuery.set('');
    this.beforePreview.set(null);
    this.afterPreview.set(null);
    this.resetFileInputs();
    setTimeout(() => this.submitSuccess.set(false), 6000);
  }

  fieldInvalid(
    field:
      | 'clientName'
      | 'performerId'
      | 'performerFreeText'
      | 'rating'
      | 'review'
      | 'recommendConfirm',
  ): boolean {
    const control = this.reviewForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  hasMaxWordsError(field: 'review'): boolean {
    return !!this.reviewForm.get(field)?.errors?.['maxWords'];
  }

  wordCountLabel(value: string): string {
    return this.translation
      .t('textLimits.wordCount')
      .replace('{{count}}', String(countWords(value)))
      .replace('{{max}}', String(MAX_TEXT_WORDS));
  }

  maxWordsError(field: 'review'): string {
    const error = this.reviewForm.get(field)?.errors?.['maxWords'] as
      | { max: number; actual: number }
      | undefined;
    if (!error) {
      return '';
    }
    return this.translation
      .t('textLimits.maxWordsError')
      .replace('{{max}}', String(error.max))
      .replace('{{count}}', String(error.actual));
  }

  starLabel(index: number): string {
    return this.translation.t('reviewsPage.stars').replace('{{n}}', String(index));
  }

  categoryLabel(key: ReviewCategoryKey): string {
    return this.translation.t(`reviewsPage.categories.${key}`);
  }

  formModeLabel(mode: ReviewFormMode): string {
    return this.translation.t(`reviewsPage.formModes.${mode}`);
  }

  dynamicTitle(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.siteFeedback.title');
    }
    const prefix = this.isRecommendationMode() ? 'recommendationTitles' : 'titles';
    return this.translation.t(`reviewsPage.${prefix}.${this.category()}`);
  }

  dynamicSubtitle(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.siteFeedback.subtitle');
    }
    return this.translation.t(
      this.isRecommendationMode() ? 'reviewsPage.recommendationSubtitle' : 'reviewsPage.subtitle',
    );
  }

  submitSuccessMessage(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.form.siteFeedbackSuccess');
    }
    return this.translation.t(
      this.isRecommendationMode()
        ? 'reviewsPage.form.recommendationSuccess'
        : 'reviewsPage.form.success',
    );
  }

  submitButtonLabel(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.form.submitSiteFeedback');
    }
    return this.translation.t(
      this.isRecommendationMode()
        ? 'reviewsPage.form.submitRecommendation'
        : 'reviewsPage.form.submit',
    );
  }

  reviewTextLabel(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.form.siteFeedbackText');
    }
    return this.translation.t(
      this.isRecommendationMode() ? 'reviewsPage.form.recommendationText' : 'reviewsPage.form.text',
    );
  }

  reviewTextPlaceholder(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.form.siteFeedbackTextPh');
    }
    return this.translation.t(
      this.isRecommendationMode()
        ? 'reviewsPage.form.recommendationTextPh'
        : 'reviewsPage.form.textPh',
    );
  }

  reviewTextError(): string {
    if (this.isSiteFeedbackMode()) {
      return this.translation.t('reviewsPage.errors.siteFeedbackText');
    }
    return this.translation.t(
      this.isRecommendationMode()
        ? 'reviewsPage.errors.recommendationText'
        : 'reviewsPage.errors.text',
    );
  }

  performerPlaceholder(): string {
    return this.translation.t(`reviewsPage.form.performerPh.${this.category()}`);
  }

  ratingDisplay(review: { rating?: number }): string {
    const value = review.rating ?? 0;
    return '★'.repeat(value) + '☆'.repeat(Math.max(0, 5 - value));
  }

  private applyFormModeValidators() {
    const reviewControl = this.reviewForm.get('review');
    const ratingControl = this.reviewForm.get('rating');
    const confirmControl = this.reviewForm.get('recommendConfirm');

    if (this.isSiteFeedbackMode()) {
      reviewControl?.setValidators([
        Validators.required,
        Validators.minLength(10),
        maxWordsValidator(),
      ]);
      ratingControl?.clearValidators();
      ratingControl?.setValue(0);
      confirmControl?.clearValidators();
      confirmControl?.setValue(false);
    } else if (this.isRecommendationMode()) {
      reviewControl?.setValidators([
        Validators.required,
        Validators.minLength(10),
        maxWordsValidator(),
      ]);
      ratingControl?.clearValidators();
      ratingControl?.setValue(5);
      confirmControl?.setValidators([Validators.requiredTrue]);
    } else {
      reviewControl?.setValidators([
        Validators.required,
        Validators.minLength(20),
        maxWordsValidator(),
      ]);
      ratingControl?.setValidators([Validators.required, Validators.min(1), Validators.max(5)]);
      if (ratingControl?.value === 5 && !ratingControl.dirty) {
        ratingControl.setValue(0);
      }
      confirmControl?.clearValidators();
      confirmControl?.setValue(false);
    }

    reviewControl?.updateValueAndValidity({ emitEvent: false });
    ratingControl?.updateValueAndValidity({ emitEvent: false });
    confirmControl?.updateValueAndValidity({ emitEvent: false });
  }

  private mapCategory(category: ReviewCategoryKey): {
    performerType: 'Мастер' | 'Бригада' | 'Мебель' | 'Ремонт';
    performerTypeKey: ReviewPerformerTypeKey;
  } {
    switch (category) {
      case 'brigade':
        return { performerType: 'Бригада', performerTypeKey: 'brigade' };
      case 'furniture':
        return { performerType: 'Мебель', performerTypeKey: 'furniture' };
      case 'renovation':
        return { performerType: 'Ремонт', performerTypeKey: 'renovation' };
      default:
        return { performerType: 'Мастер', performerTypeKey: 'master' };
    }
  }

  onFileSelected(side: 'before' | 'after', event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    void this.loadImage(side, file, input);
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
    void this.loadImage(side, file, input);
  }

  private async loadImage(side: 'before' | 'after', file: File, input?: HTMLInputElement) {
    if (!file.type.startsWith('image/')) {
      alert(this.translation.t('reviewsPage.errors.imageOnly'));
      if (input) {
        input.value = '';
      }
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      alert(this.translation.t('reviewsPage.errors.fileTooLarge'));
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

  @HostListener('document:click')
  closePerformerMenu() {
    this.performerMenuOpen.set(false);
  }

  protected reviewPhotosWork(item: ReviewSubmission): WorkProject | null {
    if (!item.beforeImage || !item.afterImage) {
      return null;
    }
    return beforeAfterWork(item.id, item.beforeImage, item.afterImage);
  }
}
