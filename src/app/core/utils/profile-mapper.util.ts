import { FurnitureCompany } from '../models/furniture.models';
import { BrigadeRow, FurnitureOrderRow, MasterRow } from '../models/master.model';
import { Profile } from '../models/profile.models';
import { PerformerProfile, PerformerSocialLinks } from '../models/portfolio.models';

import { normalizeCallOutFee } from './call-out-fee.util';
import { buildFurnitureSlug, isUuid, normalizeUuid } from './furniture-id.util';

function resolveWhatsappPhone(
  whatsapp_phone?: string | null,
  whatsapp?: string | null,
): string | null {
  const direct = whatsapp_phone?.trim();
  if (direct) {
    return direct;
  }
  return whatsapp?.trim() || null;
}

function resolveTgUsername(tg_username?: string | null, telegram?: string | null): string | null {
  const direct = tg_username?.trim();
  if (direct) {
    return direct;
  }
  return telegram?.trim() || null;
}

function buildSocialLinks(profile: Profile): PerformerSocialLinks | undefined {
  const links: PerformerSocialLinks = {
    phone: profile.phone ?? undefined,
    whatsapp: resolveWhatsappPhone(profile.whatsapp_phone, profile.whatsapp) ?? undefined,
    telegram: resolveTgUsername(profile.tg_username, profile.telegram) ?? undefined,
    instagram: profile.instagram ?? undefined,
    facebook: profile.facebook ?? undefined,
  };

  return Object.values(links).some(Boolean) ? links : undefined;
}

export function masterRowToProfile(row: MasterRow): Profile {
  if (row?.account_type === 'furniture') {
    const name = row?.full_name?.trim() || row?.phone?.trim() || row?.id || '';
    const slug = row?.slug?.trim() || buildFurnitureSlug(name);

    return {
      id: row?.id ?? '',
      type: 'furniture',
      slug,
      name,
      specialty: row?.specialty?.trim() || '',
      description: row?.description?.trim() || '',
      city: row?.city ?? null,
      phone: row?.phone ?? null,
      whatsapp_phone: resolveWhatsappPhone(row?.whatsapp_phone, row?.whatsapp),
      tg_username: resolveTgUsername(row?.tg_username, row?.telegram),
      whatsapp: row?.whatsapp ?? null,
      telegram: row?.telegram ?? null,
      instagram: row?.instagram ?? null,
      facebook: row?.facebook ?? null,
      header_bg: row?.header_bg ?? null,
    };
  }

  const accountType = row?.account_type === 'brigade' ? 'brigade' : 'worker';

  return {
    id: row?.id ?? '',
    type: accountType,
    name: row?.full_name?.trim() || row?.phone?.trim() || row?.id || '',
    specialty: row?.specialty?.trim() || '',
    description: row?.description?.trim() || '',
    city: row?.city ?? null,
    call_out_fee: row?.call_out_fee ?? null,
    phone: row?.phone ?? null,
    whatsapp_phone: resolveWhatsappPhone(row?.whatsapp_phone, row?.whatsapp),
    tg_username: resolveTgUsername(row?.tg_username, row?.telegram),
    whatsapp: row?.whatsapp ?? null,
    telegram: row?.telegram ?? null,
    instagram: row?.instagram ?? null,
    facebook: row?.facebook ?? null,
    header_bg: row?.header_bg ?? null,
  };
}

export function brigadeRowToProfile(row: BrigadeRow): Profile {
  return {
    id: row?.id ?? '',
    type: 'brigade',
    name: row?.full_name?.trim() || row?.phone?.trim() || row?.id || '',
    specialty: row?.specialty?.trim() || '',
    description: row?.description?.trim() || '',
    city: row?.city ?? null,
    call_out_fee: row?.call_out_fee ?? null,
    phone: row?.phone ?? null,
    whatsapp_phone: resolveWhatsappPhone(row?.whatsapp_phone, row?.whatsapp),
    tg_username: resolveTgUsername(row?.tg_username, row?.telegram),
    whatsapp: row?.whatsapp ?? null,
    telegram: row?.telegram ?? null,
    instagram: row?.instagram ?? null,
    facebook: row?.facebook ?? null,
  };
}

