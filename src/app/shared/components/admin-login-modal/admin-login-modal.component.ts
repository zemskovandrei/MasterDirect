import { Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminAuthService } from '../../../core/services/admin-auth.service';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-admin-login-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-login-modal.component.html',
  styleUrls: ['./admin-login-modal.component.css'],
})
export class AdminLoginModalComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly adminAuth = inject(AdminAuthService);
  protected readonly translation = inject(TranslationService);

  readonly open = input(false);

  readonly closed = output<void>();
  readonly loggedIn = output<void>();

  protected readonly loginError = signal(false);

  protected readonly loginForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(4)]],
  });

  submitLogin() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const ok = this.adminAuth.login(this.loginForm.getRawValue().password);
    this.loginError.set(!ok);
    if (ok) {
      this.loginForm.reset();
      this.loggedIn.emit();
      this.closed.emit();
    }
  }

  close() {
    this.loginError.set(false);
    this.loginForm.reset();
    this.closed.emit();
  }
}
