import { Component, computed, input, signal } from '@angular/core';
import { WorkProject } from '../../../core/models/portfolio.models';

interface VerificationBadge {
  label: string;
  icon: string;
  className: string;
}

export type BeforeAfterLayout = 'compare' | 'split';

@Component({
  selector: 'app-before-after',
  standalone: true,
  templateUrl: './before-after.component.html',
  styleUrls: ['./before-after.component.css'],
})
export class BeforeAfterComponent {
  readonly work = input.required<WorkProject>();
  readonly layout = input<BeforeAfterLayout>('compare');
  readonly featured = input(false);
  readonly titleOverride = input<string | null>(null);
  readonly descriptionOverride = input<string | null>(null);

  protected displayTitle(): string {
    return this.titleOverride() ?? this.work().title;
  }

  protected displayDescription(): string | undefined {
    return this.descriptionOverride() ?? this.work().description;
  }

  protected readonly verificationBadge = computed((): VerificationBadge | null => {
    const status = this.work().verificationStatus ?? 'not_requested';
    switch (status) {
      case 'pending':
        return {
          label: 'Ожидает подтверждения клиентом',
          icon: '⏳',
          className: 'work-verify-badge work-verify-badge--pending',
        };
      case 'verified':
        return {
          label: 'Подтверждено клиентом',
          icon: '🛡',
          className: 'work-verify-badge work-verify-badge--verified',
        };
      case 'rejected':
        return {
          label: 'Отклонено клиентом',
          icon: '✕',
          className: 'work-verify-badge work-verify-badge--rejected',
        };
      default:
        return null;
    }
  });

  protected readonly sliderPos = signal(50);

  onSliderInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.sliderPos.set(value);
  }
}
