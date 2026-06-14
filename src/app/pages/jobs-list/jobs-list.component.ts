import { Component, Inject, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Job, jobPhoneHref, jobTelegramHref } from '../../models/job.model';
import { TranslationService } from '../../core/services/translation.service';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { logSupabaseError } from '../../core/utils/supabase-error.util';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './jobs-list.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './jobs-list.component.css'],
})
export class JobsListComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);

  protected readonly pageBackground = catalogTabBackgroundStyle('jobs');

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {}

  readonly isLoading = this.supabase.jobsLoading;
  readonly error = this.supabase.jobsError;
  readonly jobs = this.supabase.activeJobs;
  readonly accessDenied = this.supabase.jobsAccessDenied;

  protected readonly adminActionJobId = signal<string | null>(null);
  protected readonly adminActionError = signal<string | null>(null);
  protected readonly loginError = signal(false);
  protected readonly loginSubmitting = signal(false);

  protected readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.initBrowserJobs();
  }

  private async initBrowserJobs(): Promise<void> {
    await this.auth.ensureInitialized();
    await this.adminAuth.ensureReady();
    await this.loadJobs();
  }

  protected async loadJobs(force = false): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      if (this.adminAuth.isAdmin()) {
        await this.supabase.loadActiveJobs(force);
        return;
      }

      await this.supabase.loadJobsForAuthenticatedMaster(force);
    } catch (err) {
      logSupabaseError('JobsList.loadJobs', err);
    }
  }

  protected reloadJobs(): void {
    void this.loadJobs(true);
  }

  protected adminLogout(): void {
    void this.adminAuth.logout();
    this.adminActionError.set(null);
    void this.loadJobs(true);
  }

  protected async submitMasterLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loginSubmitting.set(true);
    this.loginError.set(false);

    const { email, password } = this.loginForm.getRawValue();
    const result = await this.auth.signIn(email, password);

    this.loginSubmitting.set(false);

    if (result.error || !result.user) {
      this.loginError.set(true);
      return;
    }

    this.loginForm.reset();
    await this.loadJobs(true);
  }

  protected isJobAdminBusy(jobId: string): boolean {
    return this.adminActionJobId() === jobId;
  }

  async completeJob(job: Job): Promise<void> {
    if (!job.id?.trim() || this.isJobAdminBusy(job.id)) {
      return;
    }

    const confirmed = window.confirm(
      this.translation.t('admin.jobs.completeConfirm').replace('{{title}}', this.displayTitle(job)),
    );
    if (!confirmed) {
      return;
    }

    this.adminActionJobId.set(job.id);
    this.adminActionError.set(null);

    try {
      const result = await firstValueFrom(this.supabase.completeJobklientJob(job.id));
      if (result.error) {
        this.adminActionError.set(this.translation.t('admin.jobs.actionError'));
        console.error('[JobsListComponent] completeJob:', result.error);
      }
    } catch (err) {
      this.adminActionError.set(this.translation.t('admin.jobs.actionError'));
      console.error('[JobsListComponent] completeJob:', err);
    } finally {
      this.adminActionJobId.set(null);
    }
  }

  async deleteJob(job: Job): Promise<void> {
    if (!job.id?.trim() || this.isJobAdminBusy(job.id)) {
      return;
    }

    const confirmed = window.confirm(
      this.translation.t('admin.jobs.deleteConfirm').replace('{{title}}', this.displayTitle(job)),
    );
    if (!confirmed) {
      return;
    }

    this.adminActionJobId.set(job.id);
    this.adminActionError.set(null);

    try {
      const result = await firstValueFrom(this.supabase.deleteJob(job.id));
      if (result.error) {
        this.adminActionError.set(this.translation.t('admin.jobs.actionError'));
        console.error('Jobklient delete error:', result.error);
      }
    } catch (err) {
      this.adminActionError.set(this.translation.t('admin.jobs.actionError'));
      console.error('Jobklient delete error:', err);
    } finally {
      this.adminActionJobId.set(null);
    }
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
