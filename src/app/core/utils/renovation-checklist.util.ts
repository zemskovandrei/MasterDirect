import {
  RENOVATION_CHECKLIST_ITEMS,
  RENOVATION_CHECKLIST_PHASES,
  RenovationChecklistItemDef,
  RenovationChecklistPhaseId,
} from '../data/renovation-checklist.data';
import {
  CalculatorRenovationType,
  CalculatorRoomType,
} from '../models/calculator.models';

export interface ChecklistViewItem {
  id: string;
  phaseId: RenovationChecklistPhaseId;
  labelKey: string;
  selected: boolean;
}

export interface ChecklistPhaseGroup {
  phaseId: RenovationChecklistPhaseId;
  titleKey: string;
  order: number;
  items: ChecklistViewItem[];
}

export function getVisibleChecklistItems(
  renovationType: CalculatorRenovationType,
  roomType: CalculatorRoomType,
): RenovationChecklistItemDef[] {
  return RENOVATION_CHECKLIST_ITEMS.filter((item) => {
    if (item.hideFor?.includes(renovationType)) {
      return false;
    }
    if (item.excludeRoomTypes?.includes(roomType)) {
      return false;
    }
    return true;
  });
}

export function buildDefaultChecklistSelection(
  renovationType: CalculatorRenovationType,
  roomType: CalculatorRoomType,
): Set<string> {
  return new Set(
    getVisibleChecklistItems(renovationType, roomType)
      .filter((item) => item.defaultFor.includes(renovationType))
      .map((item) => item.id),
  );
}

export function buildChecklistPhaseGroups(
  renovationType: CalculatorRenovationType,
  roomType: CalculatorRoomType,
  selectedIds: ReadonlySet<string>,
): ChecklistPhaseGroup[] {
  const visible = getVisibleChecklistItems(renovationType, roomType);

  return RENOVATION_CHECKLIST_PHASES.map((phase) => ({
    phaseId: phase.id,
    titleKey: phase.titleKey,
    order: phase.order,
    items: visible
      .filter((item) => item.phaseId === phase.id)
      .map((item) => ({
        id: item.id,
        phaseId: item.phaseId,
        labelKey: item.labelKey,
        selected: selectedIds.has(item.id),
      })),
  })).filter((group) => group.items.length > 0);
}

export function buildChecklistScopeSummary(
  renovationType: CalculatorRenovationType,
  roomType: CalculatorRoomType,
  selectedIds: ReadonlySet<string>,
  translate: (key: string) => string,
  customItems: readonly string[] = [],
): string {
  const groups = buildChecklistPhaseGroups(renovationType, roomType, selectedIds);
  const lines: string[] = [];

  for (const group of groups) {
    const selectedItems = group.items.filter((item) => item.selected);
    if (selectedItems.length === 0) {
      continue;
    }

    lines.push(`${translate(group.titleKey)}:`);
    for (const item of selectedItems) {
      lines.push(`• ${translate(item.labelKey)}`);
    }
    lines.push('');
  }

  const trimmedCustomItems = customItems.map((item) => item.trim()).filter(Boolean);
  if (trimmedCustomItems.length > 0) {
    lines.push(`${translate('home.calculator.checklistCustomSectionTitle')}:`);
    for (const item of trimmedCustomItems) {
      lines.push(`• ${item}`);
    }
  }

  return lines.join('\n').trim();
}

export function countSelectedChecklistItems(selectedIds: ReadonlySet<string>): number {
  return selectedIds.size;
}

export function getAllVisibleChecklistItemIds(
  renovationType: CalculatorRenovationType,
  roomType: CalculatorRoomType,
): string[] {
  return getVisibleChecklistItems(renovationType, roomType).map((item) => item.id);
}

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function tokenMatchesText(token: string, text: string): boolean {
  const haystack = normalizeSearchText(text);
  if (!token) {
    return true;
  }

  if (haystack.includes(token)) {
    return true;
  }

  const words = haystack.split(/[^a-zа-я0-9]+/i).filter((word) => word.length >= 2);
  if (words.some((word) => word.startsWith(token))) {
    return true;
  }

  if (token.length >= 3) {
    const stem = token.slice(0, 3);
    return words.some((word) => word.startsWith(stem));
  }

  return false;
}

function textMatchesSearchQuery(text: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.every((token) => tokenMatchesText(token, text));
}

export function matchesChecklistSearch(text: string, query: string): boolean {
  return textMatchesSearchQuery(text, query);
}

export function filterChecklistPhaseGroups(
  groups: ChecklistPhaseGroup[],
  query: string,
  translate: (key: string) => string,
): ChecklistPhaseGroup[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return groups;
  }

  return groups
    .map((group) => {
      const phaseTitle = translate(group.titleKey);
      const items = group.items.filter((item) => {
        const label = translate(item.labelKey);
        return textMatchesSearchQuery(label, normalizedQuery) || textMatchesSearchQuery(phaseTitle, normalizedQuery);
      });

      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
}

export function countChecklistItemsInGroups(groups: ChecklistPhaseGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

export const CHECKLIST_EXTRA_PHASE_ID = 'handyman' as const;

export function splitChecklistPhaseGroups(groups: ChecklistPhaseGroup[]): {
  main: ChecklistPhaseGroup[];
  extra: ChecklistPhaseGroup | null;
} {
  const extra = groups.find((group) => group.phaseId === CHECKLIST_EXTRA_PHASE_ID) ?? null;
  const main = groups.filter((group) => group.phaseId !== CHECKLIST_EXTRA_PHASE_ID);
  return { main, extra };
}
