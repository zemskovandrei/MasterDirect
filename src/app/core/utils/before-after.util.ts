import { WorkProject } from '../models/portfolio.models';

/** Minimal work object for before/after display when only image URLs are available. */
export function beforeAfterWork(
  id: string,
  beforeImage: string,
  afterImage: string,
  title = '',
): WorkProject {
  return {
    id,
    title,
    description: '',
    beforeImage,
    afterImage,
    createdAt: '',
    verificationStatus: 'not_requested',
  };
}
