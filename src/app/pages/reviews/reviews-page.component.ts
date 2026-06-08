import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReviewPerformerTypeKey } from '../../core/models/portfolio.models';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { TranslationService } from '../../core/services/translation.service';
export type ReviewCategoryKey = 'brigade' | 'master' | 'furniture';

interface PerformerOption {
  id: string;
  name: string;
  subtitle: string;
}

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reviews-page.component.html',
  styleUrls: ['./reviews-page.component.css'],
})
export class ReviewsPageComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly portfolioStore = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly category = signal<ReviewCategoryKey>('brigade');
  protected readonly performerQuery = signal('');
  protected readonly performerMenuOpen = signal(false);
  protected readonly submitSuccess = signal(false);
  protected readonly hoverRating = signal(0);

  protected readonly beforePreview = signal<string | null>(null);
  protected readonly afterPreview = signal<string | null>(null);
  protected readonly beforeDragging = signal(false);
  protected readonly afterDragging = signal(false);

  private readonly beforeInput = viewChild<ElementRef<HTMLInputElement>>('beforeInput');
  private readonly afterInput = viewChild<ElementRef<HTMLInputElement>>('afterInput');

  protected readonly reviewForm = this.fb.nonNullable.group({
    clientName: ['', [Validators.required, Validators.minLength(2)]],
    performerId: ['', Validators.required],
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    review: ['', [Validators.required, Validators.minLength(20)]],
  });

  protected readonly performerOptions = computed<PerformerOption[]>(() => {
    switch (this.category()) {
      case 'brigade':
        return this.portfolioStore.brigades().map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.specialty,
        }));
      case 'master':
        return this.portfolioStore.workers().map((p) => ({
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
        item.name.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query),
    );
  });

  protected readonly selectedPerformerName = computed(() => {
    const id = this.reviewForm.get('performerId')?.value;
    if (!id) {
      return '';
    }
    return this.performerOptions().find((p) => p.id === id)?.name ?? '';
  });

  protected readonly categories: ReviewCategoryKey[] = ['brigade', 'master', 'furniture'];

  selectCategory(next: ReviewCategoryKey) {
    this.category.set(next);
    this.performerQuery.set('');
    this.performerMenuOpen.set(false);
    this.reviewForm.patchValue({ performerId: '' });
    this.reviewForm.get('performerId')?.markAsUntouched();
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

  submitReview() {
    if (this.reviewForm.invalid) {
      this.reviewForm.markAllAsTouched();
      return;
    }

    const performer = this.performerOptions().find(
      (p) => p.id === this.reviewForm.getRawValue().performerId,
    );
    if (!performer) {
      this.reviewForm.get('performerId')?.setErrors({ required: true });
      this.reviewForm.get('performerId')?.markAsTouched();
      return;
    }

    const v = this.reviewForm.getRawValue();
    const { performerType, performerTypeKey } = this.mapCategory(this.category());

    this.reviewStore.addReview({
      name: v.clientName,
      performerType,
      performerTypeKey,
      category: performer.name,
      performerId: performer.id,
      review: v.review,
      rating: v.rating,
      beforeImage: this.beforePreview() ?? undefined,
      afterImage: this.afterPreview() ?? undefined,
    });

    this.submitSuccess.set(true);
    this.reviewForm.reset({ clientName: '', performerId: '', rating: 0, review: '' });
    this.performerQuery.set('');
    this.beforePreview.set(null);
    this.afterPreview.set(null);
    this.resetFileInputs();
    setTimeout(() => this.submitSuccess.set(false), 6000);
  }

  fieldInvalid(field: 'clientName' | 'performerId' | 'rating' | 'review'): boolean {
    const control = this.reviewForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  starLabel(index: number): string {
    return this.translation.t('reviewsPage.stars').replace('{{n}}', String(index));
  }

  categoryLabel(key: ReviewCategoryKey): string {
    return this.translation.t(`reviewsPage.categories.${key}`);
  }

  ratingDisplay(review: { rating?: number }): string {
    const value = review.rating ?? 0;
    return '★'.repeat(value) + '☆'.repeat(Math.max(0, 5 - value));
  }

  private mapCategory(category: ReviewCategoryKey): {
    performerType: 'Мастер' | 'Бригада' | 'Мебель';
    performerTypeKey: ReviewPerformerTypeKey;
  } {
    switch (category) {
      case 'brigade':
        return { performerType: 'Бригада', performerTypeKey: 'brigade' };
      case 'furniture':
        return { performerType: 'Мебель', performerTypeKey: 'furniture' };
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
    this.loadImage(side, file, input);
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
    this.loadImage(side, file, input);
  }

  private loadImage(side: 'before' | 'after', file: File, input?: HTMLInputElement) {
    if (!file.type.startsWith('image/')) {
      alert(this.translation.t('reviewsPage.errors.imageOnly'));
      if (input) {
        input.value = '';
      }
      return;
    }

    if (file.size > 800_000) {
      alert(this.translation.t('reviewsPage.errors.fileTooLarge'));
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

  @HostListener('document:click')
  closePerformerMenu() {
    this.performerMenuOpen.set(false);
  }
}
