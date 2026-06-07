import { Component, HostListener, PLATFORM_ID, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslationService } from '../core/services/translation.service';

@Component({
  selector: 'app-site-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './site-layout.component.html',
  styleUrls: ['./site-layout.component.css'],
})
export class SiteLayoutComponent {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly translation = inject(TranslationService);

  protected readonly title = signal('SmartBuild.Tech');
  protected readonly mobileMenuOpen = signal(false);

  @HostListener('document:keydown.escape')
  onEscape() {
    this.closeMobileMenu();
  }

  toggleMobileMenu() {
    const next = !this.mobileMenuOpen();
    this.mobileMenuOpen.set(next);
    if (next) {
      this.lockBodyScroll();
    } else {
      this.unlockBodyScroll();
    }
  }

  closeMobileMenu() {
    if (!this.mobileMenuOpen()) {
      return;
    }
    this.mobileMenuOpen.set(false);
    this.unlockBodyScroll();
  }

  private lockBodyScroll() {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.add('no-scroll');
    }
  }

  private unlockBodyScroll() {
    if (isPlatformBrowser(this.platformId)) {
      document.body.classList.remove('no-scroll');
    }
  }

  onNavClick() {
    this.closeMobileMenu();
  }
}
