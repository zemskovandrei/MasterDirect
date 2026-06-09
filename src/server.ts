import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

app.post('/api/calculator/telegram', async (req, res) => {
  const botToken = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];

  if (!botToken || !chatId) {
    res.status(503).json({ ok: false, error: 'telegram_not_configured' });
    return;
  }

  const {
    directedTo,
    name,
    contact,
    roomType,
    renovationType,
    areaSqm,
  } = req.body as {
    directedTo?: string;
    name?: string;
    contact?: string;
    roomType?: string;
    renovationType?: string;
    areaSqm?: number;
  };

  if (!name?.trim() || !contact?.trim()) {
    res.status(400).json({ ok: false, error: 'invalid_payload' });
    return;
  }

  const text = [
    `🎯 НАПРАВЛЕНО МАСТЕРУ: ${directedTo?.trim() || '—'}`,
    `👤 Заказчик: ${name.trim()}`,
    `📞 Контакт: ${contact.trim()}`,
    `🏠 Помещение: ${roomType ?? '—'}`,
    `🔧 Ремонт: ${renovationType ?? '—'}`,
    `📐 Площадь: ${areaSqm ?? '—'} кв.м`,
  ].join('\n');

  try {
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      },
    );

    const payload = (await telegramResponse.json()) as { ok?: boolean };
    res.status(telegramResponse.ok ? 200 : 502).json({ ok: payload.ok === true });
  } catch {
    res.status(502).json({ ok: false, error: 'telegram_request_failed' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
