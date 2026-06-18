import type { WorkProject, WorkVerificationStatus } from './portfolio.models';

export type PortfolioWorkOwnerType = 'worker' | 'brigade' | 'furniture';

export interface PortfolioWorkRow {
  id: string;
  owner_id: string;
  owner_type: PortfolioWorkOwnerType;
  title: string;
  description: string | null;
  before_image_url: string;
  after_image_url: string;
  verification_status: WorkVerificationStatus | null;
  client_contact: string | null;
  verification_token: string | null;
  verification_code: string | null;
  verified_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

export function portfolioWorkRowToProject(row: PortfolioWorkRow): WorkProject {
  return {
    id: row.id,
    title: row.title?.trim() || '',
    description: row.description?.trim() || '',
    beforeImage: row.before_image_url,
    afterImage: row.after_image_url,
    createdAt: row.created_at,
    verificationStatus: row.verification_status ?? 'not_requested',
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
}): Omit<PortfolioWorkRow, 'created_at'> {
  return {
    id: input.work.id,
    owner_id: input.ownerId,
    owner_type: input.ownerType,
    title: input.work.title,
    description: input.work.description,
    before_image_url: input.work.beforeImage,
    after_image_url: input.work.afterImage,
    verification_status: input.work.verificationStatus,
    client_contact: input.work.clientContact ?? null,
    verification_token: input.work.verificationToken ?? null,
    verification_code: input.work.verificationCode ?? null,
    verified_at: input.work.verifiedAt ?? null,
    rejected_at: input.work.rejectedAt ?? null,
  };
}
