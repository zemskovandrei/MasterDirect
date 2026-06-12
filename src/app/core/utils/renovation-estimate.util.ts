import {
  CalculatorRenovationType,
  CalculatorRoomType,
} from '../models/calculator.models';

export type EstimateCategoryId =
  | 'preparation'
  | 'rough'
  | 'engineering'
  | 'finishing'
  | 'installations'
  | 'materials'
  | 'services';

export interface RenovationEstimateInput {
  roomType: CalculatorRoomType;
  renovationType: CalculatorRenovationType;
  areaSqm: number;
  disabledOptionalIds?: ReadonlySet<string>;
}

export interface ComputedEstimateLine {
  id: string;
  categoryId: EstimateCategoryId;
  labelKey: string;
  amount: number;
  enabled: boolean;
  optional: boolean;
}

export interface RenovationEstimateResult {
  lines: ComputedEstimateLine[];
  categories: EstimateCategoryId[];
  subtotal: number;
  contingency: number;
  total: number;
  totalMin: number;
  totalMax: number;
  pricePerSqm: number;
}

interface LineDefinition {
  id: string;
  categoryId: EstimateCategoryId;
  labelKey: string;
  optional: boolean;
  defaultOn: boolean;
  pricing: { type: 'perSqm'; rate: number } | { type: 'fixed'; amount: number };
  renovationTypes: CalculatorRenovationType[];
  excludeRoomTypes?: CalculatorRoomType[];
  onlyRoomTypes?: CalculatorRoomType[];
}

const CATEGORY_ORDER: EstimateCategoryId[] = [
  'preparation',
  'rough',
  'engineering',
  'finishing',
  'installations',
  'materials',
  'services',
];

const LINE_DEFINITIONS: LineDefinition[] = [
  {
    id: 'measurement',
    categoryId: 'preparation',
    labelKey: 'home.calculator.estimate.items.measurement',
    optional: false,
    defaultOn: true,
    pricing: { type: 'fixed', amount: 120 },
    renovationTypes: ['cosmetic', 'capital', 'design', 'furniture'],
  },
  {
    id: 'demolition',
    categoryId: 'preparation',
    labelKey: 'home.calculator.estimate.items.demolition',
    optional: true,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 28 },
    renovationTypes: ['capital', 'design'],
    excludeRoomTypes: ['new_build'],
  },
  {
    id: 'waste_removal',
    categoryId: 'preparation',
    labelKey: 'home.calculator.estimate.items.wasteRemoval',
    optional: true,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 9 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'wall_plaster',
    categoryId: 'rough',
    labelKey: 'home.calculator.estimate.items.wallPlaster',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 32 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'floor_screed',
    categoryId: 'rough',
    labelKey: 'home.calculator.estimate.items.floorScreed',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 26 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'electrical',
    categoryId: 'engineering',
    labelKey: 'home.calculator.estimate.items.electrical',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 48 },
    renovationTypes: ['cosmetic', 'capital', 'design'],
  },
  {
    id: 'plumbing_rough',
    categoryId: 'engineering',
    labelKey: 'home.calculator.estimate.items.plumbingRough',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 42 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'waterproofing',
    categoryId: 'engineering',
    labelKey: 'home.calculator.estimate.items.waterproofing',
    optional: true,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 22 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'ventilation',
    categoryId: 'engineering',
    labelKey: 'home.calculator.estimate.items.ventilation',
    optional: true,
    defaultOn: false,
    pricing: { type: 'perSqm', rate: 14 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'tile_work',
    categoryId: 'finishing',
    labelKey: 'home.calculator.estimate.items.tileWork',
    optional: true,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 58 },
    renovationTypes: ['cosmetic', 'capital', 'design'],
  },
  {
    id: 'flooring',
    categoryId: 'finishing',
    labelKey: 'home.calculator.estimate.items.flooring',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 38 },
    renovationTypes: ['cosmetic', 'capital', 'design'],
  },
  {
    id: 'painting',
    categoryId: 'finishing',
    labelKey: 'home.calculator.estimate.items.painting',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 24 },
    renovationTypes: ['cosmetic', 'capital', 'design'],
  },
  {
    id: 'ceiling',
    categoryId: 'finishing',
    labelKey: 'home.calculator.estimate.items.ceiling',
    optional: true,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 28 },
    renovationTypes: ['cosmetic', 'capital', 'design'],
  },
  {
    id: 'doors_trim',
    categoryId: 'installations',
    labelKey: 'home.calculator.estimate.items.doorsTrim',
    optional: true,
    defaultOn: true,
    pricing: { type: 'fixed', amount: 1450 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'plumbing_fixtures',
    categoryId: 'installations',
    labelKey: 'home.calculator.estimate.items.plumbingFixtures',
    optional: true,
    defaultOn: true,
    pricing: { type: 'fixed', amount: 2900 },
    renovationTypes: ['capital', 'design'],
  },
  {
    id: 'kitchen_hookup',
    categoryId: 'installations',
    labelKey: 'home.calculator.estimate.items.kitchenHookup',
    optional: true,
    defaultOn: true,
    pricing: { type: 'fixed', amount: 980 },
    renovationTypes: ['capital', 'design', 'furniture'],
  },
  {
    id: 'custom_furniture',
    categoryId: 'installations',
    labelKey: 'home.calculator.estimate.items.customFurniture',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 135 },
    renovationTypes: ['furniture'],
  },
  {
    id: 'materials_delivery',
    categoryId: 'materials',
    labelKey: 'home.calculator.estimate.items.materialsDelivery',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 36 },
    renovationTypes: ['cosmetic', 'capital', 'design', 'furniture'],
  },
  {
    id: 'design_project',
    categoryId: 'services',
    labelKey: 'home.calculator.estimate.items.designProject',
    optional: false,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 52 },
    renovationTypes: ['design'],
  },
  {
    id: 'author_supervision',
    categoryId: 'services',
    labelKey: 'home.calculator.estimate.items.authorSupervision',
    optional: true,
    defaultOn: true,
    pricing: { type: 'perSqm', rate: 20 },
    renovationTypes: ['design'],
  },
  {
    id: 'cleaning',
    categoryId: 'services',
    labelKey: 'home.calculator.estimate.items.cleaning',
    optional: true,
    defaultOn: true,
    pricing: { type: 'fixed', amount: 420 },
    renovationTypes: ['cosmetic', 'capital', 'design'],
  },
];

