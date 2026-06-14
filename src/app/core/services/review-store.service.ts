import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ReviewPerformerTypeKey,
  ReviewNotification,
  ReviewSubmission,
} from '../models/portfolio.models';
import type { ReviewRow } from '../models/master.model';
import { environment } from '../../../environments/environment';
import { TranslationService } from './translation.service';
import { SupabaseService } from './supabase.service';
import { logSupabaseError } from '../utils/supabase-error.util';

@Injectable({ providedIn: 'root' })
export class ReviewStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translation = inject(TranslationService);
  private readonly supabase = inject(SupabaseService);

  private readonly reviewsSignal = signal<ReviewSubmission[]>([]);
  private readonly notificationsSignal = signal<ReviewNotification[]>([]);
  private readonly loadingSignal = signal(false);

  readonly reviews = this.reviewsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly pendingReviews = computed(() =>
    this.reviewsSignal().filter((review) => review.status === 'pending'),
  );
  readonly approvedReviews = computed(() =>
    this.reviewsSignal().filter((review) => review.status === 'approved'),
  );
  readonly notifications = this.notificationsSignal.asReadonly();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.loadApprovedReviews();
    }
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

  isRecommendation(review: ReviewSubmission): boolean {
    return review.kind === 'recommendation';
  }

  submissionKindLabel(review: ReviewSubmission): string {
    this.translation.locale();
    return this.isRecommendation(review)
      ? this.translation.t('reviewsPage.kind.recommendation')
      : this.translation.t('reviewsPage.kind.review');
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
    if (review.performerType === 'Ремонт') {
      return 'renovation';
    }
    return 'master';
  }

  async loadApprovedReviews(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadingSignal.set(true);

    try {
      const client = await this.supabase.getClient();
      if (!client) {
        return;
      }

      const { data, error } = await client
        .from(environment.supabase.reviewsTable)
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadApprovedReviews', error);
        return;
      }

      const approved = (data as ReviewRow[] | null)?.map((row) => this.mapRow(row, 'approved')) ?? [];
      this.reviewsSignal.update((current) => {
        const pending = current.filter((review) => review.status === 'pending');
        return [...pending, ...approved];
      });
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async loadPendingReviews(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadingSignal.set(true);

    try {
      const client = await this.supabase.getClient();
      if (!client) {
        return;
      }

      const { data, error } = await client
        .from(environment.supabase.reviewsTable)
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadPendingReviews', error);
        return;
      }

      const pending = (data as ReviewRow[] | null)?.map((row) => this.mapRow(row, 'pending')) ?? [];
      this.reviewsSignal.update((current) => {
        const approved = current.filter((review) => review.status === 'approved');
        return [...pending, ...approved];
      });
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async addReview(data: {
    name: string;
    performerType: ReviewSubmission['performerType'];
    performerTypeKey?: ReviewPerformerTypeKey;
    category: string;
    performerId?: string;
    review: string;
    rating?: number;
    beforeImage?: string;
    afterImage?: string;
    kind?: ReviewSubmission['kind'];
  }): Promise<ReviewSubmission | null> {
    const performerTypeKey: ReviewPerformerTypeKey =
      data.performerTypeKey ??
      this.resolvePerformerTypeKey({ performerType: data.performerType } as ReviewSubmission);

    const client = await this.supabase.getClient();
    if (!client) {
      logSupabaseError('addReview', new Error('Supabase is not configured'));
      return null;
    }

    const row = {
      master_id: data.performerId ?? null,
      client_name: data.name.trim(),
      review_text: data.review.trim(),
      rating: data.rating ?? null,
      kind: data.kind ?? 'review',
      performer_type: data.performerType,
      performer_type_key: performerTypeKey,
      performer_name: data.category,
      before_image: data.beforeImage ?? null,
      after_image: data.afterImage ?? null,
      is_approved: false,
    };

    const { data: inserted, error } = await client
      .from(environment.supabase.reviewsTable)
      .insert([row])
      .select('*')
      .single();

    if (error || !inserted) {
      logSupabaseError('addReview', error ?? new Error('Insert failed'));
      return null;
    }

    const submission = this.mapRow(inserted as ReviewRow, 'pending');
    this.reviewsSignal.update((list) => [submission, ...list]);
    return submission;
  }

  async approveReview(id: string): Promise<void> {
    const review = this.reviewsSignal().find((item) => item.id === id);
    if (!review || review.status === 'approved') {
      return;
    }

    const client = await this.supabase.getClient();
    if (!client) {
      return;
    }

    const { error } = await client
      .from(environment.supabase.reviewsTable)
      .update({ is_approved: true })
      .eq('id', id);

    if (error) {
      logSupabaseError('approveReview', error);
      return;
    }

    this.reviewsSignal.update((list) =>
      list.map((item) => (item.id === id ? { ...item, status: 'approved' } : item)),
    );
    this.addPublicationNotification(review);
  }

  async rejectReview(id: string): Promise<void> {
    const client = await this.supabase.getClient();
    if (!client) {
      return;
    }

    const { error } = await client.from(environment.supabase.reviewsTable).delete().eq('id', id);

    if (error) {
      logSupabaseError('rejectReview', error);
      return;
    }

    this.reviewsSignal.update((list) => list.filter((review) => review.id !== id));
  }

  private mapRow(row: ReviewRow, status: ReviewSubmission['status']): ReviewSubmission {
    const performerType = (row.performer_type ??
      'Мастер') as ReviewSubmission['performerType'];
    const performerTypeKey = (row.performer_type_key ??
      'master') as ReviewPerformerTypeKey;

    const submission: ReviewSubmission = {
      id: row.id,
      name: row.client_name,
      performerType,
      performerTypeKey,
      category: row.performer_name ?? '',
      review: row.review_text,
      status,
      createdAt: row.created_at,
      kind: row.kind === 'recommendation' ? 'recommendation' : 'review',
    };

    if (row.master_id) {
      submission.performerId = row.master_id;
    }
    if (row.rating) {
      submission.rating = row.rating;
    }
    if (row.before_image) {
      submission.beforeImage = row.before_image;
    }
    if (row.after_image) {
      submission.afterImage = row.after_image;
    }

    return submission;
  }

  private addPublicationNotification(review: ReviewSubmission): void {
    const kindLabel = this.isRecommendation(review)
      ? this.translation.t('reviewsPage.kind.recommendation')
      : this.translation.t('reviewsPage.kind.review');
    const notification: ReviewNotification = {
      id: `notification-${Date.now()}`,
      reviewId: review.id,
      message: `${kindLabel}: "${review.category}" — ${review.name}.`,
      link: '/reviews',
      createdAt: new Date().toISOString(),
    };

    this.notificationsSignal.update((list) => [notification, ...list]);
  }
}
