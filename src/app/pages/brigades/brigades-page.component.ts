import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../core/services/supabase.service';
import { CatalogAdminService } from '../../core/services/catalog-admin.service';
import { PerformerProfile } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { SocialLinksComponent } from '../../shared/components/social-links/social-links.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { hasSocialLinks } from '../../core/utils/social-links.util';
import { saveCatalogSelection, readCatalogSelection } from '../../core/utils/catalog-selection.util';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';

@Component({
  selector: 'app-brigades-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, BeforeAfterComponent, SocialLinksComponent],
  templateUrl: './brigades-page.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './brigades-page.component.css'],
})
export class BrigadesPageComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly supabase = inject(SupabaseService);
  protected readonly catalogAdmin = inject(CatalogAdminService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly hasSocialLinks = hasSocialLinks;

  protected readonly pageBackground = catalogTabBackgroundStyle('brigade');
  protected readonly selectedBrigadeId = signal<string | null>(null);
  protected readonly editingPerformer = signal<PerformerProfile | null>(null);
  protected readonly adminSaving = signal(false);

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
    if (selection?.type === 'brigade') {
      this.selectedBrigadeId.set(selection.id);
    }

    this.route.fragment.subscribe((fragment) => {
      this.scrollToFragment(fragment);
    });
  }

  performerLink(id: string): string[] {
    return ['/brigades', id];
  }

  selectBrigade(id: string) {
    this.selectedBrigadeId.update((current) => {
      const next = current === id ? null : id;
      saveCatalogSelection(next ? { type: 'brigade', id: next } : null);
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

    if (this.editingPerformer()?.id === performer.id) {
      this.closeEditPerformer();
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

  private scrollToFragment(fragment: string | null) {
    if (!fragment || !isPlatformBrowser(this.platformId)) {
      return;
    }

    if (fragment === 'brigade-section') {
      setTimeout(() => {
        document
          .getElementById('brigade-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
    }
  }
}
