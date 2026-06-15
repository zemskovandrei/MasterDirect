import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SupabaseService } from '../../../core/services/supabase.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-site-review-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './site-review-modal.component.html',
  styleUrls: ['./site-review-modal.component.css'],
})
export class SiteReviewModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);

  readonly open = input(false);

  readonly closed = output<void>();

  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitSuccess = signal(false);

  protected readonly reviewForm = this.fb.nonNullable.group({
    userName: ['', [Validators.required, Validators.minLength(2)]],
    reviewText: ['', [Validators.required, Validators.minLength(10)]],
  });

  fieldInvalid(field: 'userName' | 'reviewText'): boolean {
    const control = this.reviewForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  async submitReview() {
    if (this.submitting()) {
      return;
    }

    this.reviewForm.markAllAsTouched();
    if (this.reviewForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(false);

    const { userName, reviewText } = this.reviewForm.getRawValue();
    const result = await this.supabase.insertSiteReview(userName, reviewText);

    this.submitting.set(false);

    if (result.error) {
      this.submitError.set(result.error);
      return;
    }

    this.submitSuccess.set(true);
    this.reviewForm.reset();
    window.setTimeout(() => this.close(), 1800);
  }

  close() {
    this.submitError.set(null);
    this.submitSuccess.set(false);
    this.reviewForm.reset();
    this.closed.emit();
  }
}
