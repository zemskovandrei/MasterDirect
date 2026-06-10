import { FurnitureCompany } from '../models/furniture.models';
import { Profile } from '../models/profile.models';
import { PerformerProfile, PerformerSocialLinks } from '../models/portfolio.models';

import { isPaidCallOutFee, normalizeCallOutFee } from './call-out-fee.util';

function buildSocialLinks(profile: Profile): PerformerSocialLinks | undefined {
  const links: PerformerSocialLinks = {
    phone: profile.phone ?? undefined,
    whatsapp: profile.whatsapp ?? undefined,
    telegram: profile.telegram ?? undefined,
    instagram: profile.instagram ?? undefined,
    facebook: profile.facebook ?? undefined,
  };

  return Object.values(links).some(Boolean) ? links : undefined;
}

export function profileToPerformer(profile: Profile, works: PerformerProfile['works'] = []): PerformerProfile {
  const callOutFee =
    profile.type === 'furniture' ? null : normalizeCallOutFee(profile.city ?? '') || null;

  return {
    id: profile.id,
    type: profile.type === 'brigade' ? 'brigade' : 'worker',
    name: profile.name,
    specialty: profile.specialty,
    description: profile.description,
    avatarUrl: profile.avatar_url ?? undefined,
    socialLinks: buildSocialLinks(profile),
    works,
    callOutFee,
  };
}

export function profileToFurnitureCompany(
  profile: Profile,
  works: FurnitureCompany['works'] = [],
): FurnitureCompany {
  return {
    id: profile.id,
    name: profile.name,
    specialty: profile.specialty,
    description: profile.description,
    city: profile.city ?? '',
    socialLinks: buildSocialLinks(profile),
    works,
  };
}

export function profileInsertToRow(input: {
  type: Profile['type'];
  name: string;
  specialty: string;
  description: string;
  city?: string;
  callOutFee?: string;
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}) {
  const callOutFee = normalizeCallOutFee(input.callOutFee ?? '');
  const cityValue =
    input.type === 'furniture'
      ? input.city?.trim() || null
      : callOutFee || input.city?.trim() || null;

  return {
    type: input.type,
    name: input.name.trim(),
    specialty: input.specialty.trim(),
    description: input.description.trim(),
    city: cityValue,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    telegram: input.telegram?.trim() || null,
    instagram: input.instagram?.trim() || null,
    facebook: input.facebook?.trim() || null,
  };
}
