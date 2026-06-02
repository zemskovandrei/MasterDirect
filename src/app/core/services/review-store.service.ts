import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ReviewSubmission, ReviewNotification } from '../models/portfolio.models';

const REVIEWS_KEY = 'pro-remont-reviews';

@Injectable({ providedIn: 'root' })
export class ReviewStoreService {
  private readonly platformId = inject(PLATFORM_ID);
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

  addReview(data: {
    name: string;
    performerType: ReviewSubmission['performerType'];
    category: string;
    review: string;
  }): ReviewSubmission {
    const submission: ReviewSubmission = {
      id: `review-${Date.now()}`,
      name: data.name.trim(),
      performerType: data.performerType,
      category: data.category,
      review: data.review.trim(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

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
      link: '/portfolio',
      createdAt: new Date().toISOString(),
    };

    this.notificationsSignal.update((list) => [notification, ...list]);
    this.persist();
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const raw = localStorage.getItem(REVIEWS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.reviewsSignal.set(parsed as ReviewSubmission[]);
        this.notificationsSignal.set([]);
      } else {
        this.reviewsSignal.set((parsed.reviews || []) as ReviewSubmission[]);
        this.notificationsSignal.set((parsed.notifications || []) as ReviewNotification[]);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    localStorage.setItem(
      REVIEWS_KEY,
      JSON.stringify({
        reviews: this.reviewsSignal(),
        notifications: this.notificationsSignal(),
      }),
    );
  }
}
