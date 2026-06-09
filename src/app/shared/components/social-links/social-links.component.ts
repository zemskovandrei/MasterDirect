import { Component, computed, input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PerformerSocialLinks, SocialLinkKey } from '../../../core/models/portfolio.models';
import { buildSocialLinkItems } from '../../../core/utils/social-links.util';
import { TranslationService } from '../../../core/services/translation.service';

const SOCIAL_ICONS: Record<SocialLinkKey, string> = {
  phone: '📞',
  whatsapp: '💬',
  telegram: '✈️',
  instagram: '📷',
  facebook: 'f',
};

@Component({
  selector: 'app-social-links',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './social-links.component.html',
  styleUrls: ['./social-links.component.css'],
})
export class SocialLinksComponent {
  protected readonly translation = inject(TranslationService);

  readonly links = input<PerformerSocialLinks | undefined>();
  readonly compact = input(false);
  readonly variant = input<'hero' | 'light'>('hero');

  protected readonly items = computed(() => buildSocialLinkItems(this.links()));

  protected icon(key: SocialLinkKey): string {
    return SOCIAL_ICONS[key];
  }

  protected label(key: SocialLinkKey): string {
    return this.translation.t(`social.${key}`);
  }
}
