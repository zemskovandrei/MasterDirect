import type { FurnitureOrderInsert } from '../core/models/master.model';

/** Строка таблицы заказов в Supabase (`jobklient`). */
export interface JobklientJobRow {
  id?: string | number | null;
  title?: string | null;
  client_name?: string | null;
  phone?: string | null;
  city?: string | null;
  category?: string | null;
  budget?: number | string | null;
  description?: string | null;
  discription?: string | null;
  created_at?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  status?: string | null;
  is_active?: boolean | null;
  active?: boolean | null;
}

/**
 * Payload для `.insert()` в таблицу `jobklient`.
 * Поля в snake_case — строго по колонкам Supabase.
 */
export interface JobklientJobInsert {
  title: string;
  client_name: string;
  phone: string;
  city: string;
  category: string;
  budget?: number | string | null;
  description?: string;
  status?: string;
}

export interface CalculatorJobklientJobInput {
  customerName: string;
  contact: string;
  city: string;
  roomTypeLabel: string;
  renovationTypeLabel: string;
  areaSqm: number;
  photoLink?: string;
  directedTo?: string;
  selectedCallOutFees?: string;
  paidCallOutAccepted: boolean;
  estimatedTotal?: number;
  estimateSummary?: string;
}

export interface JobDescriptionLabels {
  customer: string;
  contact: string;
  area: string;
  photo: string;
  directedTo: string;
  callOut: string;
  paidCallOutYes: string;
  estimate?: string;
  estimateTotal?: string;
}

export function buildJobklientJobInsert(
  input: CalculatorJobklientJobInput,
  labels: JobDescriptionLabels,
): JobklientJobInsert {
  const descriptionLines = [
    `${labels.customer}: ${input.customerName}`,
    `${labels.contact}: ${input.contact}`,
    `${labels.area}: ${input.areaSqm} m²`,
    input.estimateSummary && labels.estimate
      ? `${labels.estimate}:\n${input.estimateSummary}`
      : '',
    input.photoLink ? `${labels.photo}: ${input.photoLink}` : '',
    input.directedTo ? `${labels.directedTo}: ${input.directedTo}` : '',
    input.selectedCallOutFees ? `${labels.callOut}: ${input.selectedCallOutFees}` : '',
    input.paidCallOutAccepted ? labels.paidCallOutYes : '',
  ].filter(Boolean);

  return {
    title: `${input.roomTypeLabel} — ${input.renovationTypeLabel}`,
    client_name: input.customerName.trim(),
    phone: input.contact.trim(),
    city: input.city,
    category: input.renovationTypeLabel,
    budget: input.estimatedTotal ?? null,
    description: descriptionLines.join('\n'),
    status: 'New',
  };
}

/** Преобразует типизированный payload в объект для Supabase `.insert()`. */
export function toJobklientDbRow(input: JobklientJobInsert): {
  title: string;
  client_name: string;
  phone: string;
  city: string;
  category: string;
  budget: number | string | null;
  description: string | null;
  status: string;
} {
  return {
    title: input.title.trim(),
    client_name: input.client_name.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    category: input.category.trim(),
    budget: input.budget ?? null,
    description: input.description?.trim() || null,
    status: input.status?.trim() || 'New',
  };
}

export interface CalculatorFurnitureOrderInput {
  customerName: string;
  contact: string;
  city: string;
  roomTypeLabel: string;
  workTypeLabel: string;
  areaSqm: number;
  photoLink?: string;
  directedTo?: string;
  estimateSummary?: string;
}

export interface FurnitureOrderDescriptionLabels {
  customer: string;
  contact: string;
  city?: string;
  area: string;
  photo: string;
  directedTo: string;
  estimate?: string;
}

export function buildFurnitureOrderInsert(
  input: CalculatorFurnitureOrderInput,
  labels: FurnitureOrderDescriptionLabels,
): FurnitureOrderInsert {
  const descriptionLines = [
    `${labels.customer}: ${input.customerName}`,
    `${labels.contact}: ${input.contact}`,
    input.city.trim() && labels.city ? `${labels.city}: ${input.city.trim()}` : '',
    `${labels.area}: ${input.areaSqm} m²`,
    input.estimateSummary && labels.estimate
      ? `${labels.estimate}:\n${input.estimateSummary}`
      : '',
    input.photoLink ? `${labels.photo}: ${input.photoLink}` : '',
    input.directedTo ? `${labels.directedTo}: ${input.directedTo}` : '',
  ].filter(Boolean);

  return {
    client_name: input.customerName.trim(),
    client_phone: input.contact.trim(),
    furniture_type: input.roomTypeLabel.trim(),
    work_type: input.workTypeLabel.trim(),
    city: input.city.trim(),
    description: descriptionLines.join('\n') || null,
  };
}

