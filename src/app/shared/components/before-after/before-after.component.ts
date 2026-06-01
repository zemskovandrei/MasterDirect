import { Component, input, signal } from '@angular/core';
import { WorkProject } from '../../../core/models/portfolio.models';

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

  protected readonly sliderPos = signal(50);

  onSliderInput(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    this.sliderPos.set(value);
  }
}
