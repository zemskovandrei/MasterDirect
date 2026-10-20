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
/** Bumped when publish/storage logic changes — shown in /api/health and bot errors. */
export const CATALOG_BOT_BUILD = 'job-flow-v10';

export interface PublishCatalogCardResult {
  ok: boolean;
  specialistId?: string;
  profileUrl?: string;
  error?: string;
  warning?: string;
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
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('quicktime') || mime.includes('mov')) return 'mov';
  if (mime.includes('mp4') || mime.includes('m4v')) return 'mp4';
  if (mime.startsWith('video/')) return 'mp4';
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
  kind: 'image' | 'video' = 'image',
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
      `Скачивание ${kind === 'video' ? 'видео' : 'фото'} не удалось (${blobRes.status})${hint.startsWith('<') ? ' — пришёл HTML' : ''}`,
    );
  }

  const rawType = (blobRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const pathHint = fileJson.result.file_path.toLowerCase();
  let contentType = rawType;
  if (kind === 'video') {
    if (!contentType.startsWith('video/')) {
      if (pathHint.endsWith('.webm')) contentType = 'video/webm';
      else if (pathHint.endsWith('.mov')) contentType = 'video/quicktime';
      else contentType = 'video/mp4';
    }
  } else {
    contentType =
      contentType === 'image/png' || contentType === 'image/webp' || contentType === 'image/gif'
        ? contentType
        : 'image/jpeg';
  }
  const bytes = Buffer.from(await blobRes.arrayBuffer());
  return {
    bytes,
    contentType,
    ext: extensionFromMime(contentType),
  };
}

/** Direct Storage REST upload — avoids supabase-js URL/path quirks. */
async function uploadPortfolioFileRaw(
  supabaseUrl: string,
  serviceKey: string,
  specialistId: string,
  index: number,
  file: { bytes: Buffer; contentType: string; ext: string },
  folder: 'public' | 'videos' = 'public',
): Promise<string> {
  const safeId = specialistId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'bot';
  const objectPath = `${folder}/bot_${safeId}_${Date.now()}_${index}.${file.ext}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${PORTFOLIO_BUCKET}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': file.contentType,
      'x-upsert': 'false',
      'cache-control': 'max-age=3600',
    },
    body: new Uint8Array(file.bytes),
  });

  const bodyText = (await response.text()).trim();
  if (!response.ok) {
    console.error('[catalog-bot] storage upload failed', {
      status: response.status,
      uploadUrl,
      body: bodyText.slice(0, 300),
    });
    throw new Error(
      `Storage HTTP ${response.status} [${CATALOG_BOT_BUILD}] ${objectPath}: ${bodyText.slice(0, 160) || response.statusText}`,
    );
  }

  return `${supabaseUrl}/storage/v1/object/public/${PORTFOLIO_BUCKET}/${objectPath}`;
}

function formatCaughtError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Не удалось опубликовать карточку';
  }
  const message = error.message || 'Неизвестная ошибка';
  if (message.includes('ByteString') || message.includes('greater than 255')) {
    return (
      'В Railway в SUPABASE_SERVICE_ROLE_KEY попали русские буквы. ' +
      'Вставьте legacy service_role (Settings → API Keys → Reveal), ключ должен начинаться с eyJ.'
    );
  }
  if (message.includes("Unexpected token '<'") || message.includes('is not valid JSON')) {
    return (
      'Supabase вернул HTML вместо JSON. В Railway Variables проверьте SUPABASE_URL ' +
      '(должен быть https://….supabase.co) и SUPABASE_SERVICE_ROLE_KEY ' +
      '(лучше legacy service_role, начинается с eyJ).'
    );
  }
  if (message.includes('Invalid path')) {
    return (
      `${message} — SUPABASE_URL должен быть только https://….supabase.co (без /rest/v1). Билд ${CATALOG_BOT_BUILD}.`
    );
  }
  return `${message} [${CATALOG_BOT_BUILD}]`;
}

export async function publishCatalogCard(options: {
  supabase: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  botToken: string;
  session: BotSession;
  siteOrigin: string;
}): Promise<PublishCatalogCardResult> {
  const { supabase, supabaseUrl, serviceRoleKey, botToken, session, siteOrigin } = options;

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
  const origin = siteOrigin.replace(/\/$/, '');
  const profileUrl = `${origin}/masters/${specialistId}`;

  try {
    // 1) Create catalog row first (proves REST URL/key are OK).
    const { error: insertError } = await supabase.from('specialist').insert({
      id: specialistId,
      name,
      surname,
      phone,
      avatar_url: null,
      skills,
      city: cityValue,
      role: 'master',
      account_type: 'worker',
      whatsapp_phone: phone,
      tg_username: session.tgUsername || null,
      is_verified: false,
      is_archive: false,
      is_pro: false,
    });
    if (insertError) {
      return { ok: false, error: `БД specialist: ${insertError.message} [${CATALOG_BOT_BUILD}]` };
    }

    // 2) Upload photos via Storage REST.
    const uploadedUrls: string[] = [];
    let photoError: string | undefined;
    for (let i = 0; i < session.photos.length; i += 1) {
      try {
        const file = await downloadTelegramFile(botToken, session.photos[i].fileId);
        const url = await uploadPortfolioFileRaw(
          supabaseUrl,
          serviceRoleKey,
          specialistId,
          i,
          file,
          'public',
        );
        uploadedUrls.push(url);
      } catch (error) {
        photoError = formatCaughtError(error);
        console.error('[catalog-bot] photo upload stopped:', photoError);
        break;
      }
    }

    if (uploadedUrls.length > 0) {
      await supabase
        .from('specialist')
        .update({ avatar_url: uploadedUrls[0] })
        .eq('id', specialistId);

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
        console.error('[catalog-bot] portfolio_works insert failed:', worksError.message);
      }
    }

    const videos = session.videos ?? [];
    let videoError: string | undefined;
    let uploadedVideos = 0;
    for (let i = 0; i < videos.length; i += 1) {
      try {
        const file = await downloadTelegramFile(botToken, videos[i].fileId, 'video');
        const url = await uploadPortfolioFileRaw(
          supabaseUrl,
          serviceRoleKey,
          specialistId,
          i,
          file,
          'videos',
        );
        const { error: videoInsertError } = await supabase.from('work_videos').insert({
          id: randomUUID(),
          specialist_id: specialistId,
          title: `${specialtyLabels(session.specialties)} — видео ${i + 1}`,
          video_url: url,
          created_at: new Date().toISOString(),
        });
        if (videoInsertError) {
          throw new Error(videoInsertError.message);
        }
        uploadedVideos += 1;
      } catch (error) {
        videoError = formatCaughtError(error);
        console.error('[catalog-bot] video upload stopped:', videoError);
        break;
      }
    }

    if (uploadedUrls.length === 0 && uploadedVideos === 0) {
      return {
        ok: true,
        specialistId,
        profileUrl,
        warning: photoError || videoError
          ? `Анкета создана без медиа: ${photoError || videoError}`
          : 'Анкета создана без медиа',
      };
    }

    const warnings = [
      photoError ? `Часть фото не загрузилась: ${photoError}` : '',
      videoError ? `Часть видео не загрузилась: ${videoError}` : '',
    ].filter(Boolean);

    return {
      ok: true,
      specialistId,
      profileUrl,
      warning: warnings.length ? warnings.join(' ') : undefined,
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
    `Видео: ${(session.videos ?? []).length}`,
  ];
  return lines.join('\n');
}

export function listCityLabels(): string {
  return CITY_OPTIONS.map((item) => item.label).join(', ');
}
