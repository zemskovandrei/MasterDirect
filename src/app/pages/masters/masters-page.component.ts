import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PerformerProfile } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-masters-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, BeforeAfterComponent],
  templateUrl: './masters-page.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './masters-page.component.css'],
})
export class MastersPageComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  protected readonly supabase = inject(SupabaseService);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

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
  }

  performerLink(id: string): string[] {
    return ['/masters', id];
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

    const confirmed = window.confirm(this.translation.t('admin.masters.deleteConfirm'));
    if (!confirmed) {
      return;
    }

    const result = await firstValueFrom(this.supabase.deleteProfile(performer.id));
    if (result.error) {
      alert(result.error);
      return;
    }

    if (this.editingPerformer()?.id === performer.id) {
      this.closeEditPerformer();
    }
  }

  adminLogout() {
    void this.adminAuth.logout();
    this.closeEditPerformer();
  }
}
