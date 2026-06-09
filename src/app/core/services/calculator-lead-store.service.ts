import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  CalculatorLeadSubmission,
  CalculatorRenovationType,
  CalculatorRoomType,
  CalculatorSelectedPerformer,
} from '../models/calculator.models';

const LEADS_KEY = 'smartbuild-tech-calculator-leads';

@Injectable({ providedIn: 'root' })
export class CalculatorLeadStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly leadsSignal = signal<CalculatorLeadSubmission[]>([]);

  readonly leads = this.leadsSignal.asReadonly();

  constructor() {
    this.loadFromStorage();
  }

  addLead(data: {
    roomType: CalculatorRoomType;
    renovationType: CalculatorRenovationType;
    areaSqm: number;
    name: string;
    contact: string;
    selectedPerformers?: CalculatorSelectedPerformer[];
  }): CalculatorLeadSubmission {
    const submission: CalculatorLeadSubmission = {
      id: `calc-lead-${Date.now()}`,
      roomType: data.roomType,
      renovationType: data.renovationType,
      areaSqm: data.areaSqm,
      name: data.name.trim(),
      contact: data.contact.trim(),
      selectedPerformers: data.selectedPerformers ?? [],
      createdAt: new Date().toISOString(),
    };

    this.leadsSignal.update((list) => [submission, ...list]);
    this.persist();
    return submission;
  }

  private loadFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const raw = localStorage.getItem(LEADS_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as CalculatorLeadSubmission[];
      if (Array.isArray(parsed)) {
        this.leadsSignal.set(parsed);
      }
    } catch {
      localStorage.removeItem(LEADS_KEY);
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(LEADS_KEY, JSON.stringify(this.leadsSignal()));
  }
}
