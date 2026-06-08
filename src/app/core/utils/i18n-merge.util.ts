export function mergeTranslations(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(extra)) {
    const baseVal = result[key];
    const extraVal = extra[key];
    if (
      baseVal &&
      extraVal &&
      typeof baseVal === 'object' &&
      typeof extraVal === 'object' &&
      !Array.isArray(baseVal) &&
      !Array.isArray(extraVal)
    ) {
      result[key] = mergeTranslations(
        baseVal as Record<string, unknown>,
        extraVal as Record<string, unknown>,
      );
    } else {
      result[key] = extraVal;
    }
  }
  return result;
}
