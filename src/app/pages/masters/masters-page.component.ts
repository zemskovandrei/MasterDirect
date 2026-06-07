import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-masters-page',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './masters-page.component.html',
  styleUrls: ['../../styles/catalog-pages.css', './masters-page.component.css'],
})
export class MastersPageComponent {
  protected readonly store = inject(PortfolioStoreService);
  protected readonly translation = inject(TranslationService);

  performerLink(id: string): string[] {
    return ['/masters', id];
  }
}
