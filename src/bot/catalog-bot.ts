import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CITY_OPTIONS,
  MAX_JOB_PHOTOS,
  MAX_PHOTOS,
  MIN_JOB_PHOTOS,
  MIN_PHOTOS,
  MIN_REVIEW_CHARS,
  SPECIALTY_OPTIONS,
  createEmptySession,
  specialtyLabel,
  specialtyLabels,
  startJobSession,
  startMasterSession,
  startReviewSession,
  type BotSession,
  type CityId,
  type ReviewKind,
} from './catalog-bot-types';
import { formatSessionPreview, publishCatalogCard } from './publish-catalog-card';
import { formatJobPreview, publishJobOrder } from './publish-job';
import { formatReviewPreview, publishSiteReview } from './publish-review';

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

function menuKeyboard(): InlineKeyboard {
  return [
    [{ text: '👷 Я мастер — в каталог', callback_data: 'menu:master' }],
    [{ text: '📋 Разместить заказ', callback_data: 'menu:job' }],
    [{ text: '⭐ Оставить отзыв', callback_data: 'menu:review' }],
  ];
}

function specialtyKeyboard(session: BotSession, multi: boolean): InlineKeyboard {
  const rows: InlineKeyboard = [];
  for (let i = 0; i < SPECIALTY_OPTIONS.length; i += 2) {
    const left = SPECIALTY_OPTIONS[i];
    const right = SPECIALTY_OPTIONS[i + 1];
    const prefix = multi ? 'spec' : 'jobcat';
    const row: InlineKeyboardButton[] = [
      {
        text: `${multi && session.specialties.includes(left.key) ? '✅ ' : ''}${left.label}`,
        callback_data: `${prefix}:${left.key}`,
      },
    ];
    if (right) {
      row.push({
        text: `${multi && session.specialties.includes(right.key) ? '✅ ' : ''}${right.label}`,
        callback_data: `${prefix}:${right.key}`,
      });
    }
    rows.push(row);
  }
  if (multi) {
    rows.push([{ text: 'Далее →', callback_data: 'spec:next' }]);
  }
  return rows;
}

function cityKeyboard(prefix: 'city' | 'jobcity'): InlineKeyboard {
  return [
    CITY_OPTIONS.map((city) => ({
      text: city.label,
      callback_data: `${prefix}:${city.key}`,
    })),
  ];
}

function photosKeyboard(count: number, min: number, doneData: string): InlineKeyboard {
  const rows: InlineKeyboard = [];
  if (count >= min) {
    rows.push([{ text: 'Готово', callback_data: doneData }]);
  }
  if (min === 0) {
    rows.push([{ text: 'Пропустить фото', callback_data: doneData }]);
  }
  rows.push([{ text: 'В меню', callback_data: 'flow:menu' }]);
  return rows;
}

function confirmKeyboard(publishData: string): InlineKeyboard {
  return [
    [{ text: '📢 Опубликовать', callback_data: publishData }],
    [{ text: 'В меню', callback_data: 'flow:menu' }],
  ];
}

function reviewKindKeyboard(): InlineKeyboard {
  return [
    [{ text: '⭐ Отзыв о работе', callback_data: 'revkind:review' }],
    [{ text: '💡 Идея / улучшение сайта', callback_data: 'revkind:site' }],
    [{ text: 'В меню', callback_data: 'flow:menu' }],
  ];
}

