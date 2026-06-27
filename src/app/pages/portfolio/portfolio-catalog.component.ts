import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { TranslationService } from '../../core/services/translation.service';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { ReviewSubmission } from '../../core/models/portfolio.models';
import { AdminAuthService } from '../../core/services/admin-auth.service';

@Component({
  selector: 'app-portfolio-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portfolio-catalog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../styles/catalog-pages.css', './portfolio-catalog.component.css'],
})
export class PortfolioCatalogComponent implements OnInit {
  protected readonly supabase = inject(SupabaseService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly adminAuth = inject(AdminAuthService);

  protected readonly pageBackground = catalogTabBackgroundStyle('catalogHub');

  ngOnInit(): void {
    this.supabase.loadProfiles().subscribe();
    if (this.adminAuth.isAdmin()) {
      void this.reviewStore.loadPendingReviews();
      return;
    }
    void this.reviewStore.loadApprovedReviews();
  }

  protected visibleReviews(): ReviewSubmission[] {
    if (this.adminAuth.isAdmin()) {
      return this.reviewStore.reviews().filter((review) => review.status !== 'rejected');
    }
    return this.reviewStore.approvedReviews();
  }

  protected canPublishReview(review: ReviewSubmission): boolean {
    return review.status === 'pending';
  }

  protected reviewStatusLabel(review: ReviewSubmission): string {
    return review.status === 'approved' ? 'Опубликован' : 'На модерации';
  }

  protected publishReview(reviewId: string): void {
    void this.reviewStore.publishReview(reviewId);
  }

  protected reviewBackgroundClass(review: ReviewSubmission): string {
    const text = `${review.category} ${review.review} ${review.performerType}`.toLowerCase();

    if (text.includes('плит') || text.includes('кафел')) {
      return 'review-card--bg-tile';
    }

    if (text.includes('элект')) {
      return 'review-card--bg-electric';
    }

    if (text.includes('сантех') || text.includes('труб')) {
      return 'review-card--bg-plumbing';
    }

    if (text.includes('мебел')) {
      return 'review-card--bg-furniture';
    }

    if (text.includes('ремонт') || text.includes('отдел')) {
      return 'review-card--bg-renovation';
    }

    return 'review-card--bg-general';
  }

  protected deleteReview(reviewId: string): void {
    void this.reviewStore.deleteReview(reviewId);
  }
}
