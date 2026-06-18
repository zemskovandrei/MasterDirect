export type CatalogSelectionType = 'worker' | 'brigade' | 'furniture';

export interface CatalogSelection {
  type: CatalogSelectionType;
  id: string;
}

const STORAGE_KEY = 'flooringleader.catalog-selection';

export function saveCatalogSelection(selection: CatalogSelection | null): void {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  if (!selection) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
}

export function readCatalogSelection(): CatalogSelection | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CatalogSelection;
    if (!parsed?.id || !parsed?.type) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function matchesCatalogSelection(type: CatalogSelectionType, id: string): boolean {
  const selection = readCatalogSelection();
  return selection?.type === type && selection?.id === id;
}
