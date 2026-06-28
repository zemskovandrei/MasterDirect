import { Component, PLATFORM_ID, OnInit, OnDestroy, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-moderation',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './moderation.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./moderation.component.css'],
})
export class ModerationComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly loginError = signal(false);
  protected readonly submitting = signal(false);

  private autoRefreshInterval: ReturnType<typeof setInterval> | null = null;

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId) && this.adminAuth.isAdmin()) {
      void this.reviewStore.loadPendingReviews();
      this.startAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
  }

  private startAutoRefresh(): void {
    if (!isPlatformBrowser(this.platformId) || this.autoRefreshInterval) {
      return;
    }

    this.autoRefreshInterval = setInterval(() => {
      if (this.adminAuth.isAdmin()) {
        void this.reviewStore.loadPendingReviews();
      } else {
        this.stopAutoRefresh();
      }
    }, 10000);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  constructor() {}

  async submitLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.loginError.set(false);

    const { email, password } = this.loginForm.getRawValue();
    const ok = await this.adminAuth.login(email, password);

    this.submitting.set(false);
    this.loginError.set(!ok);

    if (ok) {
      this.loginForm.reset();
      await this.reviewStore.loadPendingReviews();
    }
  }

  logout() {
    void this.adminAuth.logout();
    this.loginError.set(false);
  }

  async publishReview(reviewId: string): Promise<void> {
    try {
      console.info('Moderation: publish review clicked', { reviewId });
      await this.reviewStore.publishReview(reviewId);
    } catch (error) {
      console.error('Moderation: failed to publish review', { reviewId, error });
    }
  }

  deleteReview(reviewId: string) {
    void this.reviewStore.rejectReview(reviewId);
  }
}
