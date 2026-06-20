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

  performerSpecialtyTagline(performer: PerformerProfile): string {
    if (performer.isDemo) {
      const desc = this.t(`seeds.performers.${performer.id}.description`, '');
      if (desc) {
        return desc;
      }
    }

    return this.specialtyFieldTagline(performer.specialty);
  }

  specialtyFieldTagline(value: string): string {
    const key = this.primarySpecialtyKey(value);
    if (!key) {
      return '';
    }

    return this.t(`cabinet.specialtyDescriptions.${key}`, '');
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

  specialtyDescription(optionKey: string): string {
    return this.t(`cabinet.specialtyDescriptions.${optionKey}`, '');
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

  private primarySpecialtyKey(value: string): string | null {
    const first = value.split(',')[0]?.trim();
    if (!first) {
      return null;
    }

    if (/^[a-z][a-zA-Z0-9_]*$/.test(first)) {
      const label = this.t(`cabinet.specialties.${first}`, '');
      if (label && label !== `cabinet.specialties.${first}`) {
        return first;
      }
    }

    return this.specialtyKeyFromLabel(first);
  }

  private t(key: string, fallback: string): string {
    this.translation.locale();
    const value = this.translation.t(key);
    return value && value !== key ? value : fallback;
  }
}
