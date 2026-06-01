import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { PerformerType } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';

@Component({
  selector: 'app-portfolio-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './portfolio-catalog.component.html',
  styleUrls: ['./portfolio-catalog.component.css'],
})
export class PortfolioCatalogComponent {
  protected readonly store = inject(PortfolioStoreService);
  protected readonly activeTab = signal<PerformerType>('brigade');

  setTab(tab: PerformerType) {
    this.activeTab.set(tab);
  }

  performerLink(type: PerformerType, id: string): string[] {
    return ['/portfolio', type, id];
  }
}
