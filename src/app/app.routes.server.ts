import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'brigades', renderMode: RenderMode.Client },
  { path: 'masters', renderMode: RenderMode.Client },
  { path: 'masters/**', renderMode: RenderMode.Client },
  { path: 'furniture', renderMode: RenderMode.Client },
  { path: 'cabinet', renderMode: RenderMode.Prerender },
  { path: 'reviews', renderMode: RenderMode.Prerender },
  { path: 'moderation', renderMode: RenderMode.Prerender },
  { path: 'admin', renderMode: RenderMode.Prerender },
  { path: 'verify/**', renderMode: RenderMode.Server },
  { path: 'brigades/**', renderMode: RenderMode.Client },
  { path: 'furniture/**', renderMode: RenderMode.Client },
  { path: 'portfolio', renderMode: RenderMode.Prerender },
  { path: 'portfolio/**', renderMode: RenderMode.Server },
  { path: 'jobs', renderMode: RenderMode.Client },
];
