import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CITY_OPTIONS,
  SPECIALTY_OPTIONS,
  cityLabel,
  specialtyLabels,
  type BotSession,
} from './catalog-bot-types';

const PORTFOLIO_BUCKET = 'portfolio';

export interface PublishCatalogCardResult {
  ok: boolean;
  specialistId?: string;
  profileUrl?: string;
  error?: string;
}

function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { name: 'Мастер', surname: '-' };
  }
  if (parts.length === 1) {
    return { name: parts[0], surname: '-' };
  }
  return {
    name: parts[0],
    surname: parts.slice(1).join(' '),
  };
}

function extensionFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

async function parseJsonResponse<T>(
  response: Response,
  label: string,
): Promise<T> {
  const text = await response.text();
  const trimmed = text.trimStart();
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(
      `${label}: сервер вернул HTML вместо JSON (HTTP ${response.status}). Проверьте URL/токен в Variables на Railway.`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label}: неверный JSON (HTTP ${response.status}): ${trimmed.slice(0, 120)}`);
  }
}

async function downloadTelegramFile(
  botToken: string,
  fileId: string,
): Promise<{ bytes: Buffer; contentType: string; ext: string }> {
  const fileRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId }),
  });
  const fileJson = await parseJsonResponse<{
    ok: boolean;
    description?: string;
    result?: { file_path?: string };
  }>(fileRes, 'Telegram getFile');
  if (!fileJson.ok || !fileJson.result?.file_path) {
    throw new Error(fileJson.description || 'Не удалось получить файл из Telegram');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileJson.result.file_path}`;
  const blobRes = await fetch(downloadUrl);
  if (!blobRes.ok) {
    const hint = (await blobRes.text()).trimStart().slice(0, 80);
    throw new Error(
      `Скачивание фото не удалось (${blobRes.status})${hint.startsWith('<') ? ' — пришёл HTML' : ''}`,
    );
  }

  const contentType = blobRes.headers.get('content-type') || 'image/jpeg';
  const bytes = Buffer.from(await blobRes.arrayBuffer());
  return {
    bytes,
    contentType,
    ext: extensionFromMime(contentType),
  };
}

async function uploadPortfolioImage(
  supabase: SupabaseClient,
  specialistId: string,
  index: number,
  file: { bytes: Buffer; contentType: string; ext: string },
): Promise<string> {
  const path = `bot/${specialistId}/${Date.now()}_${index}.${file.ext}`;
  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, new Uint8Array(file.bytes), {
      contentType: file.contentType,
      upsert: false,
      cacheControl: '3600',
    });
  if (error) {
    throw new Error(`Storage upload (${PORTFOLIO_BUCKET}): ${error.message}`);
  }
  return supabase.storage.from(PORTFOLIO_BUCKET).getPublicUrl(path).data.publicUrl;
}

function formatCaughtError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Не удалось опубликовать карточку';
  }
  const message = error.message || 'Неизвестная ошибка';
  if (message.includes("Unexpected token '<'") || message.includes('is not valid JSON')) {
    return (
      'Supabase вернул HTML вместо JSON. В Railway Variables проверьте SUPABASE_URL ' +
      '(должен быть https://….supabase.co) и SUPABASE_SERVICE_ROLE_KEY ' +
      '(лучше legacy service_role, начинается с eyJ).'
    );
  }
  return message;
}

export async function publishCatalogCard(options: {
  supabase: SupabaseClient;
  botToken: string;
  session: BotSession;
  siteOrigin: string;
}): Promise<PublishCatalogCardResult> {
  const { supabase, botToken, session, siteOrigin } = options;

  if (!session.name?.trim() || !session.phone?.trim() || !session.city) {
    return { ok: false, error: 'Не хватает имени, телефона или города' };
  }
  if (!session.specialties.length) {
    return { ok: false, error: 'Не выбрана специальность' };
  }
  if (!session.photos.length) {
    return { ok: false, error: 'Нужно хотя бы одно фото' };
  }

  const specialistId = randomUUID();
  const { name, surname } = splitName(session.name);
  const phone = session.phone.trim();
  const cityName = cityLabel(session.city);
  const district = session.district?.trim();
  const cityValue = district ? `${cityName} · ${district}` : cityName;
  const skills = session.specialties
    .map((key) => SPECIALTY_OPTIONS.find((item) => item.key === key)?.key ?? key)
    .filter(Boolean);

  try {
    const uploadedUrls: string[] = [];
    for (let i = 0; i < session.photos.length; i += 1) {
      const file = await downloadTelegramFile(botToken, session.photos[i].fileId);
      const url = await uploadPortfolioImage(supabase, specialistId, i, file);
      uploadedUrls.push(url);
    }

    const avatarUrl = uploadedUrls[0] ?? null;
    const specialistPayload = {
      id: specialistId,
      name,
      surname,
      phone,
      avatar_url: avatarUrl,
      skills,
      city: cityValue,
      role: 'master',
      account_type: 'worker',
      whatsapp_phone: phone,
      tg_username: session.tgUsername || null,
      is_verified: false,
      is_archive: false,
      is_pro: false,
    };

    const { error: insertError } = await supabase.from('specialist').insert(specialistPayload);
    if (insertError) {
      return { ok: false, error: insertError.message };
    }

    const workRows = uploadedUrls.map((url, index) => ({
      before_image_url: url,
      after_image_url: url,
      description: `${specialtyLabels(session.specialties)} — фото ${index + 1}`,
      specialist_id: specialistId,
      owner_type: 'worker',
      status: 'verified',
    }));

    const { error: worksError } = await supabase.from('portfolio_works').insert(workRows);
    if (worksError) {
      // Profile already visible; photos are best-effort.
      console.error('[catalog-bot] portfolio_works insert failed:', worksError.message);
    }

    const origin = siteOrigin.replace(/\/$/, '');
    return {
      ok: true,
      specialistId,
      profileUrl: `${origin}/masters/${specialistId}`,
    };
  } catch (error) {
    console.error('[catalog-bot] publishCatalogCard failed:', error);
    return {
      ok: false,
      error: formatCaughtError(error),
    };
  }
}

export function formatSessionPreview(session: BotSession): string {
  const lines = [
    'Проверьте анкету перед публикацией:',
    '',
    `Имя: ${session.name ?? '—'}`,
    `Телефон: ${session.phone ?? '—'}`,
    `Специальность: ${specialtyLabels(session.specialties) || '—'}`,
    `Город: ${session.city ? cityLabel(session.city) : '—'}`,
    `Район: ${session.district?.trim() || '—'}`,
    `Фото: ${session.photos.length}`,
  ];
  return lines.join('\n');
}

export function listCityLabels(): string {
  return CITY_OPTIONS.map((item) => item.label).join(', ');
}
