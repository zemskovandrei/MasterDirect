import 'dotenv/config';

import cors from 'cors';
import express, { NextFunction, Request, Response, RequestHandler } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const ADMIN_EMAILS = parseCsv(process.env.ADMIN_EMAILS).map((item) => item.toLowerCase());
const ALLOWED_ORIGINS = parseCsv(process.env.ALLOWED_ORIGINS);
const API_RATE_LIMIT_WINDOW_MS = Number(process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
const API_RATE_LIMIT_MAX = Number(process.env.API_RATE_LIMIT_MAX ?? 120);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[FlooringLeader API] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.length === 0) {
      callback(null, true);
      return;
    }
    callback(null, ALLOWED_ORIGINS.includes(origin));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(setSecurityHeaders());
app.use('/api', createInMemoryRateLimiter(API_RATE_LIMIT_WINDOW_MS, API_RATE_LIMIT_MAX));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

interface JobklientBody {
  name?: string;
  client_name?: string;
  phone?: string;
  description?: string;
  title?: string;
  city?: string;
  category?: string;
  budget?: number | string | null;
  status?: string;
}

interface FurnitureOrderBody {
  client_name?: string;
  client_phone?: string;
  furniture_type?: string;
  work_type?: string;
  city?: string;
  description?: string;
  name?: string;
  phone?: string;
}

interface SiteReviewBody {
  name?: string;
  user_name?: string;
  review_text?: string;
  text?: string;
}

function hasVisibleName(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function parseCsv(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePathParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }
  return value?.trim() ?? '';
}

function setSecurityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  };
}

function createInMemoryRateLimiter(windowMs: number, maxRequests: number): RequestHandler {
  const store = new Map<string, { count: number; resetAt: number }>();
  const safeWindowMs = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60_000;
  const safeMaxRequests = Number.isFinite(maxRequests) && maxRequests > 0 ? maxRequests : 120;

  return (req, res, next) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const existing = store.get(key);

    if (!existing || now >= existing.resetAt) {
      store.set(key, { count: 1, resetAt: now + safeWindowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > safeMaxRequests) {
      res
        .status(429)
        .json({ ok: false, error: 'Too many requests, please try again later.' });
      return;
    }

    next();
  };
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization?.trim();
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function resolveCurrentUser(token: string | null): Promise<{ id: string; email: string | null } | null> {
  if (!token) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email?.trim().toLowerCase() ?? null,
  };
}

async function isAdminUser(user: { id: string; email: string | null }): Promise<boolean> {
  if (user.email && ADMIN_EMAILS.includes(user.email)) {
    return true;
  }

  const { data, error } = await supabase
    .from('specialist')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    return false;
  }

  return String((data as { role?: string | null } | null)?.role ?? '').trim().toLowerCase() === 'admin';
}

