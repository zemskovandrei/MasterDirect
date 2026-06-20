import { Component, PLATFORM_ID, inject, signal, ChangeDetectionStrategy } from '@angular/core';
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
export class ModerationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly loginError = signal(false);
  protected readonly submitting = signal(false);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor() {
    if (isPlatformBrowser(this.platformId) && this.adminAuth.isAdmin()) {
      void this.reviewStore.loadPendingReviews();
    }
  }

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

  approveReview(reviewId: string) {
    void this.reviewStore.approveReview(reviewId);
  }

  rejectReview(reviewId: string) {
    void this.reviewStore.rejectReview(reviewId);
  }
}
