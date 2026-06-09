import { Injectable, inject } from '@angular/core';
import { PerformerProfile, WorkProject } from '../models/portfolio.models';
import { TranslationService } from './translation.service';

@Injectable({ providedIn: 'root' })
export class CatalogLocalizationService {
  private readonly translation = inject(TranslationService);

  performerSpecialty(performer: PerformerProfile): string {
    if (performer.isDemo) {
      return this.t(`seeds.performers.${performer.id}.specialty`, performer.specialty);
    }
    return this.localizeSpecialtyField(performer.specialty);
  }

  performerDescription(performer: PerformerProfile): string {
    if (performer.isDemo) {
      return this.t(`seeds.performers.${performer.id}.description`, performer.description);
    }
    return performer.description;
  }

  workTitle(work: WorkProject): string {
    if (work.i18nKey) {
      return this.t(`${work.i18nKey}.title`, work.title);
    }
    return work.title;
  }

  workDescription(work: WorkProject): string {
    if (work.i18nKey) {
      return this.t(`${work.i18nKey}.description`, work.description);
    }
    return work.description;
  }

  specialtyLabel(optionKey: string): string {
    return this.t(`cabinet.specialties.${optionKey}`, optionKey);
  }

  localizeSpecialtyField(value: string): string {
    if (!value.trim()) {
      return value;
    }
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const byKey = this.t(`cabinet.specialties.${part}`, '');
        if (byKey) {
          return byKey;
        }
        const legacyKey = this.specialtyKeyFromLabel(part);
        if (legacyKey) {
          return this.t(`cabinet.specialties.${legacyKey}`, part);
        }
        return part;
      })
      .join(', ');
  }

  private specialtyKeyFromLabel(label: string): string | null {
    const map: Record<string, string> = {
      Плиточник: 'tiler',
      Электрик: 'electrician',
      Сантехник: 'plumber',
      'Маляр-штукатур': 'painter',
      Гипсокартонщик: 'drywall',
      'Ремонт под ключ': 'renovation_turnkey',
      'Сборка и монтаж мебели': 'furnitureAssembly',
      'Установка кухонь и встроенной техники': 'kitchenInstall',
      'Изготовление корпусной мебели (шкафы, гардеробные)': 'cabinetMaking',
      'Монтаж торгового и коммерческого оборудования': 'commercialInstall',
    };
    return map[label] ?? null;
  }

  private t(key: string, fallback: string): string {
    this.translation.locale();
    const value = this.translation.t(key);
    return value && value !== key ? value : fallback;
  }
}
