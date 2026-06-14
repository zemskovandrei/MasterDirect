/** Контакты исполнителя для прямых ссылок WhatsApp / Telegram. */
export interface ExecutorMessengerTarget {
  name?: string;
  whatsapp_phone?: string | null;
  tg_username?: string | null;
}

export function buildWhatsAppUrl(phone: string, orderDetails: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(orderDetails)}`;
}

export function buildTelegramUrl(username: string, orderDetails: string): string | null {
  const normalized = username.replace(/^@/, '').trim();
  if (!normalized) {
    return null;
  }

  return `https://t.me/${normalized}?text=${encodeURIComponent(orderDetails)}`;
}

/**
 * Открывает личный чат исполнителя с уже сформированным текстом заказа.
 * @returns true, если вкладка открыта; false, если контакт не задан.
 */
export function redirectToExecutor(
  messenger: 'whatsapp' | 'telegram',
  executor: ExecutorMessengerTarget,
  orderDetails: string,
): boolean {
  const url =
    messenger === 'whatsapp'
      ? buildWhatsAppUrl(executor.whatsapp_phone ?? '', orderDetails)
      : buildTelegramUrl(executor.tg_username ?? '', orderDetails);

  if (!url) {
    return false;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
