export type PerformerType = 'brigade' | 'worker';

export interface SubscriptionPlan {
  type: PerformerType;
  priceUsd: number;
  titleKey: string;
  descriptionKey: string;
  featureKeys: string[];
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
