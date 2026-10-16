import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CITY_OPTIONS,
  MAX_PHOTOS,
  MIN_PHOTOS,
  SPECIALTY_OPTIONS,
  createEmptySession,
  specialtyLabels,
  type BotSession,
  type CityId,
} from './catalog-bot-types';
import { formatSessionPreview, publishCatalogCard } from './publish-catalog-card';

interface TelegramUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
  photo?: TelegramPhotoSize[];
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

type InlineKeyboard = InlineKeyboardButton[][];

const sessions = new Map<number, BotSession>();

function apiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function telegramCall<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(apiUrl(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json()) as { ok: boolean; description?: string; result: T };
  if (!json.ok) {
    throw new Error(json.description || `Telegram API error: ${method}`);
  }
  return json.result;
}

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await telegramCall(token, 'sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: keyboard
      ? {
          inline_keyboard: keyboard,
        }
      : undefined,
  });
}

async function answerCallback(token: string, callbackId: string, text?: string): Promise<void> {
  await telegramCall(token, 'answerCallbackQuery', {
    callback_query_id: callbackId,
    text,
  });
}

function specialtyKeyboard(session: BotSession): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (let i = 0; i < SPECIALTY_OPTIONS.length; i += 2) {
    const left = SPECIALTY_OPTIONS[i];
    const right = SPECIALTY_OPTIONS[i + 1];
    const row: InlineKeyboardButton[] = [
      {
        text: `${session.specialties.includes(left.key) ? '✅ ' : ''}${left.label}`,
        callback_data: `spec:${left.key}`,
      },
    ];
    if (right) {
      row.push({
        text: `${session.specialties.includes(right.key) ? '✅ ' : ''}${right.label}`,
        callback_data: `spec:${right.key}`,
      });
    }
    rows.push(row);
  }
  rows.push([{ text: 'Далее →', callback_data: 'spec:next' }]);
  return rows;
}

function cityKeyboard(): InlineKeyboard {
  return [
    CITY_OPTIONS.map((city) => ({
      text: city.label,
      callback_data: `city:${city.key}`,
    })),
  ];
}

function photosKeyboard(count: number): InlineKeyboard {
  const rows: InlineKeyboard = [];
  if (count >= MIN_PHOTOS) {
    rows.push([{ text: 'Готово, проверить анкету', callback_data: 'photos:done' }]);
  }
  rows.push([{ text: 'Начать заново', callback_data: 'flow:restart' }]);
  return rows;
}

function confirmKeyboard(): InlineKeyboard {
  return [
    [{ text: '📢 Опубликовать в каталог', callback_data: 'flow:publish' }],
    [{ text: 'Изменить / начать заново', callback_data: 'flow:restart' }],
  ];
}

function getSession(chatId: number, username?: string | null): BotSession {
  const existing = sessions.get(chatId);
  if (existing) {
    if (username && !existing.tgUsername) {
      existing.tgUsername = username;
    }
    return existing;
  }
  const created = createEmptySession(username);
  sessions.set(chatId, created);
  return created;
}

function resetSession(chatId: number, username?: string | null): BotSession {
  const created = createEmptySession(username);
  sessions.set(chatId, created);
  return created;
}

async function askName(token: string, chatId: number): Promise<void> {
  await sendMessage(
    token,
    chatId,
    [
      'Привет! Я бот MasterDirect.',
      'Соберу вашу карточку и сразу поставлю её в каталог на сайте — регистрация не нужна.',
      '',
      'Как вас зовут? (имя и фамилия)',
    ].join('\n'),
  );
}

async function handleStart(
  token: string,
  chatId: number,
  username?: string | null,
): Promise<void> {
  resetSession(chatId, username);
  await askName(token, chatId);
}

