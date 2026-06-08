import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  PortfolioStoreService,
  WorkVerificationContext,
} from '../../core/services/portfolio-store.service';
import { WorkVerificationStatus } from '../../core/models/portfolio.models';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';

type PageState = 'loading' | 'ready' | 'done' | 'invalid';

@Component({
  selector: 'app-work-verification',
  standalone: true,
  templateUrl: './work-verification.component.html',
  styleUrls: ['./work-verification.component.css'],
})
export class WorkVerificationComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PortfolioStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

  protected readonly pageState = signal<PageState>('loading');
  protected readonly context = signal<WorkVerificationContext | null>(null);
  protected readonly resultStatus = signal<WorkVerificationStatus | null>(null);
  protected readonly submitting = signal(false);

  private token = '';

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    const ctx = this.store.getVerificationContext(this.token);

    if (!ctx) {
      this.pageState.set('invalid');
      return;
    }

    this.context.set(ctx);
    this.pageState.set('ready');
  }

  workTitle(): string {
    const ctx = this.context();
    return ctx ? this.catalogL10n.workTitle(ctx.work) : '';
  }

  workDescription(): string {
    const ctx = this.context();
    return ctx ? this.catalogL10n.workDescription(ctx.work) : '';
  }

  thanksMessage(): string {
    return this.translation
      .t('verification.thanksLead')
      .replace('{{title}}', this.workTitle());
  }

  verifyLead(): string {
    const ctx = this.context();
    if (!ctx) {
      return '';
    }
    return this.translation
      .t('verification.lead')
      .replace('{{performer}}', ctx.performer.name)
      .replace('{{work}}', this.workTitle());
  }

  confirm() {
    this.respond('confirm');
  }

  reject() {
    this.respond('reject');
  }

  private respond(action: 'confirm' | 'reject') {
    if (this.submitting() || this.pageState() !== 'ready') {
      return;
    }

    this.submitting.set(true);
    const result = this.store.respondToVerification(this.token, action);
    this.submitting.set(false);

    if (!result) {
      this.pageState.set('invalid');
      return;
    }

    this.resultStatus.set(result.status);
    this.pageState.set('done');
  }
}
