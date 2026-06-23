import { PerformerProfile } from '../models/portfolio.models';
import { Profile } from '../models/profile.models';

/**
 * Проверяет, полностью ли занят мастер/бригада активными заказами.
 * @param performer Профиль исполнителя с данными о заказах.
 * @returns true если текущие активные заказы >= макс. количество.
 */
export function isPerformerBusy(performer: PerformerProfile | Profile | null): boolean {
  if (!performer) {
    return false;
  }

  const currentOrders = 'currentActiveOrders' in performer
    ? performer.currentActiveOrders
    : (performer as Profile).current_active_orders;
  const maxOrders = 'maxActiveOrders' in performer
    ? performer.maxActiveOrders
    : (performer as Profile).max_active_orders;

  if (currentOrders == null || maxOrders == null) {
    return false;
  }

  return currentOrders >= maxOrders;
}

/**
 * Получает строку состояния занятости для отображения.
 * @param performer Профиль исполнителя.
 * @returns Строка типа "3/5 заказов" или пусто если данные отсутствуют.
 */
export function getPerformerBusyStatus(performer: PerformerProfile | Profile | null): string {
  if (!performer) {
    return '';
  }

  const currentOrders = 'currentActiveOrders' in performer
    ? performer.currentActiveOrders
    : (performer as Profile).current_active_orders;
  const maxOrders = 'maxActiveOrders' in performer
    ? performer.maxActiveOrders
    : (performer as Profile).max_active_orders;

  if (currentOrders == null || maxOrders == null) {
    return '';
  }

  return `${currentOrders}/${maxOrders} заказов`;
}

/**
 * CSS-класс для отображения индикатора занятости.
 * @param performer Профиль исполнителя.
 * @returns Класс типа 'busy', 'available', или пусто.
 */
export function getPerformerBusyClass(performer: PerformerProfile | Profile | null): string {
  if (!performer) {
    return '';
  }

  if (isPerformerBusy(performer)) {
    return 'performer-busy';
  }

  const currentOrders = 'currentActiveOrders' in performer
    ? performer.currentActiveOrders
    : (performer as Profile).current_active_orders;

  return currentOrders != null && currentOrders > 0 ? 'performer-partially-busy' : 'performer-available';
}
