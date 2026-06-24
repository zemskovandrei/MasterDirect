import {
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogAdminService } from '../../core/services/catalog-admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PerformerProfile } from '../../core/models/portfolio.models';
import { DataService } from '../../core/services/data.service';
import type { Specialist } from '../../core/models/database.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import {
  saveCatalogSelection,
  readCatalogSelection,
} from '../../core/utils/catalog-selection.util';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { isPerformerBusy, getPerformerBusyStatus } from '../../core/utils/performer-busy.util';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-masters-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    BeforeAfterComponent,
    SocialLinksComponent,
  ],
  templateUrl: './masters-page.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../styles/catalog-pages.css', './masters-page.component.css'],
})
export class MastersPageComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly supabase = inject(SupabaseService);
  private readonly dataService = inject(DataService);
  protected readonly catalogAdmin = inject(CatalogAdminService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly hasSocialLinks = hasSocialLinks;
  protected readonly isPerformerBusy = isPerformerBusy;
  protected readonly getPerformerBusyStatus = getPerformerBusyStatus;

  protected readonly pageBackground = catalogTabBackgroundStyle('workers');

  protected readonly editingPerformer = signal<PerformerProfile | null>(null);
  protected readonly adminSaving = signal(false);
  protected readonly selectedPerformerId = signal<string | null>(null);
  protected readonly hiddenPerformerIds = signal<Set<string>>(new Set());
  protected readonly specialtySearchQuery = signal('');
  protected recommendationRequested = false;
  protected isLoading = false;
  protected relatedMasters: Specialist[] = [];

  protected readonly visibleWorkers = computed(() => {
    const hidden = this.hiddenPerformerIds();
    const filtered = this.supabase.workers().filter((worker) => !hidden.has(worker.id));
    const query = this.normalizeSearchText(this.specialtySearchQuery());

    if (!query) {
      return filtered;
    }

    return filtered.filter((worker) => {
      const haystack = this.normalizeSearchText(
        `${worker.name} ${worker.specialty ?? ''} ${worker.description ?? ''}`,
      );
      return haystack.includes(query);
    });
  });

  protected readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    specialty: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(4)]],
  });

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.loadProfiles().subscribe();
    }

    const selection = readCatalogSelection();
    if (selection?.type === 'worker') {
      this.selectedPerformerId.set(selection.id);
    }
  }

  performerLink(id: string): string[] {
    return ['/masters', id];
  }

  toggleSelect(id: string): void {
    this.selectedPerformerId.update((current) => {
      const next = current === id ? null : id;
      saveCatalogSelection(next ? { type: 'worker', id: next } : null);
      return next;
    });
  }

  selectMaster(masterId: string): void {
    this.toggleSelect(masterId);
  }

  isBusy(master: PerformerProfile): boolean {
    return this.isPerformerBusy(master);
  }

  notifyMe(masterId: string): void {
    const id = masterId.trim();
    if (!id || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const storageKey = 'smartbuild.notify-when-free';
    const existingRaw = localStorage.getItem(storageKey);
    const existing = existingRaw
      ? existingRaw
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!existing.includes(id)) {
      existing.push(id);
      localStorage.setItem(storageKey, existing.join(','));
    }

    alert('Мы уведомим вас, когда у мастера освободится слот.');
  }

  async showSimilar(masterSkills: string[], masterId: string): Promise<void> {
    this.recommendationRequested = true;
    this.isLoading = true;
    let result: { data: Specialist[]; error: string | null } = { data: [], error: null };

    try {
      result = await this.dataService.loadRecommendations(masterSkills, masterId, 'Batumi', 3);
      this.relatedMasters = result.data || [];
    } finally {
      this.isLoading = false;
    }

    if (result.error) {
      alert(result.error);
      return;
    }

    if (!this.relatedMasters.length) {
      alert('Похожие мастера пока не найдены.');
      return;
    }

    const names = this.relatedMasters
      .map((item) => [item.name, item.surname].filter(Boolean).join(' ').trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');

    alert(`Похожие мастера: ${names}`);
  }

  toSkillsArray(specialty: string): string[] {
    return specialty
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }

  openRequestForm(): void {
    void this.router.navigate(['/jobs']);
  }

  openEditPerformer(performer: PerformerProfile) {
    this.editingPerformer.set(performer);
    this.editForm.reset({
      name: performer.name,
      specialty: performer.specialty,
      description: performer.description,
    });
  }

  closeEditPerformer() {
    this.editingPerformer.set(null);
    this.editForm.reset();
  }

  editFieldInvalid(field: 'name' | 'specialty' | 'description'): boolean {
    const control = this.editForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  async saveEditedPerformer() {
    const performer = this.editingPerformer();
    if (!performer || this.adminSaving()) {
      return;
    }

    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) {
      return;
    }

    const { name, specialty, description } = this.editForm.getRawValue();
    this.adminSaving.set(true);

    try {
      const result = await firstValueFrom(
        this.supabase.updateProfile(performer.id, { name, specialty, description }),
      );
      if (result.error) {
        alert(result.error);
        return;
      }
      this.closeEditPerformer();
    } finally {
      this.adminSaving.set(false);
    }
  }

  async deletePerformer(performer: PerformerProfile) {
    const error = await this.catalogAdmin.deletePerformer(performer);
    if (error) {
      alert(error);
      return;
    }

    this.deleteFromUI(performer.id);

    if (this.editingPerformer()?.id === performer.id) {
      this.closeEditPerformer();
    }
  }

  deleteFromUI(id: string): void {
    const targetId = id.trim();
    if (!targetId) {
      return;
    }

    this.hiddenPerformerIds.update((current) => {
      const next = new Set(current);
      next.add(targetId);
      return next;
    });

    if (this.selectedPerformerId() === targetId) {
      this.selectedPerformerId.set(null);
      saveCatalogSelection(null);
    }
  }

  deleteWork(performer: PerformerProfile, workId: string, workTitle: string) {
    void this.catalogAdmin.deletePerformerWork(performer.id, workId, workTitle).then((error) => {
      if (error) {
        alert(error);
      }
    });
  }

  adminLogout() {
    this.catalogAdmin.logout();
    this.closeEditPerformer();
  }

  protected updateSpecialtySearchQuery(value: string): void {
    this.specialtySearchQuery.set(value ?? '');
  }

  private normalizeSearchText(value: string): string {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }
}