function budgetKeyboard(): InlineKeyboard {
  return [
    [{ text: 'Пропустить бюджет', callback_data: 'jobbudget:skip' }],
    [{ text: 'В меню', callback_data: 'flow:menu' }],
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

function setSession(chatId: number, session: BotSession): BotSession {
  sessions.set(chatId, session);
  return session;
}

async function showMenu(token: string, chatId: number, username?: string | null): Promise<void> {
  setSession(chatId, createEmptySession(username));
  await sendMessage(
    token,
    chatId,
    [
      'Привет! Я бот MasterDirect.',
      'Регистрация на сайте не нужна.',
      '',
      'Выберите действие:',
    ].join('\n'),
    menuKeyboard(),
  );
}

async function handleStart(
  token: string,
  chatId: number,
  username?: string | null,
): Promise<void> {
  await showMenu(token, chatId, username);
}

async function handleMasterText(
  token: string,
  chatId: number,
  session: BotSession,
  trimmed: string,
): Promise<void> {
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
        specialtyKeyboard(session, true),
      );
      return;
    }
    case 'district': {
      if (trimmed.length < 2) {
        await sendMessage(token, chatId, 'Напишите район работы, например: Старый Батуми');
        return;
      }
      session.district = trimmed;
      session.step = 'photos';
      session.photos = [];
      await sendMessage(
        token,
        chatId,
        `Пришлите от ${MIN_PHOTOS} до ${MAX_PHOTOS} фото работ.\nКогда закончите — нажмите «Готово».`,
        photosKeyboard(0, MIN_PHOTOS, 'photos:done'),
      );
      return;
    }
    case 'photos': {
      await sendMessage(
        token,
        chatId,
        `Сейчас жду фото. Уже ${session.photos.length} из ${MAX_PHOTOS}.`,
        photosKeyboard(session.photos.length, MIN_PHOTOS, 'photos:done'),
      );
      return;
    }
    case 'confirm': {
      await sendMessage(
        token,
        chatId,
        formatSessionPreview(session),
        confirmKeyboard('flow:publish'),
      );
      return;
    }
    default:
      await sendMessage(token, chatId, 'Используйте кнопки или /start');
  }
}

async function handleJobText(
  token: string,
  chatId: number,
  session: BotSession,
  trimmed: string,
): Promise<void> {
  switch (session.step) {
    case 'job_name': {
      if (trimmed.length < 2) {
        await sendMessage(token, chatId, 'Напишите, как к вам обращаться');
        return;
      }
      session.name = trimmed;
      session.step = 'job_phone';
      await sendMessage(token, chatId, 'Ваш телефон, например: +995 5XX XXX XXX');
      return;
    }
    case 'job_phone': {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 8) {
        await sendMessage(token, chatId, 'Нужен номер телефона, минимум 8 цифр.');
        return;
      }
      session.phone = trimmed;
      session.step = 'job_city';
      await sendMessage(token, chatId, 'Выберите город:', cityKeyboard('jobcity'));
      return;
    }
    case 'job_description': {
      if (trimmed.length < 10) {
        await sendMessage(token, chatId, 'Опишите подробнее, что нужно сделать (минимум 10 символов).');
        return;
      }
      session.description = trimmed;
      session.step = 'job_budget';
      await sendMessage(
        token,
        chatId,
        'Бюджет в лари? Напишите число (например 800) или нажмите «Пропустить».',
        budgetKeyboard(),
      );
      return;
    }
    case 'job_budget': {
      const digits = trimmed.replace(/[^\d.]/g, '');
      const value = Number(digits);
      if (!Number.isFinite(value) || value <= 0) {
        await sendMessage(
          token,
          chatId,
          'Напишите сумму числом или нажмите «Пропустить».',
          budgetKeyboard(),
        );
        return;
      }
      session.budget = Math.round(value);
      session.step = 'job_photos';
      session.photos = [];
      await sendMessage(
        token,
        chatId,
        `Можно прислать до ${MAX_JOB_PHOTOS} фото объекта (необязательно).`,
        photosKeyboard(0, MIN_JOB_PHOTOS, 'jobphotos:done'),
      );
      return;
    }
    case 'job_photos': {
      await sendMessage(
        token,
        chatId,
        `Фото: ${session.photos.length}/${MAX_JOB_PHOTOS}. Пришлите ещё или нажмите «Готово».`,
        photosKeyboard(session.photos.length, MIN_JOB_PHOTOS, 'jobphotos:done'),
      );
      return;
    }
    case 'job_confirm': {
      await sendMessage(
        token,
        chatId,
        formatJobPreview(session),
        confirmKeyboard('flow:publish_job'),
      );
      return;
    }
    default:
      await sendMessage(token, chatId, 'Используйте кнопки или /start');
  }
}

