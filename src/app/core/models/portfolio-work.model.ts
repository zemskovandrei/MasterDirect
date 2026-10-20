import type { WorkProject, WorkVerificationStatus } from './portfolio.models';
import { isAlbumWork, resolveAlbumImages } from './portfolio.models';

export type PortfolioWorkOwnerType = 'worker' | 'brigade' | 'furniture';

/** Packed into description so albums work without a new DB column. */
export const ALBUM_DESCRIPTION_MARKER = '__MD_ALBUM__';

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

  const { title: titleFromDescription, description: rawDescription } = splitFoldedWorkText(row.description);
  const { description, albumImages } = splitAlbumFromDescription(rawDescription);
  const beforeImage = row.before_image_url;
  const afterImage = row.after_image_url;
  const resolvedAlbum =
    albumImages.length > 0
      ? albumImages
      : beforeImage && afterImage && beforeImage === afterImage
        ? [beforeImage]
        : [];
  const kind = resolvedAlbum.length > 0 ? 'album' : 'before_after';

  return {
    id: row.id,
    title: row.title?.trim() || titleFromDescription || 'Работа',
    description,
    beforeImage,
    afterImage,
    kind,
    albumImages: resolvedAlbum.length > 0 ? resolvedAlbum : undefined,
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
  const album = isAlbumWork(input.work) ? resolveAlbumImages(input.work) : [];
  const cover = album[0] || input.work.beforeImage || input.work.afterImage || '';
  const folded = foldWorkTitleAndDescription(input.work.title, input.work.description);
  const description =
    album.length > 0 ? foldAlbumIntoDescription(folded, album) : folded;

  // Живая схема: specialist_id + owner_type. Лишние колонки ломают insert.
  return {
    id: input.work.id,
    specialist_id: input.ownerId,
    owner_type: input.ownerType,
    description,
    before_image_url: album.length > 0 ? cover : input.work.beforeImage,
    after_image_url: album.length > 0 ? cover : input.work.afterImage,
    status,
  };
}

export function foldAlbumIntoDescription(
  foldedTitleAndBody: string | null,
  albumImages: string[],
): string {
  const urls = albumImages.map((url) => url.trim()).filter(Boolean);
  const head = foldedTitleAndBody?.trimEnd() ?? '';
  if (!urls.length) {
    return head;
  }
  return `${head}\n${ALBUM_DESCRIPTION_MARKER}\n${urls.join('\n')}`;
}

export function splitAlbumFromDescription(rawDescription: string): {
  description: string;
  albumImages: string[];
} {
  const marker = `\n${ALBUM_DESCRIPTION_MARKER}\n`;
  const idx = rawDescription.indexOf(marker);
  if (idx < 0) {
    // Also accept marker at start of body.
    if (rawDescription.startsWith(`${ALBUM_DESCRIPTION_MARKER}\n`)) {
      const urls = rawDescription
        .slice(ALBUM_DESCRIPTION_MARKER.length + 1)
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return { description: '', albumImages: urls };
    }
    return { description: rawDescription, albumImages: [] };
  }

  return {
    description: rawDescription.slice(0, idx).trim(),
    albumImages: rawDescription
      .slice(idx + marker.length)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
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

/** Finished works table: one cover image + optional album URLs in description. */
export interface WorksPortfolioRow {
  id: string;
  specialist_id: string;
  title?: string | null;
  description?: string | null;
  image_url: string;
  created_at: string;
}

export function worksPortfolioRowToProject(row: WorksPortfolioRow): WorkProject {
  const cover = row.image_url?.trim() || '';
  const { description, albumImages } = splitAlbumFromDescription(row.description ?? '');
  const resolvedAlbum =
    albumImages.length > 0 ? albumImages : cover ? [cover] : [];

  return {
    id: row.id,
    title: row.title?.trim() || 'Работа',
    description,
    beforeImage: cover || resolvedAlbum[0] || '',
    afterImage: cover || resolvedAlbum[0] || '',
    kind: 'album',
    albumImages: resolvedAlbum.length > 0 ? resolvedAlbum : undefined,
    createdAt: row.created_at,
    verificationStatus: 'not_requested',
  };
}

export function workProjectToWorksPortfolioInsert(input: {
  ownerId: string;
  work: WorkProject;
}): Record<string, unknown> {
  const album = resolveAlbumImages(input.work);
  const cover = album[0] || input.work.beforeImage || input.work.afterImage || '';
  const body = input.work.description?.trim() || '';
  const description =
    album.length > 1 ? foldAlbumIntoDescription(body, album) : body || null;

  return {
    id: input.work.id,
    specialist_id: input.ownerId,
    title: input.work.title?.trim() || null,
    description,
    image_url: cover,
  };
}
