import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { WorkVerificationStatus } from '../../core/models/portfolio.models';

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

  protected readonly pageState = signal<PageState>('loading');
  protected readonly performerName = signal('');
  protected readonly workTitle = signal('');
  protected readonly workDescription = signal('');
  protected readonly resultStatus = signal<WorkVerificationStatus | null>(null);
  protected readonly submitting = signal(false);

  private token = '';

  constructor() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    const context = this.store.getVerificationContext(this.token);

    if (!context) {
      this.pageState.set('invalid');
      return;
    }

    this.performerName.set(context.performer.name);
    this.workTitle.set(context.work.title);
    this.workDescription.set(context.work.description);
    this.pageState.set('ready');
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
