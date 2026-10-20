export type PerformerType = 'brigade' | 'worker';

/** Тип аккаунта при регистрации в кабинете. */
export type AccountType = 'worker' | 'brigade' | 'furniture';

/** Client confirmation lifecycle for a portfolio work. */
export type WorkVerificationStatus = 'not_requested' | 'pending' | 'verified' | 'rejected';

export type SocialLinkKey = 'phone' | 'whatsapp' | 'telegram' | 'instagram' | 'facebook';

export interface PerformerSocialLinks {
  phone?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}

export interface WorkVideo {
  id: string;
  title: string;
  videoUrl: string;
  createdAt: string;
}

export function normalizeWorkVideos(value: unknown): WorkVideo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const videos: WorkVideo[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const videoUrl = String(rec['videoUrl'] ?? rec['video_url'] ?? '').trim();
    if (!videoUrl) {
      continue;
    }
    videos.push({
      id: String(rec['id'] ?? '').trim() || `${Date.now()}-${videos.length}`,
      title: String(rec['title'] ?? '').trim(),
      videoUrl,
      createdAt: String(rec['createdAt'] ?? rec['created_at'] ?? new Date().toISOString()),
    });
  }
  return videos.sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export type WorkDisplayKind = 'before_after' | 'album';

export interface WorkProject {
  id: string;
  title: string;
  description: string;
  beforeImage: string;
  afterImage: string;
  createdAt: string;
  /** before/after pair, or a single finished-works album. */
  kind?: WorkDisplayKind;
  /** Finished-work gallery images (used when kind === 'album'). */
  albumImages?: string[];
  /** Set when the performer requests client confirmation. */
  verificationStatus: WorkVerificationStatus;
  /** Phone or email entered by the performer (not shown publicly). */
  clientContact?: string;
  /** One-time link token; cleared after client responds. */
  verificationToken?: string;
  /** Short code for SMS / messenger fallback. */
  verificationCode?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  /** Demo work translations: seeds.performers.{id}.works.{workId} */
  i18nKey?: string;
}

/** True when the work should render as a photo album, not before/after. */
export function isAlbumWork(work: Pick<WorkProject, 'kind' | 'albumImages' | 'beforeImage' | 'afterImage'>): boolean {
  if (work.kind === 'album') {
    return true;
  }
  if (work.albumImages && work.albumImages.length > 0) {
    return true;
  }
  const before = work.beforeImage?.trim() ?? '';
  const after = work.afterImage?.trim() ?? '';
  return !!before && !!after && before === after;
}

export function resolveAlbumImages(
  work: Pick<WorkProject, 'albumImages' | 'beforeImage' | 'afterImage'>,
): string[] {
  if (work.albumImages?.length) {
    return work.albumImages.filter((url) => !!url?.trim());
  }
  const before = work.beforeImage?.trim() ?? '';
  const after = work.afterImage?.trim() ?? '';
  if (before && after && before === after) {
    return [before];
  }
  return [before, after].filter(Boolean);
}

export interface PerformerProfile {
  id: string;
  type: PerformerType;
  name: string;
  specialty: string;
  description: string;
  avatarUrl?: string | null;
  balance?: number | null;
  socialLinks?: PerformerSocialLinks;
  works: WorkProject[];
  workVideos: WorkVideo[];
  isDemo?: boolean;
  /** Прямой контакт WhatsApp (колонка whatsapp_phone в Supabase). */
  whatsapp_phone?: string | null;
  /** Прямой контакт Telegram (колонка tg_username в Supabase). */
  tg_username?: string | null;
  /** Стоимость выезда на замер (хранится в Supabase `city` для worker/brigade). */
  callOutFee?: string | null;
  /** Цвет фона шапки профиля (Supabase `header_bg`). */
  headerBg?: string | null;
  /** Текущее количество активных заказов. */
  currentActiveOrders?: number | null;
  /** Максимальное количество одновременных заказов. */
  maxActiveOrders?: number | null;
}

export interface CabinetSession {
  performerId: string;
}

export type ReviewPerformerTypeKey = 'brigade' | 'master' | 'furniture' | 'renovation' | 'site';

export interface ReviewSubmission {
  id: string;
  name: string;
  performerType: 'Мастер' | 'Бригада' | 'Мебель' | 'Ремонт' | 'Сайт';
  performerTypeKey?: ReviewPerformerTypeKey;
  performerId?: string;
  category: string;
  review: string;
  rating?: number;
  beforeImage?: string;
  afterImage?: string;
  /** Key in i18n files, e.g. reviews.samples.0 or seeds.performers.*.works.* */
  i18nKey?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  isDemo?: boolean;
  /** Client submission type: review, recommendation, or site improvement feedback */
  kind?: 'review' | 'recommendation' | 'siteFeedback';
}

export interface ReviewNotification {
  id: string;
  reviewId: string;
  message: string;
  link: string;
  createdAt: string;
}
