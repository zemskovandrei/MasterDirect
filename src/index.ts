import 'dotenv/config';

import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PORT = Number(process.env.PORT) || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

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

app.use(cors());
app.use(express.json());

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

app.get('/api/catalog', async (_req: Request, res: Response) => {
  try {
    const specialistsResult = await supabase
      .from('specialist')
      .select('*')
      .or('is_archive.is.null,is_archive.eq.false')
      .order('created_at', { ascending: false });

    if (specialistsResult.error) {
      console.error('[GET /api/catalog] specialist error:', specialistsResult.error.message);
      res.status(500).json({ ok: false, error: specialistsResult.error.message });
      return;
    }

    const specialists = (specialistsResult.data ?? []).filter(
      (row) =>
        hasVisibleName(row.full_name) ||
        hasVisibleName(row.phone) ||
        hasVisibleName(row.whatsapp_phone),
    );

    const masters = specialists.filter(
      (row) => !row.account_type || row.account_type === 'worker',
    );
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
