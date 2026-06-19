import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Locale, TranslationService } from '../../../core/services/translation.service';

interface LanguageOption {
  code: Locale;
  label: string;
  initials: string;
  flag: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'ru', label: 'Русский', initials: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'English', initials: 'EN', flag: '🇬🇧' },
];

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  templateUrl: './language-switcher.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./language-switcher.component.css'],
})
export class LanguageSwitcherComponent {
  protected readonly translation = inject(TranslationService);
  protected readonly options = LANGUAGE_OPTIONS;
  protected readonly menuOpen = signal(false);

  currentOption(): LanguageOption {
    const code = this.translation.locale();
    return this.options.find((item) => item.code === code) ?? this.options[0];
  }

  async selectLocale(code: Locale) {
    await this.translation.setLocale(code);
    this.menuOpen.set(false);
  }

  toggleMenu() {
    this.menuOpen.update((open) => !open);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}
