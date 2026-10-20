import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CITY_OPTIONS,
  cityLabel,
  specialtyLabel,
  type BotSession,
} from './catalog-bot-types';

const ORDERS_BUCKET = 'orders-files';

export interface PublishJobResult {
  ok: boolean;
  orderId?: number | string;
  jobsUrl?: string;
  error?: string;
  warning?: string;
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
  const fileJson = (await fileRes.json()) as {
    ok: boolean;
    description?: string;
    result?: { file_path?: string };
  };
  if (!fileJson.ok || !fileJson.result?.file_path) {
    throw new Error(fileJson.description || 'Не удалось получить файл из Telegram');
  }

  const downloadUrl = `https://api.telegram.org/file/bot${botToken}/${fileJson.result.file_path}`;
  const blobRes = await fetch(downloadUrl);
  if (!blobRes.ok) {
    throw new Error(`Скачивание ${kind === 'video' ? 'видео' : 'фото'} не удалось (${blobRes.status})`);
  }

  const rawType = (blobRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const pathHint = fileJson.result.file_path.toLowerCase();
  let contentType = rawType;
  let ext = 'jpg';
  if (kind === 'video') {
    if (!contentType.startsWith('video/')) {
      contentType = pathHint.endsWith('.webm')
        ? 'video/webm'
        : pathHint.endsWith('.mov')
          ? 'video/quicktime'
          : 'video/mp4';
    }
    ext = contentType.includes('webm')
      ? 'webm'
      : contentType.includes('quicktime') || contentType.includes('mov')
        ? 'mov'
        : 'mp4';
  } else {
    contentType =
      contentType === 'image/png' || contentType === 'image/webp' || contentType === 'image/gif'
        ? contentType
        : 'image/jpeg';
    ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
          ? 'gif'
          : 'jpg';
  }

  return {
    bytes: Buffer.from(await blobRes.arrayBuffer()),
    contentType,
    ext,
  };
}

async function uploadOrderFile(
  supabaseUrl: string,
  serviceKey: string,
  index: number,
  file: { bytes: Buffer; contentType: string; ext: string },
): Promise<{ path: string; publicUrl: string }> {
  const objectPath = `bot_${Date.now()}_${index}.${file.ext}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${ORDERS_BUCKET}/${objectPath}`;

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': file.contentType,
      'x-upsert': 'false',
    },
    body: new Uint8Array(file.bytes),
  });

  const bodyText = (await response.text()).trim();
  if (!response.ok) {
    throw new Error(`Storage HTTP ${response.status}: ${bodyText.slice(0, 160)}`);
  }

  return {
    path: objectPath,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${ORDERS_BUCKET}/${objectPath}`,
  };
}

export function formatJobPreview(session: BotSession): string {
  const category = session.category ? specialtyLabel(session.category) : '—';
  const city = session.city ? cityLabel(session.city) : '—';
  return [
    'Проверьте заказ перед публикацией:',
    '',
    `Заказчик: ${session.name ?? '—'}`,
    `Телефон: ${session.phone ?? '—'}`,
    `Город: ${city}`,
    `Категория: ${category}`,
    `Описание: ${session.description ?? '—'}`,
    `Бюджет: ${session.budget != null ? `${session.budget} ₾` : 'не указан'}`,
    `Фото: ${session.photos.length}`,
    `Видео: ${(session.videos ?? []).length}`,
  ].join('\n');
}

export async function publishJobOrder(options: {
  supabase: SupabaseClient;
  supabaseUrl: string;
  serviceRoleKey: string;
  botToken: string;
  session: BotSession;
  siteOrigin: string;
}): Promise<PublishJobResult> {
  const { supabase, supabaseUrl, serviceRoleKey, botToken, session, siteOrigin } = options;

  if (!session.name?.trim() || !session.phone?.trim() || !session.city || !session.category) {
    return { ok: false, error: 'Не хватает имени, телефона, города или категории' };
  }
  if (!session.description?.trim() || session.description.trim().length < 10) {
    return { ok: false, error: 'Нужно описание работ (хотя бы пару предложений)' };
  }

  const name = session.name.trim();
  const phone = session.phone.trim();
  const city = cityLabel(session.city);
  const category = specialtyLabel(session.category);
  const title = `${category} — ${city}`;
  const jobsUrl = `${siteOrigin.replace(/\/$/, '')}/jobs`;

  try {
    const photoUrls: string[] = [];
    const photoPaths: string[] = [];
    let photoWarning: string | undefined;

    for (let i = 0; i < session.photos.length; i += 1) {
      try {
        const file = await downloadTelegramFile(botToken, session.photos[i].fileId, 'image');
        const uploaded = await uploadOrderFile(supabaseUrl, serviceRoleKey, i, file);
        photoUrls.push(uploaded.publicUrl);
        photoPaths.push(uploaded.path);
      } catch (error) {
        photoWarning =
          error instanceof Error ? error.message : 'Не удалось загрузить часть фото';
        console.error('[catalog-bot] job photo upload failed:', photoWarning);
        break;
      }
    }

    const videoUrls: string[] = [];
    let videoWarning: string | undefined;
    const videos = session.videos ?? [];
    for (let i = 0; i < videos.length; i += 1) {
      try {
        const file = await downloadTelegramFile(botToken, videos[i].fileId, 'video');
        const uploaded = await uploadOrderFile(
          supabaseUrl,
          serviceRoleKey,
          session.photos.length + i,
          file,
        );
        videoUrls.push(uploaded.publicUrl);
        photoPaths.push(uploaded.path);
      } catch (error) {
        videoWarning =
          error instanceof Error ? error.message : 'Не удалось загрузить часть видео';
        console.error('[catalog-bot] job video upload failed:', videoWarning);
        break;
      }
    }

    const description = [
      `Заказчик: ${name}`,
      `Контакт: ${phone}`,
      session.tgUsername ? `Telegram: @${session.tgUsername}` : '',
      `Состав работ:\n${session.description.trim()}`,
      ...photoUrls.map((url) => `Фото объекта: ${url}`),
      ...videoUrls.map((url) => `Видео объекта: ${url}`),
      'Направлено: Telegram-бот',
    ]
      .filter(Boolean)
      .join('\n');

    const { data, error } = await supabase
      .from('order')
      .insert({
        user_id: null,
        title,
        client_name: name,
        client_phone: phone,
        city,
        category,
        budget: session.budget ?? null,
        description,
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      return { ok: false, error: `БД order: ${error.message}` };
    }

    const orderId = data?.id;
    if (orderId != null && photoPaths.length > 0) {
      const rows = photoPaths.map((path) => ({
        order_id: orderId,
        file_path: path,
      }));
      const { error: filesError } = await supabase.from('order_files').insert(rows);
      if (filesError) {
        console.error('[catalog-bot] order_files insert failed:', filesError.message);
      }
    }

    return {
      ok: true,
      orderId,
      jobsUrl,
      warning: (() => {
        const parts = [
          photoWarning ? `фото: ${photoWarning}` : '',
          videoWarning ? `видео: ${videoWarning}` : '',
        ].filter(Boolean);
        return parts.length ? `Заказ создан, но ${parts.join('; ')}` : undefined;
      })(),
    };
  } catch (error) {
    console.error('[catalog-bot] publishJobOrder failed:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось опубликовать заказ',
    };
  }
}

export function listJobCityLabels(): string {
  return CITY_OPTIONS.map((item) => item.label).join(', ');
}
