import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MIN_REVIEW_CHARS,
  SITE_FEEDBACK_TEXT_PREFIX,
  type BotSession,
  type ReviewKind,
} from './catalog-bot-types';

export interface PublishReviewResult {
  ok: boolean;
  error?: string;
}

export function formatReviewPreview(session: BotSession): string {
  const kindLabel =
    session.reviewKind === 'site' ? 'Идея / улучшение сайта' : 'Отзыв о работе';
  return [
    'Проверьте отзыв перед отправкой:',
    '',
    `Имя: ${session.name ?? '—'}`,
    `Тип: ${kindLabel}`,
    `Текст: ${session.reviewText ?? '—'}`,
    '',
    'После отправки отзыв проверит администратор.',
  ].join('\n');
}

export function reviewKindLabel(kind: ReviewKind): string {
  return kind === 'site' ? 'Идея / улучшение сайта' : 'Отзыв о работе';
}

export async function publishSiteReview(options: {
  supabase: SupabaseClient;
  session: BotSession;
}): Promise<PublishReviewResult> {
  const { supabase, session } = options;
  const name = session.name?.trim();
  const text = session.reviewText?.trim();
  const kind = session.reviewKind ?? 'review';

  if (!name || name.length < 2) {
    return { ok: false, error: 'Укажите имя' };
  }
  if (!text || text.length < MIN_REVIEW_CHARS) {
    return { ok: false, error: `Текст отзыва слишком короткий (минимум ${MIN_REVIEW_CHARS} символов)` };
  }

  const reviewText =
    kind === 'site' ? `${SITE_FEEDBACK_TEXT_PREFIX}\n${text}` : text;

  try {
    const { error } = await supabase.from('site_reviews').insert({
      user_name: name,
      review_text: reviewText,
      status: 'pending',
      is_approved: false,
    });

    if (error) {
      // Some projects may not have status column — retry minimal payload.
      if (error.message.toLowerCase().includes('status')) {
        const retry = await supabase.from('site_reviews').insert({
          user_name: name,
          review_text: reviewText,
          is_approved: false,
        });
        if (retry.error) {
          return { ok: false, error: retry.error.message };
        }
        return { ok: true };
      }
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    console.error('[catalog-bot] publishSiteReview failed:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Не удалось отправить отзыв',
    };
  }
}