async function handleText(
  token: string,
  chatId: number,
  text: string,
  username?: string | null,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === '/start' || trimmed === '/new') {
    await handleStart(token, chatId, username);
    return;
  }
  if (trimmed === '/cancel') {
    sessions.delete(chatId);
    await sendMessage(token, chatId, 'Ок, анкету отменил. Напишите /start чтобы начать снова.');
    return;
  }

  const session = getSession(chatId, username);

  switch (session.step) {
    case 'name': {
      if (trimmed.length < 2) {
        await sendMessage(token, chatId, 'Напишите имя полностью, например: Андрей Земсков');
        return;
      }
      session.name = trimmed;
      session.step = 'phone';
      await sendMessage(
        token,
        chatId,
        'Телефон для клиентов (WhatsApp тоже ок), например: +995 5XX XXX XXX',
      );
      return;
    }
    case 'phone': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 8) {
        await sendMessage(token, chatId, 'Нужен номер телефона, минимум 8 цифр.');
        return;
      }
      session.phone = trimmed;
      session.step = 'specialty';
      await sendMessage(
        token,
        chatId,
        'Выберите виды работ (можно несколько), затем нажмите «Далее»:',
        specialtyKeyboard(session),
      );
      return;
    }
    case 'district': {
      if (trimmed.length < 2) {
        await sendMessage(token, chatId, 'Напишите район работы, например: Старый Батуми / Хелвачаури');
        return;
      }
      session.district = trimmed;
      session.step = 'photos';
      session.photos = [];
      await sendMessage(
        token,
        chatId,
        `Пришлите от ${MIN_PHOTOS} до ${MAX_PHOTOS} фото работ (по одному сообщению).\nКогда закончите — нажмите «Готово».`,
        photosKeyboard(0),
      );
      return;
    }
    case 'photos': {
      await sendMessage(
        token,
        chatId,
        `Сейчас жду фото. Уже ${session.photos.length} из ${MAX_PHOTOS}. Пришлите фото или нажмите «Готово».`,
        photosKeyboard(session.photos.length),
      );
      return;
    }
    case 'confirm': {
      await sendMessage(token, chatId, formatSessionPreview(session), confirmKeyboard());
      return;
    }
    default: {
      await sendMessage(
        token,
        chatId,
        'Используйте кнопки ниже или напишите /start чтобы начать заново.',
      );
    }
  }
}

async function handlePhoto(
  token: string,
  chatId: number,
  photos: TelegramPhotoSize[],
  username?: string | null,
): Promise<void> {
  const session = getSession(chatId, username);
  if (session.step !== 'photos') {
    await sendMessage(token, chatId, 'Сначала заполним анкету. Напишите /start');
    return;
  }

  if (session.photos.length >= MAX_PHOTOS) {
    await sendMessage(
      token,
      chatId,
      `Уже ${MAX_PHOTOS} фото — этого достаточно. Нажмите «Готово».`,
      photosKeyboard(session.photos.length),
    );
    return;
  }

  const best = [...photos].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!best) {
    await sendMessage(token, chatId, 'Не смог прочитать фото, пришлите ещё раз.');
    return;
  }

  if (session.photos.some((item) => item.fileUniqueId === best.file_unique_id)) {
    await sendMessage(token, chatId, 'Это фото уже добавлено.');
    return;
  }

  session.photos.push({
    fileId: best.file_id,
    fileUniqueId: best.file_unique_id,
  });

  if (session.photos.length >= MAX_PHOTOS) {
    session.step = 'confirm';
    await sendMessage(
      token,
      chatId,
      `Принял ${session.photos.length} фото.\n\n${formatSessionPreview(session)}`,
      confirmKeyboard(),
    );
    return;
  }

  await sendMessage(
    token,
    chatId,
    `Фото ${session.photos.length}/${MAX_PHOTOS} принято. Пришлите ещё или нажмите «Готово».`,
    photosKeyboard(session.photos.length),
  );
}

