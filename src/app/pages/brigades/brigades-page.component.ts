import {
  Component,
  Inject,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PerformerProfile } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { isCatalogPerformerVisible } from '../../core/utils/catalog-filter.util';
import { firstValueFrom } from 'rxjs';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';
import { logSupabaseError } from '../../core/utils/supabase-error.util';

@Component({
  selector: 'app-brigades-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, BeforeAfterComponent],
  templateUrl: './brigades-page.component.html',
  styleUrls: [
    '../../styles/catalog-pages.css',
    '../masters/masters-page.component.css',
    './brigades-page.component.css',
  ],
})
export class BrigadesPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly supabase = inject(SupabaseService);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

  protected readonly selectedBrigadeId = signal<string | null>(null);
  protected readonly editingPerformer = signal<PerformerProfile | null>(null);
  protected readonly adminSaving = signal(false);

  protected readonly catalogTabBackground = catalogTabBackgroundStyle('brigade');

  protected readonly displayBrigades = computed(() =>
    this.supabase.brigades().filter((performer) => isCatalogPerformerVisible(performer)),
  );

  protected readonly catalogReady = computed(() => this.supabase.catalogReady());

  protected readonly showAutoMatchEmpty = computed(
    () => this.catalogReady() && this.displayBrigades().length === 0,
  );

  protected readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    specialty: ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(4)]],
  });

  private catalogLoadStarted = false;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: Object) {
    afterNextRender(() => {
      this.initCatalog();
    });
  }

  ngOnInit(): void {
    this.route.fragment.subscribe((fragment) => {
      this.scrollToFragment(fragment);
    });
  }

  private initCatalog(): void {
    if (!isPlatformBrowser(this.platformId) || this.catalogLoadStarted) {
      return;
    }

    this.catalogLoadStarted = true;
    this.supabase.loadProfiles().subscribe({
      error: (err) => logSupabaseError('BrigadesPage.loadProfiles', err),
    });
  }

  performerLink(id: string): string[] {
    return ['/brigades', id];
  }

  selectBrigade(id: string) {
    this.selectedBrigadeId.set(id);
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
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!performer.id?.trim()) {
      console.error('Delete error:', 'Missing brigade id', performer);
      alert('Missing brigade id');
      return;
    }

    const confirmed = window.confirm(this.translation.t('admin.masters.deleteConfirm'));
    if (!confirmed) {
      return;
    }

    const result = await firstValueFrom(this.supabase.deleteBrigade(performer.id));
    if (result.error) {
      alert(result.error);
      return;
    }

    if (this.editingPerformer()?.id === performer.id) {
      this.closeEditPerformer();
    }
    if (this.selectedBrigadeId() === performer.id) {
      this.selectedBrigadeId.set(null);
    }
  }

  adminLogout() {
    void this.adminAuth.logout();
    this.closeEditPerformer();
  }

  private scrollToFragment(fragment: string | null) {
    if (!fragment || !isPlatformBrowser(this.platformId)) {
      return;
    }

    if (fragment === 'brigade-section') {
      setTimeout(() => {
        document.getElementById('brigade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }
}
