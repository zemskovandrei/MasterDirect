import type { MasterRow } from '../models/master.model';
import type { ProfileUpdate } from '../models/profile.models';

export interface SpecialistWriteInput {
  userId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  city?: string;
  specialty: string;
  proRole?: string;
  accountType: 'worker' | 'brigade' | 'furniture';
  slug?: string | null;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}

export function splitPersonName(fullName: string, firstName?: string, lastName?: string): {
  name: string;
  surname: string;
} {
  const first = firstName?.trim();
  const last = lastName?.trim();
  if (first) {
    return {
      name: first,
      surname: last || '-',
    };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { name: 'Профиль', surname: '-' };
  }
  if (parts.length === 1) {
    return { name: parts[0], surname: '-' };
  }

  return {
    name: parts[0],
    surname: parts.slice(1).join(' '),
  };
}

export function skillsFromSpecialty(specialty: string): string[] {
  const value = specialty.trim();
  return value ? [value] : [];
}

export function specialtyFromSkills(skills: string[] | null | undefined): string {
  if (!skills?.length) {
    return '';
  }
  return skills.map((item) => item.trim()).filter(Boolean).join(', ');
}

/** Отображаемое имя: `name` или «Мастер», затем `surname`. */
export function formatSpecialistFullName(
  specialist: { name?: string | null; surname?: string | null },
  fallbackName = 'Мастер',
): string {
  return `${specialist.name?.trim() || fallbackName} ${specialist.surname?.trim() || ''}`.trim();
}

export function displayNameFromSpecialistRow(row: MasterRow): string {
  const legacy = row.full_name?.trim();
  if (legacy) {
    return legacy;
  }

  return formatSpecialistFullName(row);
}

export function specialtyFromSpecialistRow(row: MasterRow): string {
  const legacy = row.specialty?.trim();
  if (legacy) {
    return legacy;
  }
  return specialtyFromSkills(row.skills);
}

export function specialistRowToWritePayload(input: SpecialistWriteInput): Record<string, unknown> {
  const { name, surname } = splitPersonName(input.fullName, input.firstName, input.lastName);
  const phone = input.phone.trim() || '-';

  return {
    id: input.userId,
    name,
    surname,
    phone,
    skills: skillsFromSpecialty(input.specialty),
    city: input.city?.trim() || null,
    role: input.proRole?.trim() || null,
    account_type: input.accountType,
    slug: input.slug ?? null,
    whatsapp_phone: input.whatsapp?.trim() || null,
    tg_username: input.telegram?.trim() || null,
    instagram: input.instagram?.trim() || null,
    facebook: input.facebook?.trim() || null,
    is_verified: false,
  };
}

export function profilePatchToSpecialistRow(
  patch: ProfileUpdate,
  existing?: { name?: string; surname?: string },
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const name = patch.name?.trim();

  if (name) {
    const { name: first, surname } = splitPersonName(name, existing?.name, existing?.surname);
    row['name'] = first;
    row['surname'] = surname;
  }

  if (patch.specialty?.trim()) {
    row['skills'] = skillsFromSpecialty(patch.specialty);
  }

  if (patch.city !== undefined) {
    row['city'] = patch.city?.trim() || null;
  }

  if (patch.phone !== undefined) {
    row['phone'] = patch.phone?.trim() || '-';
  }

  if (patch.whatsapp !== undefined) {
    row['whatsapp_phone'] = patch.whatsapp?.trim() || null;
  }

  if (patch.telegram !== undefined) {
    row['tg_username'] = patch.telegram?.trim() || null;
  }

  if (patch.instagram !== undefined) {
    row['instagram'] = patch.instagram?.trim() || null;
  }

  if (patch.facebook !== undefined) {
    row['facebook'] = patch.facebook?.trim() || null;
  }

  return row;
}
