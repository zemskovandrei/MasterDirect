#!/usr/bin/env node
/**
 * Удаляет все регистрации (auth.users + specialist + отзывы) по email.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/purge-registrations-by-email.mjs admin@smartbuild.tech
 *
 * Или положите ключи в .env в корне проекта.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadDotEnv() {
  const envPath = resolve(root, '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const email = (process.argv[2] ?? process.env.PURGE_EMAIL ?? 'admin@smartbuild.tech')
  .trim()
  .toLowerCase();

const url =
  process.env.SUPABASE_URL?.trim() ||
  'https://zrlggaimupenmgnrevts.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!email || !email.includes('@')) {
  console.error('Укажите email: node scripts/purge-registrations-by-email.mjs user@example.com');
  process.exit(1);
}

if (!serviceRoleKey || serviceRoleKey.includes('твой_')) {
  console.error(
    'Нужен SUPABASE_SERVICE_ROLE_KEY в .env (Supabase → Project Settings → API → service_role).',
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listUsersByEmail(targetEmail) {
  const matches = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    for (const user of data.users) {
      if (user.email?.trim().toLowerCase() === targetEmail) {
        matches.push(user);
      }
    }

    if (data.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return matches;
}

async function purgeUser(user) {
  const userId = user.id;
  console.log(`→ ${user.email} (${userId})`);

  const { error: reviewsError } = await supabase
    .from('site_reviews')
    .delete()
    .eq('master_id', userId);
  if (reviewsError) {
    throw new Error(`site_reviews: ${reviewsError.message}`);
  }

  const { error: specialistError } = await supabase
    .from('specialist')
    .delete()
    .eq('id', userId);
  if (specialistError) {
    throw new Error(`specialist: ${specialistError.message}`);
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    throw new Error(`auth.users: ${authError.message}`);
  }
}

async function main() {
  console.log(`Ищем регистрации для ${email}…`);
  const users = await listUsersByEmail(email);

  if (!users.length) {
    console.log('В Supabase Auth пользователей с этим email не найдено.');
    return;
  }

  console.log(`Найдено аккаунтов: ${users.length}`);
  for (const user of users) {
    await purgeUser(user);
  }

  console.log('Готово: профили, отзывы и учётные записи удалены.');
}

main().catch((err) => {
  console.error('Ошибка:', err instanceof Error ? err.message : err);
  process.exit(1);
});
