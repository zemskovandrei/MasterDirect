import type { WorkProject, WorkVerificationStatus } from './portfolio.models';

export type PortfolioWorkOwnerType = 'worker' | 'brigade' | 'furniture';

export interface PortfolioWorkRow {
  id: string;
  /** Прод-схема: владелец работы. */
  specialist_id?: string | null;
  owner_id?: string | null;
  owner_type?: PortfolioWorkOwnerType | string | null;
  title?: string | null;
  description: string | null;
  before_image_url: string;
  after_image_url: string;
  status?: string | null;
  verification_status?: WorkVerificationStatus | null;
  client_contact?: string | null;
  verification_token?: string | null;
  verification_code?: string | null;
  verified_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
}

export function portfolioWorkRowToProject(row: PortfolioWorkRow): WorkProject {
  const normalizedStatus = (row.verification_status ?? row.status ?? '').toString().trim().toLowerCase();
  const verificationStatus: WorkVerificationStatus =
    normalizedStatus === 'pending' ||
    normalizedStatus === 'verified' ||
    normalizedStatus === 'rejected' ||
    normalizedStatus === 'not_requested'
      ? (normalizedStatus as WorkVerificationStatus)
      : 'not_requested';

  const { title: titleFromDescription, description } = splitFoldedWorkText(row.description);

  return {
    id: row.id,
    title: row.title?.trim() || titleFromDescription || 'Работа',
    description,
    beforeImage: row.before_image_url,
    afterImage: row.after_image_url,
    createdAt: row.created_at,
    verificationStatus,
    clientContact: row.client_contact ?? undefined,
    verificationToken: row.verification_token ?? undefined,
    verificationCode: row.verification_code ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    rejectedAt: row.rejected_at ?? undefined,
  };
}

export function portfolioWorkToInsertRow(input: {
  ownerId: string;
  ownerType: PortfolioWorkOwnerType;
  work: WorkProject;
}): Record<string, unknown> {
  const status = input.work.verificationStatus || 'not_requested';

  // Живая схема: specialist_id + owner_type. Лишние колонки ломают insert.
  return {
    id: input.work.id,
    specialist_id: input.ownerId,
    owner_type: input.ownerType,
    description: foldWorkTitleAndDescription(input.work.title, input.work.description),
    before_image_url: input.work.beforeImage,
    after_image_url: input.work.afterImage,
    status,
  };
}

/** Title is always the first line; a trailing newline marks title-only rows. */
export function foldWorkTitleAndDescription(
  title: string | null | undefined,
  description: string | null | undefined,
): string | null {
  const trimmedTitle = title?.trim() ?? '';
  const trimmedBody = description?.trim() ?? '';
  if (trimmedTitle) {
    return `${trimmedTitle}\n${trimmedBody}`;
  }
  return trimmedBody || null;
}

export function splitFoldedWorkText(raw: string | null | undefined): {
  title: string;
  description: string;
} {
  const value = raw ?? '';
  const separator = value.indexOf('\n');
  if (separator >= 0) {
    return {
      title: value.slice(0, separator).trim(),
      description: value.slice(separator + 1).trim(),
    };
  }

  // Legacy title-only rows were stored as a single line with no separator.
  const line = value.trim();
  return { title: line, description: '' };
}
