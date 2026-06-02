export type PerformerType = 'brigade' | 'worker';

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

export interface ReviewSubmission {
  id: string;
  name: string;
  performerType: 'Мастер' | 'Бригада';
  category: string;
  review: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
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
