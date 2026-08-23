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

  const rawDescription = row.description?.trim() || '';
  const [firstLine, ...rest] = rawDescription.split('\n');
  const titleFromDescription = rest.length > 0 ? firstLine.trim() : '';
  const description = rest.length > 0 ? rest.join('\n').trim() : rawDescription;

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
  const description = [input.work.title?.trim(), input.work.description?.trim()]
    .filter(Boolean)
    .join('\n')
    .trim();

  // Живая схема: specialist_id + owner_type. Лишние колонки ломают insert.
  return {
    id: input.work.id,
    specialist_id: input.ownerId,
    owner_type: input.ownerType,
    description: description || null,
    before_image_url: input.work.beforeImage,
    after_image_url: input.work.afterImage,
    status,
  };
}
