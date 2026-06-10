/** Бесплатный выезд — ключевые слова для определения платного замера. */
const FREE_CALL_OUT_PATTERN =
  /^(бесплатно|free|0\s*(gel|₾|лари)?|₾\s*0|—|-)$/i;

export function normalizeCallOutFee(value: string): string {
  return value.trim();
}

export function isPaidCallOutFee(fee: string | null | undefined): boolean {
  if (!fee) {
    return false;
  }

  const normalized = normalizeCallOutFee(fee);
  if (!normalized) {
    return false;
  }

  return !FREE_CALL_OUT_PATTERN.test(normalized);
}

export function formatCallOutFeeLabel(fee: string | null | undefined, fallback: string): string {
  if (!fee?.trim()) {
    return fallback;
  }

  return fee.trim();
}
