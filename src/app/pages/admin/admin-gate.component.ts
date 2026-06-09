import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminLoginModalComponent } from '../../shared/components/admin-login-modal/admin-login-modal.component';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-admin-gate',
  standalone: true,
  imports: [AdminLoginModalComponent],
  template: `
    <section class="admin-gate">
      <p>{{ translation.t('admin.gate.lead') }}</p>
    </section>

    <app-admin-login-modal
      [open]="loginOpen()"
      (closed)="onLoginClosed()"
      (loggedIn)="onLoggedIn()"
    />
  `,
  styles: [
    `
      .admin-gate {
        min-height: 40vh;
        display: grid;
        place-items: center;
        padding: 2rem;
        color: var(--color-text-muted);
      }
    `,
  ],
})
export class AdminGateComponent {
  private readonly router = inject(Router);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);

  protected readonly loginOpen = signal(true);

  constructor() {
    if (this.adminAuth.isAdmin()) {
      void this.router.navigate(['/masters']);
    }
  }

  onLoggedIn() {
    void this.router.navigate(['/masters']);
  }

  onLoginClosed() {
    if (this.adminAuth.isAdmin()) {
      void this.router.navigate(['/masters']);
      return;
    }
    void this.router.navigate(['/']);
  }
}