export function toFurnitureOrderDbRow(input: FurnitureOrderInsert): {
  client_name: string;
  client_phone: string;
  furniture_type: string;
  work_type: string;
  description: string | null;
} {
  return {
    client_name: input.client_name.trim(),
    client_phone: input.client_phone.trim(),
    furniture_type: input.furniture_type.trim(),
    work_type: input.work_type.trim(),
    description: input.description?.trim() || null,
  };
}

export interface JobContactInfo {
  phone: string | null;
  telegram: string | null;
  display: string;
}

export interface JobDetails {
  areaSqm: number | null;
  customerName: string | null;
  contact: JobContactInfo | null;
  directedTo: string | null;
  photoLink: string | null;
  summary: string;
}

/** Нормализованная модель заказа для UI. */
export interface Job {
  id: string;
  title: string;
  city: string;
  category: string;
  budget: number | null;
  budgetLabel: string;
  description: string;
  status: string;
  createdAt: Date | null;
  details: JobDetails;
}

function safeText(value: unknown, fallback = ''): string {
  if (value == null) {
    return fallback;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return fallback;
}

export function resolveJobDescription(row: JobklientJobRow): string {
  return safeText(row.description) || safeText(row.discription);
}

export function resolveJobCreatedAt(row: JobklientJobRow): Date | null {
  const raw = row.created_at ?? row.createdAt;
  if (raw == null || raw === '') {
    return null;
  }

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  try {
    const date = new Date(String(raw));
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function resolveJobBudget(row: JobklientJobRow): { budget: number | null; budgetLabel: string } {
  try {
    const raw = row.budget;

    if (raw === null || raw === undefined || raw === '') {
      return { budget: null, budgetLabel: '—' };
    }

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return { budget: raw, budgetLabel: `${formatGel(raw)} ₾` };
    }

    const text = String(raw).trim();
    if (!text) {
      return { budget: null, budgetLabel: '—' };
    }

    const digits = text.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = Number(digits);

    if (Number.isFinite(parsed) && parsed > 0) {
      return { budget: parsed, budgetLabel: `${formatGel(parsed)} ₾` };
    }

    return { budget: null, budgetLabel: text.includes('₾') ? text : `${text} ₾` };
  } catch {
    return { budget: null, budgetLabel: '—' };
  }
}

function formatGel(value: number): string {
  try {
    return new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 0 }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

export function resolveJobStatus(row: JobklientJobRow): string {
  return safeText(row.status, '—');
}

const DESCRIPTION_FIELD_PATTERNS: Array<{
  key: keyof Omit<JobDetails, 'summary' | 'areaSqm'>;
  patterns: RegExp[];
}> = [
  {
    key: 'customerName',
    patterns: [/^(?:Заказчик|Customer|Клиент|Client):\s*(.+)$/iu],
  },
  {
    key: 'contact',
    patterns: [/^(?:Контакт|Contact):\s*(.+)$/iu],
  },
  {
    key: 'directedTo',
    patterns: [/^(?:Направлено|Directed to|Sent to):\s*(.+)$/iu],
  },
  {
    key: 'photoLink',
    patterns: [/^(?:Фото|Photo|Photos?):\s*(.+)$/iu],
  },
];

function parseAreaSqm(value: string): number | null {
  const match = value.match(/([\d.,]+)/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1].replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseJobContact(raw: string): JobContactInfo {
  const display = raw.trim();
  if (!display) {
    return { phone: null, telegram: null, display: '' };
  }

  const telegramUrlMatch = display.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/i);
  if (telegramUrlMatch?.[1]) {
    return { phone: null, telegram: telegramUrlMatch[1], display };
  }

  if (display.startsWith('@')) {
    return { phone: null, telegram: display.slice(1), display };
  }

  const digits = display.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length >= 9) {
    return { phone: digits, telegram: null, display };
  }

  return { phone: null, telegram: display.replace(/^@/, ''), display };
}

export function parseJobDetails(description: string): JobDetails {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const details: JobDetails = {
    areaSqm: null,
    customerName: null,
    contact: null,
    directedTo: null,
    photoLink: null,
    summary: '',
  };

  const summaryLines: string[] = [];

  for (const line of lines) {
    const areaMatch = line.match(/^(?:Площадь|Area|Площадь объекта):\s*(.+)$/iu);
    if (areaMatch) {
      details.areaSqm = parseAreaSqm(areaMatch[1]);
      continue;
    }

    let matched = false;
    for (const field of DESCRIPTION_FIELD_PATTERNS) {
      for (const pattern of field.patterns) {
        const match = line.match(pattern);
        if (!match?.[1]) {
          continue;
        }

        const value = match[1].trim();
        if (field.key === 'contact') {
          details.contact = parseJobContact(value);
        } else {
          details[field.key] = value;
        }
        matched = true;
        break;
      }
      if (matched) {
        break;
      }
    }

    if (!matched) {
      summaryLines.push(line);
    }
  }

  details.summary = summaryLines.join('\n').trim();
  const hasStructuredFields =
    details.customerName != null ||
    details.contact != null ||
    details.directedTo != null ||
    details.photoLink != null ||
    details.areaSqm != null;

  if (!details.summary && !hasStructuredFields) {
    details.summary = description.trim();
  }

  return details;
}

export function jobPhoneHref(contact: JobContactInfo | null): string | null {
  if (!contact?.phone) {
    return null;
  }

  return `tel:${contact.phone}`;
}

export function jobTelegramHref(contact: JobContactInfo | null): string | null {
  if (!contact?.telegram) {
    return null;
  }

  const username = contact.telegram.replace(/^@/, '');
  return username ? `https://t.me/${username}` : null;
}

export function mapJobklientRowToJob(row: JobklientJobRow | null | undefined, index: number): Job | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  try {
    const { budget, budgetLabel } = resolveJobBudget(row);
    const description = resolveJobDescription(row);
    const details = parseJobDetails(description);

    if (row.client_name?.trim() && !details.customerName) {
      details.customerName = row.client_name.trim();
    }

    if (row.phone?.trim() && !details.contact?.display) {
      details.contact = parseJobContact(row.phone.trim());
    }

    return {
      id: row.id != null && String(row.id).trim() ? String(row.id).trim() : `job-${index}`,
      title: safeText(row.title, 'Без названия'),
      city: safeText(row.city, '—'),
      category: safeText(row.category, '—'),
      budget,
      budgetLabel,
      description,
      status: resolveJobStatus(row),
      createdAt: resolveJobCreatedAt(row),
      details,
    };
  } catch {
    return null;
  }
}

export function mapJobklientRowsToJobs(rows: unknown): Job[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const jobs: Job[] = [];

  rows.forEach((row, index) => {
    const typedRow = row as JobklientJobRow;
    if (!isActiveJobklientJob(typedRow)) {
      return;
    }

    const job = mapJobklientRowToJob(typedRow, index);
    if (job) {
      jobs.push(job);
    }
  });

  return jobs;
}

const INACTIVE_JOB_STATUSES = new Set([
  'completed',
  'done',
  'archived',
  'deleted',
  'closed',
  'cancelled',
  'canceled',
  'выполнен',
  'выполнено',
  'закрыт',
  'закрыто',
  'удален',
  'удалён',
  'архив',
]);

export function isActiveJobklientJob(row: JobklientJobRow | null | undefined): boolean {
  if (!row || typeof row !== 'object') {
    return false;
  }

  if (row.is_active === false || row.active === false) {
    return false;
  }

  const rawStatus = safeText(row.status);
  const status = rawStatus.toLowerCase();

  if (status && INACTIVE_JOB_STATUSES.has(status)) {
    return false;
  }

  if (['New', 'new', 'Active', 'active'].includes(rawStatus)) {
    return true;
  }

  if (!status || status === '—') {
    return true;
  }

  return ['active', 'open', 'published', 'new', 'активен', 'активный'].includes(status);
}
