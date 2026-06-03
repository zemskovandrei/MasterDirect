import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  PerformerType,
  SUBSCRIPTION_PLANS,
} from '../../core/models/portfolio.models';
import { TranslationService } from '../../core/services/translation.service';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';

@Component({
  selector: 'app-cabinet',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BeforeAfterComponent],
  templateUrl: './cabinet.component.html',
  styleUrls: ['./cabinet.component.css'],
})
export class CabinetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly store = inject(PortfolioStoreService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translationService = inject(TranslationService);
  protected readonly plans = SUBSCRIPTION_PLANS;

  protected readonly uploadSuccess = signal(false);
  protected readonly selectedPlan = signal<PerformerType>('worker');
  protected readonly activeSection = signal<'profile' | 'moderation'>(
    this.router.url.includes('/moderation') ? 'moderation' : 'profile',
  );
  protected readonly notifications = this.reviewStore.notifications;

  protected readonly registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    specialty: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10)]],
  });

  protected readonly workForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    description: [''],
  });

  protected beforePreview = signal<string | null>(null);
  protected afterPreview = signal<string | null>(null);

  selectPlan(type: PerformerType) {
    this.selectedPlan.set(type);
  }

  register() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const v = this.registerForm.getRawValue();
    this.store.registerPerformer({ ...v, type: this.selectedPlan() });
  }

  subscribe() {
    const performer = this.store.currentPerformer();
    if (!performer) {
      return;
    }
    this.store.activateSubscription(performer.id);
  }

  onFileSelected(side: 'before' | 'after', event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 800_000) {
      alert(this.translationService.translate('cabinet.errors.largeFile'));
      input.value = '';
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

  uploadWork() {
    const performer = this.store.currentPerformer();
    if (!performer?.subscribed) {
      return;
    }

    if (this.workForm.invalid) {
      this.workForm.markAllAsTouched();
      return;
    }

    const before = this.beforePreview();
    const after = this.afterPreview();
    if (!before || !after) {
      alert(this.translationService.translate('cabinet.errors.missingPhotos'));
      return;
    }

    const v = this.workForm.getRawValue();
    const work = this.store.addWork(performer.id, {
      title: v.title,
      description: v.description,
      beforeImage: before,
      afterImage: after,
    });

    if (work) {
      this.uploadSuccess.set(true);
      this.workForm.reset();
      this.beforePreview.set(null);
      this.afterPreview.set(null);
      setTimeout(() => this.uploadSuccess.set(false), 4000);
    }
  }

  signOut() {
    this.store.signOut();
    this.selectedPlan.set('worker');
    this.registerForm.reset();
    this.beforePreview.set(null);
    this.afterPreview.set(null);
  }

  approveReview(reviewId: string) {
    this.reviewStore.approveReview(reviewId);
  }

  rejectReview(reviewId: string) {
    this.reviewStore.rejectReview(reviewId);
  }

  planPrice(type: PerformerType): number {
    return this.plans[type].priceUsd;
  }

  registerFieldInvalid(field: 'name' | 'specialty' | 'description'): boolean {
    const control = this.registerForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  planIcon(type: PerformerType): string {
    return type === 'brigade' ? '👷' : '🔧';
  }

  setSection(section: 'profile' | 'moderation') {
    this.activeSection.set(section);
  }
}
