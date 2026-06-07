import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { PerformerType } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';

@Component({
  selector: 'app-performer-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './performer-profile.component.html',
  styleUrls: ['./performer-profile.component.css'],
})
export class PerformerProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PortfolioStoreService);
  private readonly reviewStore = inject(ReviewStoreService);

  protected readonly type = toSignal(
    this.route.data.pipe(map((d) => d['performerType'] as PerformerType)),
    { initialValue: 'brigade' as PerformerType },
  );

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly performer = computed(() => {
    const type = this.type();
    const id = this.id();
    if (!type || !id) {
      return undefined;
    }
    return this.store.getPerformer(type, id);
  });

  protected readonly relevantReviews = computed(() => {
    const performer = this.performer();
    if (!performer) {
      return [];
    }
    const typeLabel = this.type() === 'brigade' ? 'Бригада' : 'Мастер';
    return this.reviewStore.approvedReviews().filter(
      (review) => review.performerType === typeLabel,
    );
  });

  protected readonly heroImage = computed(() => {
    const performer = this.performer();
    return performer?.works[0]?.afterImage ?? null;
  });

  protected readonly typeIcon = computed(() =>
    this.type() === 'brigade' ? '👷' : '🔧',
  );

  protected typeLabel(): string {
    return this.type() === 'brigade' ? 'Бригада' : 'Мастер';
  }

  protected catalogLink(): string {
    return this.type() === 'brigade' ? '/brigades' : '/masters';
  }
}
