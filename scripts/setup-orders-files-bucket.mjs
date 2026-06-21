#!/usr/bin/env node
/**
 * Создаёт bucket orders-files для вложений к заявкам.
 *
 *   node scripts/setup-orders-files-bucket.mjs
 *
 * Нужен SUPABASE_SERVICE_ROLE_KEY в .env.
 * После createBucket выполните SQL из supabase/migrations/20260621_storage_orders_files.sql
 * (политики anon upload) — в Dashboard → SQL Editor.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const BUCKET_ID = 'orders-files';

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

const url =
  process.env.SUPABASE_URL?.trim() || 'https://xixafoznxsupsxotdjqx.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!serviceRoleKey || serviceRoleKey.includes('твой_')) {
  console.error(
    'Нужен SUPABASE_SERVICE_ROLE_KEY в .env (Supabase → Project Settings → API → service_role).',
  );
  console.error('Или создайте bucket вручную: Dashboard → Storage → New bucket → orders-files (Public).');
  console.error('Затем SQL Editor → supabase/migrations/20260621_fix_rls_policies.sql');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw listError;
  }

  const exists = buckets?.some((bucket) => bucket.id === BUCKET_ID || bucket.name === BUCKET_ID);
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_ID, {
      public: true,
      fileSizeLimit: 15728640,
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'application/pdf',
      ],
    });
    if (error) {
      throw error;
    }
    console.log(`Bucket «${BUCKET_ID}» создан.`);
  } else {
    console.log(`Bucket «${BUCKET_ID}» уже есть.`);
  }

  console.log('');
  console.log('Шаг 2: Supabase Dashboard → SQL Editor → выполните файл:');
  console.log(resolve(root, 'supabase/migrations/20260621_fix_rls_policies.sql'));
  console.log('');
  console.log('(политики для загрузки файлов с сайта без входа)');
}

main().catch((error) => {
  console.error('Ошибка:', error?.message ?? error);
  process.exit(1);
});
