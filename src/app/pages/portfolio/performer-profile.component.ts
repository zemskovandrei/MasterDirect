import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { ReviewStoreService } from '../../core/services/review-store.service';
import { PerformerType } from '../../core/models/portfolio.models';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';

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
  protected readonly reviewStore = inject(ReviewStoreService);
  protected readonly translation = inject(TranslationService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);

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
    const typeKey = this.type() === 'brigade' ? 'brigade' : 'master';
    return this.reviewStore.approvedReviews().filter(
      (review) => this.reviewStore.resolvePerformerTypeKey(review) === typeKey,
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
    return this.type() === 'brigade'
      ? this.translation.t('profile.badgeBrigade')
      : this.translation.t('profile.badgeMaster');
  }

  protected catalogLink(): string {
    return this.type() === 'brigade' ? '/brigades' : '/masters';
  }
}
