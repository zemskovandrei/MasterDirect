import { Component, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { Job, jobPhoneHref, jobTelegramHref } from '../../models/job.model';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './jobs-list.component.html',
  styleUrl: './jobs-list.component.css',
})
export class JobsListComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);

  readonly isLoading = this.supabase.jobsLoading;
  readonly error = this.supabase.jobsError;
  readonly jobs = this.supabase.activeJobs;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      void this.supabase.loadActiveJobs().catch(() => {
        // Error state is handled in the service.
      });
    }
  }

  protected reloadJobs(): void {
    void this.supabase.loadActiveJobs(true);
  }

  protected displayTitle(job: Job): string {
    if (job.title === 'Без названия') {
      return this.translation.t('jobs.noTitle');
    }
    return job.title;
  }

  protected displayBudget(job: Job): string {
    return job.budgetLabel === '—' ? this.translation.t('jobs.budgetUnknown') : job.budgetLabel;
  }

  protected displayStatus(job: Job): string {
    const status = job.status.toLowerCase();
    if (status === 'new') {
      return this.translation.t('jobs.statusNew');
    }
    return this.translation.t('jobs.statusActive');
  }

  protected displayArea(job: Job): string | null {
    if (job.details.areaSqm == null) {
      return null;
    }

    return this.translation
      .t('jobs.areaValue')
      .replace('{{value}}', String(job.details.areaSqm));
  }

  protected displaySummary(job: Job): string {
    const summary = job.details.summary.trim();
    if (summary && summary !== job.description.trim()) {
      return summary;
    }

    if (summary) {
      return summary;
    }

    return job.description.trim();
  }

  protected hasSummary(job: Job): boolean {
    return this.displaySummary(job).length > 0;
  }

  protected phoneHref(job: Job): string | null {
    return jobPhoneHref(job.details.contact);
  }

  protected telegramHref(job: Job): string | null {
    return jobTelegramHref(job.details.contact);
  }

  protected hasContactActions(job: Job): boolean {
    return !!(this.phoneHref(job) || this.telegramHref(job));
  }

  trackByJobId(_index: number, job: Job): string {
    return job.id;
  }
}
