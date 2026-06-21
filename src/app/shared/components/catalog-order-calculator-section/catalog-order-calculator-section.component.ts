import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RenovationCalculatorComponent } from '../renovation-calculator/renovation-calculator.component';

@Component({
  selector: 'app-catalog-order-calculator-section',
  standalone: true,
  imports: [RenovationCalculatorComponent],
  templateUrl: './catalog-order-calculator-section.component.html',
  styleUrls: ['./catalog-order-calculator-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogOrderCalculatorSectionComponent {}
