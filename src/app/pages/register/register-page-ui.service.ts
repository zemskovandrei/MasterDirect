import { Injectable, signal } from '@angular/core';
import type { ProRole } from './register-page.model';

@Injectable({ providedIn: 'root' })
export class RegisterPageUiService {
  readonly selectedProRole = signal<ProRole>('master');
}
