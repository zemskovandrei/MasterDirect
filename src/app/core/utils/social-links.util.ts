import { PerformerSocialLinks, SocialLinkKey } from '../models/portfolio.models';

export interface SocialLinkItem {
  key: SocialLinkKey;
  href: string;
  display: string;
}

function trimValue(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeSocialLinks(raw?: PerformerSocialLinks | null): PerformerSocialLinks {
  if (!raw) {
    return {};
  }

  return {
    phone: trimValue(raw.phone),
    whatsapp: trimValue(raw.whatsapp),
    telegram: trimValue(raw.telegram),
    instagram: trimValue(raw.instagram),
    facebook: trimValue(raw.facebook),
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function phoneHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^tel:/i.test(trimmed)) {
    return trimmed;
  }

  const compact = trimmed.replace(/[\s()-]/g, '');

  if (compact.startsWith('+')) {
    return `tel:${compact}`;
  }

  if (compact.startsWith('00')) {
    const international = digitsOnly(compact.slice(2));
    return international ? `tel:+${international}` : '';
  }

  const digits = digitsOnly(trimmed);
  if (!digits) {
    return '';
  }

  return `tel:${trimmed.replace(/\s/g, '')}`;
}

function whatsappHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\/(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/i.test(trimmed)) {
    return trimmed;
  }

  const compact = trimmed.replace(/[\s()-]/g, '');
  let digits = digitsOnly(trimmed);
  if (!digits) {
    return '';
  }

  if (compact.startsWith('+')) {
    digits = digitsOnly(compact.slice(1));
  } else if (compact.startsWith('00')) {
    digits = digitsOnly(compact.slice(2));
  }

  return digits ? `https://wa.me/${digits}` : '';
}

function telegramHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\/(?:t\.me|telegram\.me)\//i.test(trimmed)) {
    return trimmed.split(/[?#]/)[0]?.replace(/\/$/, '') ?? trimmed;
  }

  const fromPath = trimmed
    .replace(/^https?:\/\//i, '')
    .match(/^(?:t\.me|telegram\.me)\/([^\s/?#]+)/i)?.[1];
  if (fromPath) {
    return `https://t.me/${fromPath}`;
  }

  const username = trimmed.replace(/^@/, '');
  if (!username) {
    return '';
  }
  return `https://t.me/${username}`;
}

function instagramHref(value: string): string {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i)?.[1];
  const username = (fromUrl ?? trimmed.replace(/^@/, '')).replace(/^https?:\/\//, '');
  if (!username) {
    return '';
  }
  return `https://instagram.com/${username}`;
}

function facebookHref(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const username = trimmed.replace(/^@/, '').replace(/^facebook\.com\//i, '');
  if (!username) {
    return '';
  }
  return `https://facebook.com/${username}`;
}

export function hasSocialLinks(links?: PerformerSocialLinks | null): boolean {
  const normalized = normalizeSocialLinks(links);
  return Object.values(normalized).some(Boolean);
}

/** DB/remote values win; local store fills missing fields. */
export function mergeSocialLinks(
  primary?: PerformerSocialLinks | null,
  fallback?: PerformerSocialLinks | null,
): PerformerSocialLinks | undefined {
  const preferred = normalizeSocialLinks(primary);
  const backup = normalizeSocialLinks(fallback);
  const merged: PerformerSocialLinks = {
    phone: preferred.phone || backup.phone,
    whatsapp: preferred.whatsapp || backup.whatsapp,
    telegram: preferred.telegram || backup.telegram,
    instagram: preferred.instagram || backup.instagram,
    facebook: preferred.facebook || backup.facebook,
  };

  return Object.values(merged).some(Boolean) ? merged : undefined;
}

export function buildSocialLinkItems(links?: PerformerSocialLinks | null): SocialLinkItem[] {
  const normalized = normalizeSocialLinks(links);
  const items: SocialLinkItem[] = [];

  if (normalized.phone) {
    const href = phoneHref(normalized.phone);
    if (href) {
      items.push({ key: 'phone', href, display: normalized.phone });
    }
  }

  if (normalized.whatsapp) {
    const href = whatsappHref(normalized.whatsapp);
    if (href) {
      items.push({ key: 'whatsapp', href, display: normalized.whatsapp });
    }
  }

  if (normalized.telegram) {
    const href = telegramHref(normalized.telegram);
    if (href) {
      items.push({
        key: 'telegram',
        href,
        display: normalized.telegram.startsWith('@')
          ? normalized.telegram
          : `@${normalized.telegram.replace(/^@/, '').replace(/.*\//, '')}`,
      });
    }
  }

  if (normalized.instagram) {
    const href = instagramHref(normalized.instagram);
    if (href) {
      items.push({
        key: 'instagram',
        href,
        display: normalized.instagram.startsWith('@')
          ? normalized.instagram
          : `@${normalized.instagram.replace(/^@/, '').replace(/.*\//, '')}`,
      });
    }
  }

  if (normalized.facebook) {
    const href = facebookHref(normalized.facebook);
    if (href) {
      items.push({ key: 'facebook', href, display: normalized.facebook });
    }
  }

  return items;
}
