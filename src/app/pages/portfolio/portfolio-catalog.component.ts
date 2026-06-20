import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { TranslationService } from '../../core/services/translation.service';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';

@Component({
  selector: 'app-portfolio-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portfolio-catalog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['../../styles/catalog-pages.css', './portfolio-catalog.component.css'],
})
export class PortfolioCatalogComponent implements OnInit {
  protected readonly supabase = inject(SupabaseService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly pageBackground = catalogTabBackgroundStyle('catalogHub');

  ngOnInit(): void {
    this.supabase.loadProfiles().subscribe();
  }
}
