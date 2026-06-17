export type PasswordStrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  level: PasswordStrengthLevel;
  score: number;
  percent: number;
}

export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { level: 'empty', score: 0, percent: 0 };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const level: PasswordStrengthLevel =
    score <= 1 ? 'weak' : score === 2 ? 'fair' : score === 3 ? 'good' : 'strong';

  return {
    level,
    score,
    percent: Math.min(100, Math.round((score / 5) * 100)),
  };
}
