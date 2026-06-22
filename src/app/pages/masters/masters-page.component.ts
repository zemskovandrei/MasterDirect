import {
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CatalogAdminService } from '../../core/services/catalog-admin.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PerformerProfile } from '../../core/models/portfolio.models';
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
  private readonly fb = inject(FormBuilder);
  protected readonly supabase = inject(SupabaseService);
  protected readonly catalogAdmin = inject(CatalogAdminService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly hasSocialLinks = hasSocialLinks;

  protected readonly pageBackground = catalogTabBackgroundStyle('workers');

  protected readonly editingPerformer = signal<PerformerProfile | null>(null);
  protected readonly adminSaving = signal(false);
  protected readonly selectedPerformerId = signal<string | null>(null);
  protected readonly hiddenPerformerIds = signal<Set<string>>(new Set());
  protected readonly specialtySearchQuery = signal('');

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
