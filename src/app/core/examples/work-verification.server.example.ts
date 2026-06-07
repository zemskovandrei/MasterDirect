/**
 * Production backend example (Node.js + Express + PostgreSQL).
 * Not wired into the Angular demo — copy into your API when the DB is ready.
 *
 * Table `portfolio_works` (relevant columns):
 *   verification_status   VARCHAR(20)  NOT NULL DEFAULT 'not_requested'
 *   client_contact        VARCHAR(255) NULL
 *   verification_token    VARCHAR(64)  NULL UNIQUE
 *   verification_code     CHAR(4)      NULL
 *   verified_at           TIMESTAMPTZ  NULL
 *   rejected_at           TIMESTAMPTZ  NULL
 *   token_expires_at      TIMESTAMPTZ  NULL
 *   token_used_at         TIMESTAMPTZ  NULL
 */

import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

export type WorkVerificationStatus = 'not_requested' | 'pending' | 'verified' | 'rejected';

export interface CreateWorkPayload {
  performerId: string;
  title: string;
  description: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  clientContact?: string;
}

function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

function generateVerificationCode(): string {
  return String(1000 + (randomBytes(2).readUInt16BE(0) % 9000));
}

function hashTokenForStorage(token: string, pepper: string): string {
  return createHash('sha256').update(`${pepper}:${token}`).digest('hex');
}

/**
 * Called when a performer uploads a work from the cabinet.
 */
export async function createPortfolioWork(
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  payload: CreateWorkPayload,
  appOrigin: string,
  tokenPepper: string,
) {
  const clientContact = payload.clientContact?.trim() || null;
  const wantsVerification = !!clientContact;

  const rawToken = wantsVerification ? generateSecureToken() : null;
  const verificationCode = wantsVerification ? generateVerificationCode() : null;
  const tokenHash = rawToken ? hashTokenForStorage(rawToken, tokenPepper) : null;
  const expiresAt = wantsVerification ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null;

  const { rows } = await db.query(
    `INSERT INTO portfolio_works (
       performer_id, title, description, before_image_url, after_image_url,
       verification_status, client_contact, verification_token, verification_code,
       token_expires_at, created_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     RETURNING id, verification_status`,
    [
      payload.performerId,
      payload.title,
      payload.description,
      payload.beforeImageUrl,
      payload.afterImageUrl,
      wantsVerification ? 'pending' : 'not_requested',
      clientContact,
      tokenHash,
      verificationCode,
      expiresAt,
    ],
  );

  const work = rows[0];

  return {
    work,
    verificationLink: rawToken ? `${appOrigin}/verify/${rawToken}` : null,
    verificationCode,
  };
}

/**
 * Public endpoint: GET /api/verify/:token — load confirmation context.
 * POST /api/verify/:token — { action: 'confirm' | 'reject' }
 */
export async function handleClientVerification(
  req: Request,
  res: Response,
  db: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
  tokenPepper: string,
) {
  const rawToken = String(req.params['token'] ?? '');
  if (!rawToken || rawToken.length < 32) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const tokenHash = hashTokenForStorage(rawToken, tokenPepper);

  const { rows } = await db.query(
    `SELECT w.*, p.name AS performer_name
     FROM portfolio_works w
     JOIN performers p ON p.id = w.performer_id
     WHERE w.verification_token = $1
       AND w.verification_status = 'pending'
       AND (w.token_expires_at IS NULL OR w.token_expires_at > NOW())
       AND w.token_used_at IS NULL
     LIMIT 1`,
    [tokenHash],
  );

  const work = rows[0];
  if (!work) {
    return res.status(404).json({ error: 'Link expired or already used' });
  }

  if (req.method === 'GET') {
    return res.json({
      performerName: work['performer_name'],
      workTitle: work['title'],
      workDescription: work['description'],
    });
  }

  const action = (req.body as { action?: string })?.action;
  if (action !== 'confirm' && action !== 'reject') {
    return res.status(400).json({ error: 'action must be confirm or reject' });
  }

  const nextStatus: WorkVerificationStatus = action === 'confirm' ? 'verified' : 'rejected';

  await db.query(
    `UPDATE portfolio_works
     SET verification_status = $1,
         verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE verified_at END,
         rejected_at = CASE WHEN $1 = 'rejected' THEN NOW() ELSE rejected_at END,
         token_used_at = NOW(),
         verification_token = NULL,
         verification_code = NULL
     WHERE id = $2`,
    [nextStatus, work['id']],
  );

  return res.json({ status: nextStatus });
}