function renovationMultiplier(type: CalculatorRenovationType): number {
  switch (type) {
    case 'cosmetic':
      return 0.72;
    case 'capital':
      return 1;
    case 'design':
      return 1.18;
    case 'furniture':
      return 0.95;
    default:
      return 1;
  }
}

function roomMultiplier(type: CalculatorRoomType): number {
  switch (type) {
    case 'commercial':
      return 1.12;
    case 'house':
      return 1.08;
    case 'new_build':
      return 0.94;
    default:
      return 1;
  }
}

function lineAmount(
  definition: LineDefinition,
  areaSqm: number,
  renovationType: CalculatorRenovationType,
  roomType: CalculatorRoomType,
): number {
  const multiplier = renovationMultiplier(renovationType) * roomMultiplier(roomType);
  const raw =
    definition.pricing.type === 'perSqm'
      ? definition.pricing.rate * areaSqm
      : definition.pricing.amount;

  return Math.round(raw * multiplier);
}

function appliesToRoom(definition: LineDefinition, roomType: CalculatorRoomType): boolean {
  if (definition.excludeRoomTypes?.includes(roomType)) {
    return false;
  }
  if (definition.onlyRoomTypes && !definition.onlyRoomTypes.includes(roomType)) {
    return false;
  }
  return true;
}

export function computeRenovationEstimate(
  input: RenovationEstimateInput,
): RenovationEstimateResult {
  const areaSqm = Math.max(5, input.areaSqm);
  const disabled = input.disabledOptionalIds ?? new Set<string>();
  const lines: ComputedEstimateLine[] = [];

  for (const definition of LINE_DEFINITIONS) {
    if (!definition.renovationTypes.includes(input.renovationType)) {
      continue;
    }
    if (!appliesToRoom(definition, input.roomType)) {
      continue;
    }

    const enabled = definition.optional
      ? definition.defaultOn && !disabled.has(definition.id)
      : true;

    lines.push({
      id: definition.id,
      categoryId: definition.categoryId,
      labelKey: definition.labelKey,
      amount: lineAmount(definition, areaSqm, input.renovationType, input.roomType),
      enabled,
      optional: definition.optional,
    });
  }

  const subtotal = lines.filter((line) => line.enabled).reduce((sum, line) => sum + line.amount, 0);
  const contingency = Math.round(subtotal * 0.1);
  const total = subtotal + contingency;
  const totalMin = Math.round(total * 0.92);
  const totalMax = Math.round(total * 1.14);

  return {
    lines,
    categories: CATEGORY_ORDER.filter((categoryId) =>
      lines.some((line) => line.categoryId === categoryId),
    ),
    subtotal,
    contingency,
    total,
    totalMin,
    totalMax,
    pricePerSqm: Math.round(total / areaSqm),
  };
}

export function formatEstimateGel(value: number): string {
  try {
    return `${new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 0 }).format(value)} ₾`;
  } catch {
    return `${Math.round(value)} ₾`;
  }
}

export function buildEstimateScopeSummary(
  lines: ComputedEstimateLine[],
  translate: (key: string) => string,
): string {
  return lines
    .filter((line) => line.enabled)
    .map((line) => `• ${translate(line.labelKey)}`)
    .join('\n');
}

/** @deprecated Use buildEstimateScopeSummary for client-facing flows */
export function buildEstimateSummaryLines(
  lines: ComputedEstimateLine[],
  translate: (key: string) => string,
): string {
  return lines
    .filter((line) => line.enabled)
    .map((line) => `${translate(line.labelKey)}: ${formatEstimateGel(line.amount)}`)
    .join('\n');
}
