import type { FurnitureOrderInsert } from '../core/models/master.model';
import { environment } from '../../environments/environment';

const ORDER_FILES_BUCKET = 'orders-files';
export interface JobklientJobRow {
  id?: number | string | null;
  title?: string | null;
  client_name?: string | null;
  client_phone?: string | null;
  phone?: string | null;
  file?: string | null;
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
  order_files?: Array<{ file_path?: string | null }> | null;
}

/**
 * Payload для `.insert()` в таблицу `order`.
 * Поля в snake_case — строго по колонкам Supabase.
 */
export interface JobklientJobInsert {
  title: string;
  client_name: string;
  phone: string;
  client_phone: string;
  city: string;
  category: string;
  budget?: number | string | null;
  description?: string;
  status?: string;
  file?: string | null;
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
    client_phone: input.contact.trim(),
    city: input.city,
    category: input.renovationTypeLabel,
    budget: input.estimatedTotal ?? null,
    description: descriptionLines.join('\n'),
    status: 'active',
  };
}

/** Преобразует типизированный payload в объект для Supabase `.insert()`. */
export function toJobklientDbRow(input: JobklientJobInsert): {
  title: string;
  client_name: string;
  client_phone: string;
  phone: string;
  city: string;
  category: string;
  budget: number | string | null;
  description: string | null;
  status: string;
  file: string | null;
} {
  const clientPhone = input.client_phone.trim() || input.phone.trim();

  return {
    title: input.title.trim(),
    client_name: input.client_name.trim(),
    client_phone: clientPhone,
    phone: clientPhone,
    city: input.city.trim(),
    category: input.category.trim(),
    budget: input.budget ?? null,
    description: input.description?.trim() || null,
    status: input.status?.trim() || 'active',
    file: input.file?.trim() || null,
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

export interface JobScopeSection {
  title: string;
  items: string[];
}

export interface JobDetails {
  areaSqm: number | null;
  customerName: string | null;
  contact: JobContactInfo | null;
  directedTo: string | null;
  photoLink: string | null;
  summary: string;
  scopeSections: JobScopeSection[];
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
  key: keyof Omit<JobDetails, 'summary' | 'areaSqm' | 'scopeSections'>;
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
    patterns: [
      /^(?:📷\s*)?(?:Фото(?:\s+объекта)?|Photo|Photos?):\s*(.+)$/iu,
    ],
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

const JOB_SCOPE_START =
  /^(?:📋\s*)?(?:Состав работ|Work scope|Scope of work):\s*(.*)$/iu;

const JOB_SCOPE_END =
  /^(?:📷\s*)?(?:Фото(?:\s+объекта)?|Photo|Photos?):|(?:Направлено|Directed to|Sent to):|(?:Выезд(?: на замер)?|Site visit|Call.?out):|Согласие на платный выезд|I agree to a paid site visit/iu;

const JOB_SCOPE_BULLET = /^[•\-–—*]\s*(.+)$/u;

/** Пункты чек-листа из блока «Состав работ» в описании заказа. */
export function parseJobScopeSections(description: string): JobScopeSection[] {
  const lines = description.split('\n').map((line) => line.trim());

  let startIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (JOB_SCOPE_START.test(lines[index])) {
      startIndex = index;
      break;
    }
  }

  if (startIndex < 0) {
    return [];
  }

  const sections: JobScopeSection[] = [];
  let current: JobScopeSection = { title: '', items: [] };

  const headerMatch = lines[startIndex].match(JOB_SCOPE_START);
  const inlineItem = headerMatch?.[1]?.trim();
  if (inlineItem) {
    current.items.push(inlineItem);
  }

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) {
      continue;
    }

    if (JOB_SCOPE_END.test(line)) {
      break;
    }

    if (/^(?:Заказчик|Customer|Клиент|Client|Контакт|Contact|Площадь|Area):/iu.test(line)) {
      break;
    }

    const bulletMatch = line.match(JOB_SCOPE_BULLET);
    if (bulletMatch?.[1]) {
      current.items.push(bulletMatch[1].trim());
      continue;
    }

    if (/^(.{2,100}):$/.test(line) && !line.includes('://')) {
      if (current.title || current.items.length > 0) {
        sections.push(current);
      }
      current = { title: line.slice(0, -1).trim(), items: [] };
      continue;
    }

    current.items.push(line);
  }

  if (current.title || current.items.length > 0) {
    sections.push(current);
  }

  return sections.filter((section) => section.items.length > 0);
}

