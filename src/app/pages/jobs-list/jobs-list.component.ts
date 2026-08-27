import {
  Component,
  Inject,
  OnInit,
  PLATFORM_ID,
  inject,
  computed,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Job, isCompletedOrderStatus, jobPhoneHref, jobScopeItemCount, jobTelegramHref, resolveJobPhotoForJob } from '../../models/job.model';
import { TranslationService } from '../../core/services/translation.service';
import {
  catalogTabBackgroundStyle,
} from '../../core/constants/catalog-tab-backgrounds';
import { CatalogOrderCalculatorSectionComponent } from '../../shared/components/catalog-order-calculator-section/catalog-order-calculator-section.component';
import { logSupabaseError } from '../../core/utils/supabase-error.util';
import { normalizeSearchText } from '../../core/utils/catalog-filter.util';

@Component({
  selector: 'app-jobs-list',
  standalone: true,
  imports: [CommonModule, RouterLink, CatalogOrderCalculatorSectionComponent],
  templateUrl: './jobs-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../styles/catalog-pages.css', './jobs-list.component.css'],
})
export class JobsListComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);
  private readonly route = inject(ActivatedRoute);

  protected readonly pageBackground = catalogTabBackgroundStyle('jobs');

  private readonly showcaseFallbackImages = [
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=800',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=800',
  ];

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {}

  readonly isLoading = this.supabase.jobsLoading;
  readonly error = this.supabase.jobsError;
  readonly jobs = this.supabase.activeJobs;
  protected readonly hiddenJobIds = signal<Set<string>>(new Set());
  protected readonly searchQuery = signal('');
  protected readonly visibleJobs = computed(() => {
    const hidden = this.hiddenJobIds();
    const query = normalizeSearchText(this.searchQuery());
    return this.jobs().filter((job) => {
      if (hidden.has(job.id)) {
        return false;
      }
      if (!query) {
        return true;
      }
      return normalizeSearchText(
        `${job.title} ${job.category} ${job.description} ${job.city}`,
      ).includes(query);
    });
  });

  protected readonly adminActionJobId = signal<string | null>(null);
  protected readonly adminActionError = signal<string | null>(null);
  protected readonly photoPreview = signal<{ src: string; title: string } | null>(null);

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.searchQuery.set(params.get('q') ?? '');
    });

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
      await this.supabase.loadActiveJobs(force);
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

  protected canDeleteOrder(order: Job): boolean {
    if (this.adminAuth.isAdmin()) {
      return true;
    }

    const userId = this.auth.user()?.id;
    return !!userId && !!order.userId && order.userId === userId;
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

  async deleteJob(orderOrId: Job | string): Promise<void> {
    const order =
      typeof orderOrId === 'string'
        ? this.jobs().find((item) => item.id === orderOrId)
        : orderOrId;

    if (!order?.id?.trim() || this.isJobAdminBusy(order.id)) {
      console.error('Jobklient delete error: Missing job id');
      return;
    }

    if (!this.canDeleteOrder(order)) {
      console.error('Jobklient delete error: insufficient permissions', order.id);
      return;
    }

    const confirmed = window.confirm(
      this.translation.t('admin.jobs.deleteConfirm').replace('{{title}}', order.title),
    );
    if (!confirmed) {
      return;
    }

    this.hiddenJobIds.update((current) => {
      const next = new Set(current);
      next.add(order.id);
      return next;
    });
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

  protected jobOrderPhotoSrc(order: Job): string | null {
    return resolveJobPhotoForJob(order);
  }

  protected jobHasPhoto(order: Job): boolean {
    return !!this.jobOrderPhotoSrc(order);
  }

  protected jobCardImage(order: Job, index: number): string {
    const resolved = this.jobOrderPhotoSrc(order);
    if (resolved) {
      return resolved;
    }

    return this.showcaseFallbackImages[index % this.showcaseFallbackImages.length];
  }

  protected jobCardMeta(order: Job): string {
    const parts: string[] = [];

    if (order.details.areaSqm != null) {
      parts.push(`${order.details.areaSqm} m²`);
    }

    if (order.city?.trim()) {
      parts.push(order.city.trim());
    }

    if (order.category?.trim()) {
      parts.push(order.category.trim());
    }

    return parts.join(' · ');
  }

  protected jobScopeCount(order: Job): number {
    return jobScopeItemCount(order.details.scopeSections);
  }

  protected scopeItemsLabel(count: number): string {
    return this.translation.t('jobs.scopeItems').replace('{{count}}', String(count));
  }

  protected openPhotoPreview(order: Job): void {
    const src = this.jobOrderPhotoSrc(order);
    if (!src) {
      return;
    }

    this.photoPreview.set({ src, title: order.title });
  }

  protected closePhotoPreview(): void {
    this.photoPreview.set(null);
  }

  trackByJobId(_index: number, order: Job): string {
    return order.id;
  }
}
