import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'brigades', renderMode: RenderMode.Client },
  { path: 'masters', renderMode: RenderMode.Client },
  { path: 'masters/**', renderMode: RenderMode.Client },
  { path: 'furniture', renderMode: RenderMode.Client },
  // Client-only: email confirm / password reset land on /cabinet with ?code= or #access_token=
  // and must boot the SPA (prerendered /cabinet/ breaks relative assets on GitHub Pages).
  { path: 'cabinet', renderMode: RenderMode.Client },
  { path: 'reviews', renderMode: RenderMode.Prerender },
  { path: 'moderation', renderMode: RenderMode.Prerender },
  { path: 'admin', renderMode: RenderMode.Prerender },
  { path: 'verify/**', renderMode: RenderMode.Server },
  { path: 'brigades/**', renderMode: RenderMode.Client },
  { path: 'furniture/**', renderMode: RenderMode.Client },
  { path: 'portfolio', renderMode: RenderMode.Prerender },
  { path: 'portfolio/**', renderMode: RenderMode.Server },
  { path: 'jobs', renderMode: RenderMode.Client },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
];