async function handleReviewText(
  token: string,
  chatId: number,
  session: BotSession,
  trimmed: string,
): Promise<void> {
  switch (session.step) {
    case 'review_name': {
      if (trimmed.length < 2) {
        await sendMessage(token, chatId, 'Напишите ваше имя');
        return;
      }
      session.name = trimmed;
      session.step = 'review_kind';
      await sendMessage(token, chatId, 'Что хотите оставить?', reviewKindKeyboard());
      return;
    }
    case 'review_text': {
      if (trimmed.length < MIN_REVIEW_CHARS) {
        await sendMessage(
          token,
          chatId,
          `Напишите чуть подробнее (минимум ${MIN_REVIEW_CHARS} символов).`,
        );
        return;
      }
      session.reviewText = trimmed;
      session.step = 'review_confirm';
      await sendMessage(
        token,
        chatId,
        formatReviewPreview(session),
        confirmKeyboard('flow:publish_review'),
      );
      return;
    }
    case 'review_confirm': {
      await sendMessage(
        token,
        chatId,
        formatReviewPreview(session),
        confirmKeyboard('flow:publish_review'),
      );
      return;
    }
    default:
      await sendMessage(token, chatId, 'Используйте кнопки или /start');
  }
}

async function handleText(
  token: string,
  chatId: number,
  text: string,
  username?: string | null,
): Promise<void> {
  const trimmed = text.trim();
  if (trimmed === '/start' || trimmed === '/new' || trimmed === '/menu') {
    await handleStart(token, chatId, username);
    return;
  }
  if (trimmed === '/master') {
    setSession(chatId, startMasterSession(username));
    await sendMessage(token, chatId, 'Как вас зовут? (имя и фамилия)');
    return;
  }
  if (trimmed === '/job') {
    setSession(chatId, startJobSession(username));
    await sendMessage(token, chatId, 'Размещаем заказ.\nКак к вам обращаться?');
    return;
  }
  if (trimmed === '/review') {
    setSession(chatId, startReviewSession(username));
    await sendMessage(token, chatId, 'Оставляем отзыв.\nКак вас зовут?');
    return;
  }
  if (trimmed === '/cancel') {
    sessions.delete(chatId);
    await sendMessage(token, chatId, 'Ок, отменил. Напишите /start');
    return;
  }

  const session = getSession(chatId, username);
  if (session.flow === 'menu' || session.step === 'menu') {
    await showMenu(token, chatId, username);
    return;
  }
  if (session.flow === 'master') {
    await handleMasterText(token, chatId, session, trimmed);
    return;
  }
  if (session.flow === 'job') {
    await handleJobText(token, chatId, session, trimmed);
    return;
  }
  if (session.flow === 'review') {
    await handleReviewText(token, chatId, session, trimmed);
  }
}

