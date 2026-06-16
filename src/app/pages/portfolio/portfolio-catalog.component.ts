import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { TranslationService } from '../../core/services/translation.service';
import { catalogTabBackgroundStyle } from '../../core/constants/catalog-tab-backgrounds';

@Component({
  selector: 'app-portfolio-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './portfolio-catalog.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './portfolio-catalog.component.css'],
})
export class PortfolioCatalogComponent {
  protected readonly store = inject(PortfolioStoreService);
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);

  protected readonly pageBackground = catalogTabBackgroundStyle('catalogHub');
}