/** Профиль мебельной компании из строки `furniture_orders` (колонка `id` = UUID). */
export function furnitureOrderRowToProfile(row: FurnitureOrderRow): Profile | null {
  const dbId = normalizeUuid(row?.id);
  if (!dbId) {
    return null;
  }

  const name = row?.full_name?.trim() || row?.client_name?.trim() || '';

  return {
    id: dbId,
    slug: row?.slug?.trim() || buildFurnitureSlug(name),
    type: 'furniture',
    name,
    specialty: row?.specialty?.trim() || row?.furniture_type?.trim() || '',
    description: row?.description?.trim() || '',
    city: row?.city ?? null,
    phone: row?.phone ?? row?.client_phone ?? null,
    whatsapp_phone: resolveWhatsappPhone(row?.whatsapp_phone, row?.whatsapp),
    tg_username: resolveTgUsername(row?.tg_username, row?.telegram),
    whatsapp: row?.whatsapp ?? null,
    telegram: row?.telegram ?? null,
    instagram: row?.instagram ?? null,
    facebook: row?.facebook ?? null,
  };
}

export function furnitureCompanyToProfile(company: FurnitureCompany): Profile {
  const dbId = normalizeUuid(company.dbId) || (isUuid(company.id) ? company.id : '');
  const slug = company.slug?.trim() || (!isUuid(company.id) ? company.id : buildFurnitureSlug(company.name));

  return {
    id: dbId || company.id,
    slug,
    type: 'furniture',
    name: company.name,
    specialty: company.specialty,
    description: company.description,
    city: company.city || null,
    phone: company.socialLinks?.phone ?? null,
    whatsapp: company.socialLinks?.whatsapp ?? null,
    telegram: company.socialLinks?.telegram ?? null,
    instagram: company.socialLinks?.instagram ?? null,
    facebook: company.socialLinks?.facebook ?? null,
  };
}

export function performerToProfile(performer: PerformerProfile): Profile {
  return {
    id: performer.id,
    type: performer.type,
    name: performer.name,
    specialty: performer.specialty,
    description: performer.description,
    call_out_fee: performer.callOutFee ?? null,
    phone: performer.socialLinks?.phone ?? null,
    whatsapp: performer.socialLinks?.whatsapp ?? null,
    telegram: performer.socialLinks?.telegram ?? null,
    instagram: performer.socialLinks?.instagram ?? null,
    facebook: performer.socialLinks?.facebook ?? null,
  };
}

export function profileToPerformer(
  profile: Profile,
  works: PerformerProfile['works'] = [],
): PerformerProfile {
  const callOutFee =
    profile.type === 'furniture'
      ? null
      : normalizeCallOutFee(profile.call_out_fee ?? profile.city ?? '') || null;

  return {
    id: profile.id,
    type: profile.type === 'brigade' ? 'brigade' : 'worker',
    name: profile.name,
    specialty: profile.specialty,
    description: profile.description,
    avatarUrl: profile.avatar_url ?? undefined,
    socialLinks: buildSocialLinks(profile),
    whatsapp_phone: profile.whatsapp_phone ?? profile.whatsapp,
    tg_username: profile.tg_username ?? profile.telegram,
    works,
    callOutFee,
    headerBg: profile.header_bg ?? null,
  };
}

export function profileToFurnitureCompany(
  profile: Profile,
  works: FurnitureCompany['works'] = [],
): FurnitureCompany {
  const dbId = isUuid(profile.id) ? profile.id : null;
  const slug = profile.slug?.trim() || (!isUuid(profile.id) ? profile.id : buildFurnitureSlug(profile.name));

  return {
    id: dbId || profile.id,
    dbId: dbId || null,
    slug,
    name: profile.name,
    specialty: profile.specialty,
    description: profile.description,
    city: profile.city ?? '',
    socialLinks: buildSocialLinks(profile),
    whatsapp_phone: profile.whatsapp_phone ?? profile.whatsapp,
    tg_username: profile.tg_username ?? profile.telegram,
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