async function canDeleteOrder(
  orderId: string,
  user: { id: string; email: string | null },
): Promise<boolean> {
  if (await isAdminUser(user)) {
    return true;
  }

  const { data, error } = await supabase
    .from('order')
    .select('id,user_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return String((data as { user_id?: string | null }).user_id ?? '').trim() === user.id;
}

async function canDeletePortfolioWork(
  workId: string,
  user: { id: string; email: string | null },
): Promise<boolean> {
  if (await isAdminUser(user)) {
    return true;
  }

  const { data, error } = await supabase
    .from('portfolio_works')
    .select('id,owner_id')
    .eq('id', workId)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return String((data as { owner_id?: string | null }).owner_id ?? '').trim() === user.id;
}

app.post('/api/jobklient', async (req: Request, res: Response) => {
  try {
    const body = req.body as JobklientBody;
    const clientName = (body.client_name ?? body.name)?.trim();
    const phone = body.phone?.trim();
    const description = body.description?.trim();

    if (!clientName || !phone) {
      res.status(400).json({
        ok: false,
        error: 'name and phone are required',
      });
      return;
    }

    const row = {
      title: body.title?.trim() || 'Заявка с сайта',
      city: body.city?.trim() || '—',
      category: body.category?.trim() || 'general',
      budget: body.budget ?? null,
      description:
        description ||
        [`Заказчик: ${clientName}`, `Контакт: ${phone}`].filter(Boolean).join('\n'),
      status: body.status?.trim() || 'active',
    };

    const { data, error } = await supabase.from('order').insert([row]).select('*').single();

    if (error) {
      console.error('[POST /api/jobklient] Supabase error:', error.message);
      res.status(500).json({ ok: false, error: error.message });
      return;
    }

    console.log('[POST /api/jobklient] Created job:', data?.id);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    console.error('[POST /api/jobklient] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/api/furniture_orders', async (req: Request, res: Response) => {
  try {
    const body = req.body as FurnitureOrderBody;
    const clientName = (body.client_name ?? body.name)?.trim();
    const clientPhone = (body.client_phone ?? body.phone)?.trim();
    const furnitureType = body.furniture_type?.trim();
    const workType = body.work_type?.trim();

    if (!clientName || !clientPhone || !furnitureType || !workType) {
      res.status(400).json({
        ok: false,
        error: 'client_name, client_phone, furniture_type and work_type are required',
      });
      return;
    }

    const description = [
      body.description?.trim(),
      `Заказчик: ${clientName}`,
      `Телефон: ${clientPhone}`,
      `Тип: ${furnitureType}`,
      `Работа: ${workType}`,
    ]
      .filter(Boolean)
      .join('\n');

    const row = {
      title: workType || 'Заявка на мебель',
      city: body.city?.trim() || '—',
      category: 'furniture',
      budget: null,
      description,
      status: 'active',
    };

    const { data, error } = await supabase.from('order').insert([row]).select('*').single();

    if (error) {
      console.error('[POST /api/furniture_orders] Supabase error:', error.message);
      res.status(500).json({ ok: false, error: error.message });
      return;
    }

    console.log('[POST /api/furniture_orders] Created order:', data?.id);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    console.error('[POST /api/furniture_orders] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.post('/api/site_reviews', async (req: Request, res: Response) => {
  try {
    const body = req.body as SiteReviewBody;
    const userName = (body.user_name ?? body.name)?.trim();
    const reviewText = (body.review_text ?? body.text)?.trim();

    if (!userName || !reviewText) {
      res.status(400).json({
        ok: false,
        error: 'name and review_text are required',
      });
      return;
    }

    const row = {
      user_name: userName,
      review_text: reviewText,
    };

    const { data, error } = await supabase.from('site_reviews').insert([row]).select('*').single();

    if (error) {
      console.error('[POST /api/site_reviews] Supabase error:', error.message);
      res.status(500).json({ ok: false, error: error.message });
      return;
    }

    console.log('[POST /api/site_reviews] Created review:', data?.id);
    res.status(201).json({ ok: true, data });
  } catch (error) {
    console.error('[POST /api/site_reviews] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.delete('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = normalizePathParam(req.params.id);
    if (!orderId) {
      res.status(400).json({ ok: false, error: 'id is required' });
      return;
    }

    const user = await resolveCurrentUser(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const allowed = await canDeleteOrder(orderId, user);
    if (!allowed) {
      res.status(403).json({ ok: false, error: 'Forbidden' });
      return;
    }

    const { error } = await supabase.from('order').delete().eq('id', orderId);
    if (error) {
      res.status(500).json({ ok: false, error: error.message });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/orders/:id] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.delete('/api/portfolio-works/:id', async (req: Request, res: Response) => {
  try {
    const workId = normalizePathParam(req.params.id);
    if (!workId) {
      res.status(400).json({ ok: false, error: 'id is required' });
      return;
    }

    const user = await resolveCurrentUser(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const allowed = await canDeletePortfolioWork(workId, user);
    if (!allowed) {
      res.status(403).json({ ok: false, error: 'Forbidden' });
      return;
    }

    const { error } = await supabase.from('portfolio_works').delete().eq('id', workId);
    if (error) {
      res.status(500).json({ ok: false, error: error.message });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/portfolio-works/:id] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/catalog', async (_req: Request, res: Response) => {
  try {
    const specialistsResult = await supabase
      .from('specialist')
      .select('*')
      .order('name', { ascending: true });

    if (specialistsResult.error) {
      console.error('[GET /api/catalog] specialist error:', specialistsResult.error.message);
      res.status(500).json({ ok: false, error: specialistsResult.error.message });
      return;
    }

    const specialists = (specialistsResult.data ?? []).filter(
      (row) =>
        hasVisibleName(row.name) ||
        hasVisibleName(row.surname) ||
        hasVisibleName(row.full_name) ||
        hasVisibleName(row.phone) ||
        hasVisibleName(row.whatsapp_phone),
    );

    const masters = specialists.filter((row) => row.account_type === 'worker');
    const brigades = specialists.filter((row) => row.account_type === 'brigade');
    const furniture = specialists.filter((row) => row.account_type === 'furniture');

    console.log('[GET /api/catalog] Loaded:', {
      masters: masters.length,
      brigades: brigades.length,
      furniture: furniture.length,
    });

    res.json({
      ok: true,
      data: {
        masters,
        brigades,
        furniture,
      },
    });
  } catch (error) {
    console.error('[GET /api/catalog] Unexpected error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'FlooringLeader API' });
});

app.listen(PORT, () => {
  console.log(`[FlooringLeader API] Server listening on http://localhost:${PORT}`);
});
