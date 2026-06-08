import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {
  private translate = inject(TranslateService);

  constructor() {
    this.translate.setDefaultLang('ru');
    this.translate.use('ru');
  }
}
