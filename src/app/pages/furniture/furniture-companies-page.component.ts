import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SupabaseService } from '../../core/services/supabase.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-furniture-companies-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './furniture-companies-page.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './furniture-companies-page.component.css'],
})
export class FurnitureCompaniesPageComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.loadProfiles().subscribe();
    }
  }
}
