import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslationService } from './core/services/translation.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  constructor() {
    inject(TranslationService);
  }
}
