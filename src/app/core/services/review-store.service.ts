import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ReviewPerformerTypeKey,
  ReviewNotification,
  ReviewSubmission,
} from '../models/portfolio.models';
import { TranslationService } from './translation.service';
import { shouldWipeCatalog, wipeCatalogStorage } from '../utils/catalog-wipe.util';

const REVIEWS_KEY = 'smartbuild-tech-reviews';

@Injectable({ providedIn: 'root' })
export class ReviewStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translation = inject(TranslationService);

  private readonly reviewsSignal = signal<ReviewSubmission[]>([]);
  private readonly notificationsSignal = signal<ReviewNotification[]>([]);

  readonly reviews = this.reviewsSignal.asReadonly();
  readonly pendingReviews = computed(() =>
    this.reviewsSignal().filter((review) => review.status === 'pending'),
  );
  readonly approvedReviews = computed(() =>
    this.reviewsSignal().filter((review) => review.status === 'approved'),
  );
  readonly notifications = this.notificationsSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  localizeReview(review: ReviewSubmission): string {
    this.translation.locale();
    if (review.i18nKey) {
      const text = this.translation.t(`${review.i18nKey}.text`);
      if (text && text !== `${review.i18nKey}.text`) {
        return text;
      }
    }
    return review.review;
  }

  localizeCategory(review: ReviewSubmission): string {
    this.translation.locale();
    if (review.i18nKey) {
      const category = this.translation.t(`${review.i18nKey}.category`);
      if (category && category !== `${review.i18nKey}.category`) {
        return category;
      }
    }
    return review.category;
  }

  performerTypeLabel(review: ReviewSubmission): string {
    this.translation.locale();
    const key = this.resolvePerformerTypeKey(review);
    return this.translation.t(`reviews.performerType.${key}`);
  }

  resolvePerformerTypeKey(review: ReviewSubmission): ReviewPerformerTypeKey {
    if (review.performerTypeKey) {
      return review.performerTypeKey;
    }
    if (review.performerType === 'Бригада') {
      return 'brigade';
    }
    if (review.performerType === 'Мебель') {
      return 'furniture';
    }
    return 'master';
  }

  addReview(data: {
    name: string;
    performerType: ReviewSubmission['performerType'];
    performerTypeKey?: ReviewPerformerTypeKey;
    category: string;
    performerId?: string;
    review: string;
    rating?: number;
    beforeImage?: string;
    afterImage?: string;
  }): ReviewSubmission {
    const performerTypeKey: ReviewPerformerTypeKey =
      data.performerTypeKey ?? this.resolvePerformerTypeKey({ performerType: data.performerType } as ReviewSubmission);

    const submission: ReviewSubmission = {
      id: `review-${Date.now()}`,
      name: data.name.trim(),
      performerType: data.performerType,
      performerTypeKey,
      category: data.category,
      review: data.review.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (data.performerId) {
      submission.performerId = data.performerId;
    }
    if (data.rating) {
      submission.rating = data.rating;
    }
    if (data.beforeImage) {
      submission.beforeImage = data.beforeImage;
    }
    if (data.afterImage) {
      submission.afterImage = data.afterImage;
    }

    this.reviewsSignal.update((list) => [submission, ...list]);
    this.persist();
    return submission;
  }

  approveReview(id: string): void {
    const review = this.reviewsSignal().find((item) => item.id === id);
    if (!review || review.status === 'approved') {
      return;
    }

    this.updateStatus(id, 'approved');
    this.addPublicationNotification(review);
  }

  rejectReview(id: string): void {
    this.updateStatus(id, 'rejected');
  }

  private updateStatus(id: string, status: ReviewSubmission['status']): void {
    this.reviewsSignal.update((list) =>
      list.map((review) => (review.id === id ? { ...review, status } : review)),
    );
    this.persist();
  }

  private addPublicationNotification(review: ReviewSubmission): void {
    const notification: ReviewNotification = {
      id: `notification-${Date.now()}`,
      reviewId: review.id,
      message: `Отзыв "${review.category}" от ${review.name} опубликован. `,
      link: '/brigades',
      createdAt: new Date().toISOString(),
    };

    this.notificationsSignal.update((list) => [notification, ...list]);
    this.persist();
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (shouldWipeCatalog()) {
      wipeCatalogStorage();
      this.reviewsSignal.set([]);
      this.notificationsSignal.set([]);
      return;
    }

    try {
      const raw = localStorage.getItem(REVIEWS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      const stored = Array.isArray(parsed)
        ? (parsed as ReviewSubmission[])
        : ((parsed.reviews || []) as ReviewSubmission[]);

      const userReviews = stored
        .filter((review) => !review.isDemo && !review.id.startsWith('seed-'))
        .map((review) => this.normalizeReview(review));

      this.reviewsSignal.set(userReviews);

      if (!Array.isArray(parsed)) {
        this.notificationsSignal.set((parsed.notifications || []) as ReviewNotification[]);
      }
    } catch {
      localStorage.removeItem(REVIEWS_KEY);
    }
  }

  private normalizeReview(review: ReviewSubmission): ReviewSubmission {
    return {
      ...review,
      performerTypeKey: review.performerTypeKey ?? this.resolvePerformerTypeKey(review),
    };
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const userReviews = this.reviewsSignal().filter(
      (review) => !review.isDemo && !review.id.startsWith('seed-'),
    );

    localStorage.setItem(
      REVIEWS_KEY,
      JSON.stringify({
        reviews: userReviews,
        notifications: this.notificationsSignal(),
      }),
    );
  }
}
