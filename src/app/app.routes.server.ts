import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Prerender public catalog pages so Google gets HTTP 200 + HTML (not only SPA 404 shell).
 * Auth / dynamic IDs stay client-rendered.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'brigades', renderMode: RenderMode.Prerender },
  { path: 'masters', renderMode: RenderMode.Prerender },
  { path: 'furniture', renderMode: RenderMode.Prerender },
  { path: 'jobs', renderMode: RenderMode.Prerender },
  { path: 'portfolio', renderMode: RenderMode.Prerender },
  { path: 'reviews', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  // Client-only: auth return URLs and private tools
  { path: 'cabinet', renderMode: RenderMode.Client },
  { path: 'moderation', renderMode: RenderMode.Client },
  { path: 'admin', renderMode: RenderMode.Client },
  { path: 'verify/**', renderMode: RenderMode.Client },
  { path: 'masters/**', renderMode: RenderMode.Client },
  { path: 'brigades/**', renderMode: RenderMode.Client },
  { path: 'furniture/**', renderMode: RenderMode.Client },
  { path: 'portfolio/**', renderMode: RenderMode.Client },
];
