import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-furniture-companies-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './furniture-companies-page.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './furniture-companies-page.component.css'],
})
export class FurnitureCompaniesPageComponent {
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);
}