async function handleCallback(
  token: string,
  supabase: SupabaseClient,
  siteOrigin: string,
  query: TelegramCallbackQuery,
): Promise<void> {
  const chatId = query.message?.chat.id;
  if (!chatId || !query.data) {
    return;
  }

  const username = query.from.username ?? null;
  const session = getSession(chatId, username);
  const data = query.data;

  if (data === 'flow:restart') {
    await answerCallback(token, query.id, 'Начинаем заново');
    await handleStart(token, chatId, username);
    return;
  }

  if (data.startsWith('spec:')) {
    const key = data.slice(5);
    if (key === 'next') {
      if (!session.specialties.length) {
        await answerCallback(token, query.id, 'Выберите хотя бы одну специальность');
        return;
      }
      session.step = 'city';
      await answerCallback(token, query.id);
      await sendMessage(token, chatId, 'Выберите город:', cityKeyboard());
      return;
    }

    if (session.specialties.includes(key)) {
      session.specialties = session.specialties.filter((item) => item !== key);
    } else {
      session.specialties = [...session.specialties, key];
    }
    await answerCallback(token, query.id, specialtyLabels(session.specialties) || 'Выбрано');
    await sendMessage(
      token,
      chatId,
      `Выбрано: ${specialtyLabels(session.specialties) || 'пока ничего'}\nМожно отметить ещё или нажать «Далее».`,
      specialtyKeyboard(session),
    );
    return;
  }

  if (data.startsWith('city:')) {
    const city = data.slice(5) as CityId;
    if (!CITY_OPTIONS.some((item) => item.key === city)) {
      await answerCallback(token, query.id, 'Неизвестный город');
      return;
    }
    session.city = city;
    session.step = 'district';
    await answerCallback(token, query.id);
    await sendMessage(
      token,
      chatId,
      'Напишите район работы текстом (например: Центр, Хелвачаури, Старый Батуми):',
    );
    return;
  }

  if (data === 'photos:done') {
    if (session.photos.length < MIN_PHOTOS) {
      await answerCallback(token, query.id, `Нужно минимум ${MIN_PHOTOS} фото`);
      return;
    }
    session.step = 'confirm';
    await answerCallback(token, query.id);
    await sendMessage(token, chatId, formatSessionPreview(session), confirmKeyboard());
    return;
  }

  if (data === 'flow:publish') {
    await answerCallback(token, query.id, 'Публикую…');
    await sendMessage(token, chatId, 'Публикую карточку в каталог, подождите…');
    const result = await publishCatalogCard({
      supabase,
      botToken: token,
      session,
      siteOrigin,
    });

    if (!result.ok) {
      await sendMessage(
        token,
        chatId,
        `Не получилось опубликовать: ${result.error ?? 'ошибка'}\nПопробуйте /start ещё раз или напишите админу.`,
      );
      return;
    }

    sessions.delete(chatId);
    await sendMessage(
      token,
      chatId,
      [
        'Готово! Карточка уже в каталоге MasterDirect.',
        result.profileUrl ? `Ссылка: ${result.profileUrl}` : '',
        '',
        'Пароль и регистрация на сайте не нужны.',
        'Новую анкету: /start',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
}

async function processUpdate(
  token: string,
  supabase: SupabaseClient,
  siteOrigin: string,
  update: TelegramUpdate,
): Promise<void> {
  if (update.callback_query) {
    await handleCallback(token, supabase, siteOrigin, update.callback_query);
    return;
  }

  const message = update.message;
  if (!message?.chat?.id) {
    return;
  }

  const chatId = message.chat.id;
  const username = message.from?.username ?? null;

  if (message.photo?.length) {
    await handlePhoto(token, chatId, message.photo, username);
    return;
  }

  if (message.text) {
    await handleText(token, chatId, message.text, username);
  }
}

export function startCatalogTelegramBot(options: {
  token: string;
  supabase: SupabaseClient;
  siteOrigin: string;
}): void {
  const { token, supabase, siteOrigin } = options;
  let offset = 0;
  let stopped = false;

  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const updates = await telegramCall<TelegramUpdate[]>(token, 'getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          try {
            await processUpdate(token, supabase, siteOrigin, update);
          } catch (error) {
            console.error('[catalog-bot] update failed:', error);
          }
        }
      } catch (error) {
        console.error('[catalog-bot] polling error:', error);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  void telegramCall(token, 'getMe')
    .then((me) => {
      console.log('[catalog-bot] Telegram bot started:', me);
      void loop();
    })
    .catch((error) => {
      console.error('[catalog-bot] failed to start:', error);
      stopped = true;
    });
}
