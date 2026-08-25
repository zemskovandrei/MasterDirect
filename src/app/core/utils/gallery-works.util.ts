import { FurnitureCompany } from '../models/furniture.models';
import { PerformerProfile, WorkProject, WorkVideo } from '../models/portfolio.models';

export type GalleryPerformerKind = 'worker' | 'brigade' | 'furniture';

export interface GalleryWorkItem {
  work: WorkProject;
  performerName: string;
  performerRoute: string;
  kind: GalleryPerformerKind;
}

function appendPerformerWorks(
  items: GalleryWorkItem[],
  performers: PerformerProfile[],
  routePrefix: 'masters' | 'brigades',
  kind: Extract<GalleryPerformerKind, 'worker' | 'brigade'>,
): void {
  for (const performer of performers) {
    for (const work of performer.works) {
      items.push({
        work,
        performerName: performer.name,
        performerRoute: `/${routePrefix}/${performer.id}`,
        kind,
      });
    }
  }
}

function appendFurnitureWorks(items: GalleryWorkItem[], companies: FurnitureCompany[]): void {
  for (const company of companies) {
    for (const work of company.works) {
      items.push({
        work,
        performerName: company.name,
        performerRoute: `/furniture/${company.id}`,
        kind: 'furniture',
      });
    }
  }
}

export function collectGalleryWorks(input: {
  workers: PerformerProfile[];
  brigades: PerformerProfile[];
  furniture: FurnitureCompany[];
}): GalleryWorkItem[] {
  const items: GalleryWorkItem[] = [];
  appendPerformerWorks(items, input.workers, 'masters', 'worker');
  appendPerformerWorks(items, input.brigades, 'brigades', 'brigade');
  appendFurnitureWorks(items, input.furniture);

  return items.sort((left, right) => {
    const leftTime = Date.parse(left.work.createdAt) || 0;
    const rightTime = Date.parse(right.work.createdAt) || 0;
    return rightTime - leftTime;
  });
}

export interface GalleryVideoItem {
  video: WorkVideo;
  performerName: string;
  performerRoute: string;
  kind: GalleryPerformerKind;
}

function appendPerformerVideos(
  items: GalleryVideoItem[],
  performers: PerformerProfile[],
  routePrefix: 'masters' | 'brigades',
  kind: Extract<GalleryPerformerKind, 'worker' | 'brigade'>,
): void {
  for (const performer of performers) {
    for (const video of performer.workVideos) {
      items.push({
        video,
        performerName: performer.name,
        performerRoute: `/${routePrefix}/${performer.id}`,
        kind,
      });
    }
  }
}

function appendFurnitureVideos(items: GalleryVideoItem[], companies: FurnitureCompany[]): void {
  for (const company of companies) {
    for (const video of company.workVideos) {
      items.push({
        video,
        performerName: company.name,
        performerRoute: `/furniture/${company.id}`,
        kind: 'furniture',
      });
    }
  }
}

export function collectGalleryVideos(input: {
  workers: PerformerProfile[];
  brigades: PerformerProfile[];
  furniture: FurnitureCompany[];
}): GalleryVideoItem[] {
  const items: GalleryVideoItem[] = [];
  appendPerformerVideos(items, input.workers, 'masters', 'worker');
  appendPerformerVideos(items, input.brigades, 'brigades', 'brigade');
  appendFurnitureVideos(items, input.furniture);

  return items.sort((left, right) => {
    const leftTime = Date.parse(left.video.createdAt) || 0;
    const rightTime = Date.parse(right.video.createdAt) || 0;
    return rightTime - leftTime;
  });
}
