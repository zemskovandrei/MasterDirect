export interface SpecialtyCategory {
  title: string;
  items: string[];
}

export const SPECIALTY_CATEGORIES: SpecialtyCategory[] = [
  {
    title: 'Отделочные работы',
    items: ['Плиточник', 'Маляр-штукатур', 'Гипсокартонщик', 'Поклейка обоев'],
  },
  {
    title: 'Инженерия',
    items: ['Электрик', 'Сантехник', 'Монтажник отопления'],
  },
  {
    title: 'Общестроительные',
    items: ['Каменщик', 'Плотник', 'Кровельщик'],
  },
  {
    title: 'Комплексные',
    items: ['Ремонт под ключ', 'Разнорабочий'],
  },
];

export const ALL_SPECIALTIES = SPECIALTY_CATEGORIES.flatMap((category) => category.items);

export function formatSpecialties(values: string[]): string {
  return values.join(', ');
}

export function parseSpecialties(value: string): string[] {
  if (!value.trim()) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => ALL_SPECIALTIES.includes(item));
}
