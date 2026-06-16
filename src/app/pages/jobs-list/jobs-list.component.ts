import { Component, Inject, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Job, isCompletedOrderStatus, jobPhoneHref, jobTelegramHref } from '../../models/job.model';
import { TranslationService } from '../../core/services/translation.service';
import { CATALOG_TAB_BACKGROUNDS, calculatorSectionBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { RenovationCalculatorComponent } from '../../shared/components/renovation-calculator/renovation-calculator.component';
import { logSupabaseError } from '../../core/utils/supabase-error.util';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterLink, RenovationCalculatorComponent],
  templateUrl: './jobs-list.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './jobs-list.component.css'],
})
export class JobsListComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);

  protected readonly showcaseBackground = {
    backgroundColor: '#080808',
    backgroundImage: `linear-gradient(90deg, rgba(8, 8, 8, 0.12) 0%, rgba(8, 8, 8, 0.78) 46%, rgba(8, 8, 8, 0.97) 100%), url('${CATALOG_TAB_BACKGROUNDS.jobs}')`,
    backgroundSize: 'cover',
    backgroundPosition: 'left center',
    backgroundRepeat: 'no-repeat',
  };

  protected readonly calculatorBackground = calculatorSectionBackgroundStyle();

  private readonly showcaseFallbackImages = [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=800',
  ];

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {}

  readonly isLoading = this.supabase.jobsLoading;
  readonly error = this.supabase.jobsError;
  readonly jobs = this.supabase.activeJobs;

  protected readonly adminActionJobId = signal<string | null>(null);
  protected readonly adminActionError = signal<string | null>(null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    void this.initBrowserJobs();
  }

  private async initBrowserJobs(): Promise<void> {
    await this.auth.ensureInitialized();
    await this.adminAuth.ensureReady();
    await this.loadJobs(true);
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

  protected isJobAdminBusy(jobId: string): boolean {
    return this.adminActionJobId() === jobId;
  }

  protected isOrderCompleted(order: Job): boolean {
    return isCompletedOrderStatus(order.status);
  }

  protected completeOrder(order: Job): void {
    const id = order?.id;
    console.log('[JobsListComponent] Кликнули выполнить для ID:', id);

    if (id == null || String(id).trim() === '') {
      console.warn('[JobsListComponent] Ошибка: ID заказа пустой!');
      return;
    }

    const orderId = Math.trunc(Number(id));
    console.log('[JobsListComponent] completeOrder parsed id:', { raw: id, numeric: orderId });

    if (!Number.isFinite(orderId) || orderId <= 0 || this.isJobAdminBusy(String(id))) {
      console.error('[JobsListComponent] completeOrder invalid id:', id, '→', orderId);
      return;
    }

    const confirmed = window.confirm(
      this.translation.t('admin.jobs.completeConfirm').replace('{{title}}', order.title),
    );
    if (!confirmed) {
      return;
    }

    this.adminActionJobId.set(String(id));
    this.adminActionError.set(null);

    this.supabase.completeOrder(orderId).subscribe({
      next: (result) => {
        if (result.error) {
          this.adminActionError.set(this.translation.t('admin.jobs.actionError'));
          console.error('[JobsListComponent] completeOrder:', result.error);
          return;
        }

        void this.loadJobs(true);
      },
      error: (err) => {
        this.adminActionError.set(this.translation.t('admin.jobs.actionError'));
        logSupabaseError('JobsListComponent.completeOrder', err);
      },
      complete: () => {
        this.adminActionJobId.set(null);
      },
    });
  }

  async deleteJob(order: Job): Promise<void> {
    if (!order.id?.trim() || this.isJobAdminBusy(order.id)) {
      return;
    }

    const confirmed = window.confirm(
      this.translation.t('admin.jobs.deleteConfirm').replace('{{title}}', order.title),
    );
    if (!confirmed) {
      return;
    }

    this.adminActionJobId.set(order.id);
    this.adminActionError.set(null);

    try {
      const result = await firstValueFrom(this.supabase.deleteJob(order.id));
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

  protected formatOrderBudget(order: Job): string {
    if (order.budget != null && Number.isFinite(order.budget)) {
      try {
        return `${new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 0 }).format(order.budget)} ₾`;
      } catch {
        return `${Math.round(order.budget)} ₾`;
      }
    }

    if (order.budgetLabel && order.budgetLabel !== '—') {
      return order.budgetLabel;
    }

    return this.translation.t('jobs.budgetUnknown');
  }

  protected phoneHref(order: Job): string | null {
    return jobPhoneHref(order.details.contact);
  }

  protected telegramHref(order: Job): string | null {
    return jobTelegramHref(order.details.contact);
  }

  protected hasContactActions(order: Job): boolean {
    return !!(this.phoneHref(order) || this.telegramHref(order));
  }

  protected jobCardImage(order: Job, index: number): string {
    const link = order.details.photoLink?.trim();
    if (link && /^https?:\/\//i.test(link) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(link)) {
      return link;
    }

    return this.showcaseFallbackImages[index % this.showcaseFallbackImages.length];
  }

  trackByJobId(_index: number, order: Job): string {
    return order.id;
  }
}
