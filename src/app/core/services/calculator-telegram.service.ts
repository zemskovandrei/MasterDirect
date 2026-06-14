import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CalculatorTelegramPayload } from '../models/calculator.models';

interface TelegramSendMessageResponse {
  ok: boolean;
  description?: string;
}

export type TelegramSendError =
  | 'not_configured'
  | 'network'
  | 'blocked'
  | 'telegram_api';

export interface TelegramSendResult {
  ok: boolean;
  error?: TelegramSendError;
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class CalculatorTelegramService {
  private readonly http = inject(HttpClient);

  sendLead(payload: CalculatorTelegramPayload): Observable<TelegramSendResult> {
    if (!this.isConfigured()) {
      console.warn('[CalculatorTelegramService] Telegram is not configured in environment');
      return of({ ok: false, error: 'not_configured' });
    }

    const { botToken, chatId } = environment.telegram;
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const text = this.buildMessageText(payload);

    return this.http
      .post<TelegramSendMessageResponse>(url, {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      })
      .pipe(
        map((response) =>
          response.ok ? { ok: true } : { ok: false, error: 'telegram_api' as const },
        ),
        catchError((err: unknown) => of(this.mapSendError(err))),
      );
  }

  isConfigured(): boolean {
    const { botToken, chatId } = environment.telegram;
    return (
      botToken.trim().length > 10 &&
      !botToken.includes('YOUR_TELEGRAM') &&
      chatId.trim().length > 0 &&
      !chatId.includes('YOUR_TELEGRAM')
    );
  }

  private buildMessageText(payload: CalculatorTelegramPayload): string {
    const directedTo = this.escapeMarkdown(payload.directedTo?.trim() || '—');
    const name = this.escapeMarkdown(payload.name.trim());
    const contact = this.escapeMarkdown(payload.contact.trim());
    const roomType = this.escapeMarkdown(
      payload.roomTypeLabel?.trim() || payload.roomType || '—',
    );
    const renovationType = this.escapeMarkdown(
      payload.renovationTypeLabel?.trim() || payload.renovationType || '—',
    );
    const areaSqm = payload.areaSqm ?? '—';
    const photoLink = this.escapeMarkdown(payload.photoLink?.trim() || '—');
    const callOutFees = this.escapeMarkdown(payload.selectedCallOutFees?.trim() || '—');
    const paidCallOut = payload.paidCallOutAccepted ? 'да' : 'нет';

    return [
      `🎯 *НАПРАВЛЕНО МАСТЕРУ:* ${directedTo}`,
      `👤 *Заказчик:* ${name}`,
      `📞 *Контакт:* ${contact}`,
      `🏠 *Помещение:* ${roomType}`,
      `🔧 *Ремонт:* ${renovationType}`,
      `📐 *Площадь:* ${areaSqm} кв\\.м`,
      `📷 *Фото объекта:* ${photoLink}`,
      `💰 *Выезд на замер:* ${callOutFees}`,
      `✅ *Согласие на платный выезд:* ${paidCallOut}`,
    ].join('\n');
  }

  private escapeMarkdown(value: string): string {
    return value.replace(/([_*`\[\]])/g, '\\$1');
  }

  private mapSendError(err: unknown): TelegramSendResult {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 0) {
        console.warn('[CalculatorTelegramService] Telegram API unreachable (network/CORS/VPN)');
        return {
          ok: false,
          error: 'blocked',
          details: err.message || 'Network error',
        };
      }

      const description =
        typeof err.error === 'object' &&
        err.error &&
        'description' in err.error &&
        typeof (err.error as { description?: unknown }).description === 'string'
          ? (err.error as { description: string }).description
          : err.message;

      console.warn('[CalculatorTelegramService] Telegram API error:', description);
      return {
        ok: false,
        error: 'telegram_api',
        details: description,
      };
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[CalculatorTelegramService] Telegram send failed:', message);
    return {
      ok: false,
      error: 'network',
      details: message,
    };
  }
}
