import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  styleUrls: ['./moderation.component.css'],
})
export class ModerationComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly loginError = signal(false);

  protected readonly loginForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  submitLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const ok = this.adminAuth.login(this.loginForm.getRawValue().password);
    this.loginError.set(!ok);
    if (ok) {
      this.loginForm.reset();
    }
  }

  logout() {
    this.adminAuth.logout();
    this.loginError.set(false);
  }

  approveReview(reviewId: string) {
    this.reviewStore.approveReview(reviewId);
  }

  rejectReview(reviewId: string) {
    this.reviewStore.rejectReview(reviewId);
  }
}
