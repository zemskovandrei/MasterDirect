export type PerformerType = 'brigade' | 'worker';

<<<<<<< HEAD
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
=======
export interface SubscriptionPlan {
  type: PerformerType;
  priceUsd: number;
  titleKey: string;
  descriptionKey: string;
  featureKeys: string[];
>>>>>>> copilot/vscode-mpyhbjc8-zg6q
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
  socialLinks?: PerformerSocialLinks;
  works: WorkProject[];
  isDemo?: boolean;
  /** Прямой контакт WhatsApp (колонка whatsapp_phone в Supabase). */
  whatsapp_phone?: string | null;
  /** Прямой контакт Telegram (колонка tg_username в Supabase). */
  tg_username?: string | null;
  /** Стоимость выезда на замер (хранится в Supabase `city` для worker/brigade). */
  callOutFee?: string | null;
  /** Цвет фона шапки профиля (Supabase `header_bg`). */
  headerBg?: string | null;
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
  /** Client submission type: detailed review or short recommendation */
  kind?: 'review' | 'recommendation';
}

export interface ReviewNotification {
  id: string;
  reviewId: string;
  message: string;
  link: string;
  createdAt: string;
}
<<<<<<< HEAD
=======

export const SUBSCRIPTION_PLANS: Record<PerformerType, SubscriptionPlan> = {
  worker: {
    type: 'worker',
    priceUsd: 5,
    titleKey: 'cabinet.plan.worker.title',
    descriptionKey: 'cabinet.plan.worker.description',
    featureKeys: [
      'cabinet.plan.feature.profile',
      'cabinet.plan.feature.uploadWorks',
      'cabinet.plan.feature.editPortfolio',
    ],
  },
  brigade: {
    type: 'brigade',
    priceUsd: 15,
    titleKey: 'cabinet.plan.brigade.title',
    descriptionKey: 'cabinet.plan.brigade.description',
    featureKeys: [
      'cabinet.plan.feature.companyProfile',
      'cabinet.plan.feature.uploadWorks',
      'cabinet.plan.feature.unlimited',
      'cabinet.plan.feature.priority',
    ],
  },
};
>>>>>>> copilot/vscode-mpyhbjc8-zg6q
