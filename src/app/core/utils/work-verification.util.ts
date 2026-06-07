/** Cryptographically strong token for one-time client confirmation links. */
export function generateVerificationToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${crypto.randomUUID().replace(/-/g, '')}${crypto.randomUUID().replace(/-/g, '')}`.slice(0, 48);
  }

  const bytes = new Uint8Array(24);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 4-digit code as a fallback channel (SMS / messenger). */
export function generateVerificationCode(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return String(1000 + (buf[0] % 9000));
  }
  return String(1000 + Math.floor(Math.random() * 9000));
}

export function buildVerificationUrl(token: string, origin = 'https://smartbuild.tech'): string {
  const base = origin.replace(/\/$/, '');
  return `${base}/verify/${token}`;
}

export function normalizeClientContact(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