async function handlePhoto(
  token: string,
  chatId: number,
  photos: TelegramPhotoSize[],
  username?: string | null,
): Promise<void> {
  const session = getSession(chatId, username);
  const isMasterPhotos = session.flow === 'master' && session.step === 'photos';
  const isJobPhotos = session.flow === 'job' && session.step === 'job_photos';

  if (!isMasterPhotos && !isJobPhotos) {
    await sendMessage(token, chatId, 'Сейчас фото не нужны. Напишите /start');
    return;
  }

  const max = isJobPhotos ? MAX_JOB_PHOTOS : MAX_PHOTOS;
  const min = isJobPhotos ? MIN_JOB_PHOTOS : MIN_PHOTOS;
  const doneData = isJobPhotos ? 'jobphotos:done' : 'photos:done';

  if (session.photos.length >= max) {
    await sendMessage(
      token,
      chatId,
      `Уже ${max} фото. Нажмите «Готово».`,
      photosKeyboard(session.photos.length, min, doneData),
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

  if (isMasterPhotos && session.photos.length >= MAX_PHOTOS) {
    session.step = 'confirm';
    await sendMessage(
      token,
      chatId,
      `Принял ${session.photos.length} фото.\n\n${formatSessionPreview(session)}`,
      confirmKeyboard('flow:publish'),
    );
    return;
  }

  if (isJobPhotos && session.photos.length >= MAX_JOB_PHOTOS) {
    session.step = 'job_confirm';
    await sendMessage(
      token,
      chatId,
      `Принял ${session.photos.length} фото.\n\n${formatJobPreview(session)}`,
      confirmKeyboard('flow:publish_job'),
    );
    return;
  }

  await sendMessage(
    token,
    chatId,
    `Фото ${session.photos.length}/${max} принято.`,
    photosKeyboard(session.photos.length, min, doneData),
  );
}

async function handleCallback(
  token: string,
  supabase: SupabaseClient,
  siteOrigin: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  query: TelegramCallbackQuery,
): Promise<void> {
  const chatId = query.message?.chat.id;
  if (!chatId || !query.data) {
    return;
  }

  const username = query.from.username ?? null;
  const session = getSession(chatId, username);
  const data = query.data;

  if (data === 'flow:menu' || data === 'flow:restart') {
    await answerCallback(token, query.id);
    await showMenu(token, chatId, username);
    return;
  }

  if (data === 'menu:master') {
    await answerCallback(token, query.id);
    setSession(chatId, startMasterSession(username));
    await sendMessage(
      token,
      chatId,
      'Соберу карточку для каталога.\nКак вас зовут? (имя и фамилия)',
    );
    return;
  }

  if (data === 'menu:job') {
    await answerCallback(token, query.id);
    setSession(chatId, startJobSession(username));
    await sendMessage(token, chatId, 'Размещаем заказ на сайте.\nКак к вам обращаться?');
    return;
  }

  if (data === 'menu:review') {
    await answerCallback(token, query.id);
    setSession(chatId, startReviewSession(username));
    await sendMessage(token, chatId, 'Отзыв сначала проверит админ, потом появится на сайте.\nКак вас зовут?');
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
      await sendMessage(token, chatId, 'Выберите город:', cityKeyboard('city'));
      return;
    }
    if (!SPECIALTY_OPTIONS.some((item) => item.key === key)) {
      await answerCallback(token, query.id, 'Неизвестная специальность');
      return;
    }
    if (session.specialties.includes(key)) {
      session.specialties = session.specialties.filter((item) => item !== key);
    } else {
      session.specialties.push(key);
    }
    await answerCallback(token, query.id);
    await sendMessage(
      token,
      chatId,
      `Выбрано: ${specialtyLabels(session.specialties) || 'ничего'}\nМожно выбрать ещё или «Далее».`,
      specialtyKeyboard(session, true),
    );
    return;
  }

  if (data.startsWith('jobcat:')) {
    const key = data.slice(7);
    if (!SPECIALTY_OPTIONS.some((item) => item.key === key)) {
      await answerCallback(token, query.id, 'Неизвестная категория');
      return;
    }
    session.category = key;
    session.step = 'job_description';
    await answerCallback(token, query.id, specialtyLabel(key));
    await sendMessage(
      token,
      chatId,
      `Категория: ${specialtyLabel(key)}\n\nОпишите, что нужно сделать (объём, сроки, детали):`,
    );
    return;
  }

  if (data.startsWith('city:')) {
    const key = data.slice(5) as CityId;
    if (!CITY_OPTIONS.some((item) => item.key === key)) {
      await answerCallback(token, query.id, 'Неизвестный город');
      return;
    }
    session.city = key;
    session.step = 'district';
    await answerCallback(token, query.id);
    await sendMessage(token, chatId, 'Напишите район работы:');
    return;
  }

  if (data.startsWith('jobcity:')) {
    const key = data.slice(8) as CityId;
    if (!CITY_OPTIONS.some((item) => item.key === key)) {
      await answerCallback(token, query.id, 'Неизвестный город');
      return;
    }
    session.city = key;
    session.step = 'job_category';
    await answerCallback(token, query.id);
    await sendMessage(token, chatId, 'Какой вид работ нужен?', specialtyKeyboard(session, false));
    return;
  }

  if (data === 'jobbudget:skip') {
    session.budget = null;
    session.step = 'job_photos';
    session.photos = [];
    await answerCallback(token, query.id);
    await sendMessage(
      token,
      chatId,
      `Можно прислать до ${MAX_JOB_PHOTOS} фото объекта (необязательно).`,
      photosKeyboard(0, MIN_JOB_PHOTOS, 'jobphotos:done'),
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
    await sendMessage(
      token,
      chatId,
      formatSessionPreview(session),
      confirmKeyboard('flow:publish'),
    );
    return;
  }

  if (data === 'jobphotos:done') {
    session.step = 'job_confirm';
    await answerCallback(token, query.id);
    await sendMessage(
      token,
      chatId,
      formatJobPreview(session),
      confirmKeyboard('flow:publish_job'),
    );
    return;
  }

  if (data.startsWith('revkind:')) {
    const kind = data.slice(8) as ReviewKind;
    if (kind !== 'review' && kind !== 'site') {
      await answerCallback(token, query.id, 'Неизвестный тип');
      return;
    }
    session.reviewKind = kind;
    session.step = 'review_text';
    await answerCallback(token, query.id);
    await sendMessage(
      token,
      chatId,
      kind === 'site'
        ? 'Напишите идею или что улучшить на сайте:'
        : 'Напишите текст отзыва (минимум 20 символов):',
    );
    return;
  }

  if (data === 'flow:publish') {
    await answerCallback(token, query.id, 'Публикую…');
    await sendMessage(token, chatId, 'Публикую карточку в каталог, подождите…');
    const result = await publishCatalogCard({
      supabase,
      supabaseUrl,
      serviceRoleKey,
      botToken: token,
      session,
      siteOrigin,
    });

    if (!result.ok) {
      await sendMessage(
        token,
        chatId,
        `Не получилось опубликовать: ${result.error ?? 'ошибка'}\nПопробуйте /start ещё раз.`,
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
        result.warning ? `\n⚠️ ${result.warning}` : '',
        '',
        'Меню: /start',
      ]
        .filter(Boolean)
        .join('\n'),
      menuKeyboard(),
    );
    return;
  }

  if (data === 'flow:publish_job') {
    await answerCallback(token, query.id, 'Публикую…');
    await sendMessage(token, chatId, 'Публикую заказ, подождите…');
    const result = await publishJobOrder({
      supabase,
      supabaseUrl,
      serviceRoleKey,
      botToken: token,
      session,
      siteOrigin,
    });

    if (!result.ok) {
      await sendMessage(
        token,
        chatId,
        `Не получилось опубликовать заказ: ${result.error ?? 'ошибка'}\nПопробуйте /start.`,
      );
      return;
    }

    sessions.delete(chatId);
    await sendMessage(
      token,
      chatId,
      [
        'Готово! Заказ уже на сайте.',
        result.jobsUrl ? `Смотреть заказы: ${result.jobsUrl}` : '',
        result.warning ? `\n⚠️ ${result.warning}` : '',
        '',
        'Меню: /start',
      ]
        .filter(Boolean)
        .join('\n'),
      menuKeyboard(),
    );
    return;
  }

  if (data === 'flow:publish_review') {
    await answerCallback(token, query.id, 'Отправляю…');
    const result = await publishSiteReview({ supabase, session });
    if (!result.ok) {
      await sendMessage(
        token,
        chatId,
        `Не получилось отправить отзыв: ${result.error ?? 'ошибка'}\nПопробуйте /start.`,
      );
      return;
    }

    sessions.delete(chatId);
    await sendMessage(
      token,
      chatId,
      [
        'Спасибо! Отзыв отправлен на модерацию.',
        'После проверки администратором он появится на сайте.',
        '',
        'Меню: /start',
      ].join('\n'),
      menuKeyboard(),
    );
  }
}

async function processUpdate(
  token: string,
  supabase: SupabaseClient,
  siteOrigin: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  update: TelegramUpdate,
): Promise<void> {
  if (update.callback_query) {
    await handleCallback(
      token,
      supabase,
      siteOrigin,
      supabaseUrl,
      serviceRoleKey,
      update.callback_query,
    );
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
  supabaseUrl: string;
  serviceRoleKey: string;
}): void {
  const { token, supabase, siteOrigin, supabaseUrl, serviceRoleKey } = options;
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
            await processUpdate(
              token,
              supabase,
              siteOrigin,
              supabaseUrl,
              serviceRoleKey,
              update,
            );
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
