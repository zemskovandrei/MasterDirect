export type PerformerType = 'brigade' | 'worker';

/** Client confirmation lifecycle for a portfolio work. */
export type WorkVerificationStatus = 'not_requested' | 'pending' | 'verified' | 'rejected';

export interface SubscriptionPlan {
  type: PerformerType;
  priceUsd: number;
  title: string;
  description: string;
  features: string[];
}

export interface WorkProject {
  id: string;
  title: string;
  description: string;
  beforeImage: string;
  afterImage: string;
  createdAt: string;
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

export interface PerformerProfile {
  id: string;
  type: PerformerType;
  name: string;
  specialty: string;
  description: string;
  avatarUrl?: string;
  works: WorkProject[];
  subscribed: boolean;
  subscriptionEndsAt?: string;
  isDemo?: boolean;
}

export interface CabinetSession {
  performerId: string;
}

export type ReviewPerformerTypeKey = 'brigade' | 'master' | 'furniture' | 'renovation';

export interface ReviewSubmission {
  id: string;
  name: string;
  performerType: 'Мастер' | 'Бригада' | 'Мебель' | 'Ремонт';
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
}

export interface ReviewNotification {
  id: string;
  reviewId: string;
  message: string;
  link: string;
  createdAt: string;
}

export const SUBSCRIPTION_PLANS: Record<PerformerType, SubscriptionPlan> = {
  worker: {
    type: 'worker',
    priceUsd: 5,
    title: 'Мастер',
    description: 'Для отдельного специалиста',
    features: [
      'Профиль в каталоге мастеров',
      'Загрузка работ «до / после»',
      'Редактирование своего портфолио',
    ],
  },
  brigade: {
    type: 'brigade',
    priceUsd: 15,
    title: 'Бригадир',
    description: 'Для бригады и руководителя работ',
    features: [
      'Профиль бригады в каталоге',
      'Загрузка проектов «до / после»',
      'Неограниченное число работ в подписке',
      'Приоритет в выдаче каталога',
    ],
  },
};