export function jobScopeItemCount(sections: JobScopeSection[]): number {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

function isJobScopeBlockLine(line: string): boolean {
  return JOB_SCOPE_START.test(line) || JOB_SCOPE_END.test(line);
}

function stripJobScopeBlock(description: string): string {
  const lines = description.split('\n');
  let startIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    if (JOB_SCOPE_START.test(lines[index].trim())) {
      startIndex = index;
      break;
    }
  }

  if (startIndex < 0) {
    return description;
  }

  const kept: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (index < startIndex) {
      kept.push(lines[index]);
      continue;
    }

    if (index === startIndex) {
      continue;
    }

    const trimmed = lines[index].trim();
    if (!trimmed) {
      continue;
    }

    if (JOB_SCOPE_END.test(trimmed)) {
      kept.push(...lines.slice(index));
      break;
    }

    if (/^(?:Заказчик|Customer|Клиент|Client|Контакт|Contact|Площадь|Area):/iu.test(trimmed)) {
      kept.push(...lines.slice(index));
      break;
    }
  }

  return kept.join('\n').trim();
}

export function parseJobDetails(description: string): JobDetails {
  const scopeSections = parseJobScopeSections(description);
  const normalizedDescription = stripJobScopeBlock(description);
  const lines = normalizedDescription
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
    scopeSections,
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
    details.summary = normalizedDescription.trim();
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

/** Публичный URL файла в bucket `orders-files` по относительному пути. */
function orderFileStoragePublicUrl(path: string): string {
  const base = environment.supabase.url.replace(/\/$/, '');
  const objectPath = path
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${ORDER_FILES_BUCKET}/`), '');
  return `${base}/storage/v1/object/public/${ORDER_FILES_BUCKET}/${objectPath}`;
}

/** Извлекает сырое значение ссылки на фото из текста описания заказа. */
export function extractPhotoLinkRaw(text: string): string | null {
  if (!text?.trim()) {
    return null;
  }

  const patterns = [
    /(?:^|\n)\s*(?:📷\s*)?(?:Фото(?:\s+объекта)?|Photo|Photos?):\s*(.+?)\s*(?:\n|$)/giu,
    /(?:^|\n)\s*📷\s*(.+?)\s*(?:\n|$)/giu,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

/** Лучший URL/data URL для показа фото заказа. */
export function resolveJobPhotoForJob(job: Job): string | null {
  const candidates = [job.details?.photoLink, extractPhotoLinkRaw(job.description)].filter(
    (value): value is string => !!value?.trim(),
  );

  for (const candidate of candidates) {
    const resolved = resolveJobPhotoSrc(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

/** URL/data URL для превью фото заказа на доске. */
export function resolveJobPhotoSrc(photoLink?: string | null): string | null {
  const link = photoLink?.trim();
  if (!link) {
    return null;
  }

  if (/^data:image\//i.test(link)) {
    return link;
  }

  if (/^https?:\/\//i.test(link)) {
    if (/storage\/v1\/object\/(?:public|sign)\//i.test(link)) {
      return link;
    }
    if (/\.(jpe?g|png|webp|gif|bmp|svg|avif|heic)(\?|#|$)/i.test(link)) {
      return link;
    }
    if (/supabase\.co/i.test(link)) {
      return link;
    }
    return null;
  }

  if (!/[\s<>]/.test(link)) {
    return orderFileStoragePublicUrl(link);
  }

  return null;
}

function firstOrderFilePath(row: JobklientJobRow): string | null {
  const files = row.order_files;
  if (!files?.length) {
    return null;
  }

  for (const item of files) {
    const path = item?.file_path?.trim();
    if (path) {
      return path;
    }
  }

  return null;
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

    if (row.client_phone?.trim() && !details.contact?.display) {
      details.contact = parseJobContact(row.client_phone.trim());
    }

    const photoCandidates = [
      details.photoLink,
      extractPhotoLinkRaw(description),
      row.file?.trim(),
      firstOrderFilePath(row),
    ].filter((value): value is string => !!value?.trim());

    details.photoLink = null;
    for (const candidate of photoCandidates) {
      const resolved = resolveJobPhotoSrc(candidate);
      if (resolved) {
        details.photoLink = resolved;
        break;
      }
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

export function isCompletedOrderStatus(status: string | null | undefined): boolean {
  const normalized = safeText(status).toLowerCase();
  if (!normalized || normalized === '—') {
    return false;
  }

  return INACTIVE_JOB_STATUSES.has(normalized);
}

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
