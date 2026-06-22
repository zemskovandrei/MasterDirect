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
import { AdminAuthService } from './admin-auth.service';
import { logSupabaseError } from '../utils/supabase-error.util';

/** Маркер в `review_text` для предложений по улучшению сайта (без отдельной колонки в БД). */
export const SITE_FEEDBACK_TEXT_PREFIX = '【site-feedback】';

/**
 * Отзывы из `site_reviews` (колонки: id, created_at, user_name, review_text).
 */
@Injectable({ providedIn: 'root' })
export class ReviewStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly translation = inject(TranslationService);
  private readonly supabase = inject(SupabaseService);
  private readonly adminAuth = inject(AdminAuthService);

  private readonly reviewsSignal = signal<ReviewSubmission[]>([]);
  private readonly notificationsSignal = signal<ReviewNotification[]>([]);
  private readonly loadingSignal = signal(false);

  readonly reviews = this.reviewsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly pendingReviews = computed(() =>
    this.reviewsSignal().filter((review) => review.status === 'pending'),
  );
  readonly approvedReviews = computed(() =>
    this.reviewsSignal().filter(
      (review) =>
        review.status === 'approved' && (this.adminAuth.isAdmin() || review.kind !== 'siteFeedback'),
    ),
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

  isSiteFeedback(review: ReviewSubmission): boolean {
    return review.kind === 'siteFeedback';
  }

  submissionKindLabel(review: ReviewSubmission): string {
    this.translation.locale();
    if (this.isSiteFeedback(review)) {
      return this.translation.t('reviewsPage.kind.siteFeedback');
    }
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
    if (review.performerType === 'Сайт') {
      return 'site';
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
        .from('site_reviews')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadApprovedReviews', error);
        return;
      }

      const approved =
        (data as ReviewRow[] | null)?.map((row) => this.mapRow(row, 'approved')) ?? [];
      this.reviewsSignal.set(approved);
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
        .from('site_reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logSupabaseError('loadPendingReviews', error);
        return;
      }

      const rows = (data as ReviewRow[] | null) ?? [];
      const pending = rows
        .filter((row) => row.is_approved !== true)
        .map((row) => this.mapRow(row, 'pending'));
      const approved = rows
        .filter((row) => row.is_approved === true)
        .map((row) => this.mapRow(row, 'approved'));

      this.reviewsSignal.set([...pending, ...approved]);
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
    const client = await this.supabase.getClient();
    if (!client) {
      logSupabaseError('addReview', new Error('Supabase is not configured'));
      return null;
    }

    const trimmedText = data.review.trim();
    const reviewText =
      data.kind === 'siteFeedback'
        ? `${SITE_FEEDBACK_TEXT_PREFIX}\n${trimmedText}`
        : trimmedText;

    const row = {
      user_name: data.name.trim(),
      review_text: reviewText,
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

    const submission = this.mapRow(inserted as ReviewRow, 'pending', data);
    this.reviewsSignal.update((list) => [submission, ...list]);
    this.addSubmissionNotification(submission);
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
      .from('site_reviews')
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
    await this.deleteReview(id);
  }

  async deleteReview(id: string): Promise<void> {
    const client = await this.supabase.getClient();
    if (!client) {
      return;
    }

    const { error } = await client.from('site_reviews').delete().eq('id', id);

    if (error) {
      logSupabaseError('deleteReview', error);
      return;
    }

    this.reviewsSignal.update((list) => list.filter((review) => review.id !== id));
  }

  private mapRow(
    row: ReviewRow,
    status: ReviewSubmission['status'],
    source?: {
      performerType?: ReviewSubmission['performerType'];
      performerTypeKey?: ReviewPerformerTypeKey;
      category?: string;
      performerId?: string;
      rating?: number;
      beforeImage?: string;
      afterImage?: string;
      kind?: ReviewSubmission['kind'];
    },
  ): ReviewSubmission {
    const decoded = this.decodeReviewText(row.review_text);
    const performerType = (source?.performerType ??
      row.performer_type ??
      (decoded.kind === 'siteFeedback' ? 'Сайт' : 'Мастер')) as ReviewSubmission['performerType'];
    const performerTypeKey = (source?.performerTypeKey ??
      row.performer_type_key ??
      (decoded.kind === 'siteFeedback' ? 'site' : 'master')) as ReviewPerformerTypeKey;
    const clientName = row.client_name?.trim() || row.user_name?.trim() || '';
    const kind =
      source?.kind ??
      (row.kind === 'recommendation'
        ? 'recommendation'
        : row.kind === 'siteFeedback'
          ? 'siteFeedback'
          : decoded.kind);

    const submission: ReviewSubmission = {
      id: row.id,
      name: clientName,
      performerType,
      performerTypeKey,
      category:
        source?.category ??
        row.performer_name ??
        (kind === 'siteFeedback'
          ? this.translation.t('reviewsPage.siteFeedback.categoryLabel')
          : ''),
      review: decoded.text,
      status,
      createdAt: row.created_at ?? new Date().toISOString(),
      kind,
    };

    if (row.master_id) {
      submission.performerId = row.master_id;
    } else if (source?.performerId) {
      submission.performerId = source.performerId;
    }
    const rating = source?.rating ?? row.rating;
    if (rating) {
      submission.rating = rating;
    }
    const beforeImage = source?.beforeImage ?? row.before_image;
    if (beforeImage) {
      submission.beforeImage = beforeImage;
    }
    const afterImage = source?.afterImage ?? row.after_image;
    if (afterImage) {
      submission.afterImage = afterImage;
    }

    return submission;
  }

  private decodeReviewText(raw: string): { text: string; kind?: ReviewSubmission['kind'] } {
    const value = raw?.trim() ?? '';
    if (value.startsWith(SITE_FEEDBACK_TEXT_PREFIX)) {
      return {
        kind: 'siteFeedback',
        text: value.slice(SITE_FEEDBACK_TEXT_PREFIX.length).trim(),
      };
    }
    return { text: value };
  }

  private addSubmissionNotification(review: ReviewSubmission): void {
    const kindLabel = this.submissionKindLabel(review);
    const target =
      review.kind === 'siteFeedback'
        ? this.translation.t('reviewsPage.siteFeedback.notificationTarget')
        : review.category;
    const notification: ReviewNotification = {
      id: `notification-${Date.now()}`,
      reviewId: review.id,
      message: `${kindLabel}: "${target}" — ${review.name}.`,
      link: '/reviews',
      createdAt: new Date().toISOString(),
    };

    this.notificationsSignal.update((list) => [notification, ...list]);
  }

  private addPublicationNotification(review: ReviewSubmission): void {
    this.addSubmissionNotification(review);
  }
}
