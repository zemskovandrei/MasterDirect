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
    const fallback = this.t('beforeAfter.tag', 'Работа до и после');

    if (work.i18nKey) {
      const localized = this.t(`${work.i18nKey}.title`, work.title);
      return this.isLikelyGarbageTitle(localized) ? fallback : localized;
    }

    const title = (work.title ?? '').trim();
    if (!title || this.isLikelyGarbageTitle(title)) {
      return fallback;
    }

    return title;
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
      Плитка: 'tiler',
      Плиточник: 'tiler',
      Электрика: 'electrician',
      Электрик: 'electrician',
      Сантехника: 'plumber',
      Сантехник: 'plumber',
      Отделка: 'painter',
      'Маляр-штукатур': 'painter',
      Гипсокартонщик: 'drywall',
      'Под ключ': 'renovation_turnkey',
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

  matchesSpecialtyFilter(value: string, filterKey: string): boolean {
    const wanted = filterKey.trim();
    if (!wanted) {
      return true;
    }

    const aliases: Record<string, string[]> = {
      painter: ['painter', 'drywall'],
      turnkey: ['turnkey', 'renovation_turnkey'],
    };
    const accepted = new Set(aliases[wanted] ?? [wanted]);
    const parts = value.split(',').map((part) => part.trim()).filter(Boolean);

    return parts.some((part) => {
      const key = this.primarySpecialtyKey(part) ?? part;
      return accepted.has(key);
    });
  }

  private t(key: string, fallback: string): string {
    this.translation.locale();
    const value = this.translation.t(key);
    return value && value !== key ? value : fallback;
  }

  private isLikelyGarbageTitle(value: string): boolean {
    const title = value.trim();
    if (!title) {
      return true;
    }

    // Accept short titles and normal multi-word phrases.
    if (title.length <= 8 || /\s/.test(title)) {
      return false;
    }

    // Keyboard-mash heuristic: long single token with too few vowels.
    const latinOnly = /^[a-z]+$/i.test(title);
    if (!latinOnly) {
      return false;
    }

    const vowels = (title.match(/[aeiouy]/gi) ?? []).length;
    const ratio = vowels / title.length;
    return title.length >= 10 && ratio < 0.22;
  }
}
