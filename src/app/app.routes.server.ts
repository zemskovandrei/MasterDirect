import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'brigades', renderMode: RenderMode.Prerender },
  { path: 'masters', renderMode: RenderMode.Prerender },
  { path: 'masters/**', renderMode: RenderMode.Server },
  { path: 'furniture', renderMode: RenderMode.Prerender },
  { path: 'cabinet', renderMode: RenderMode.Prerender },
  { path: 'reviews', renderMode: RenderMode.Prerender },
  { path: 'moderation', renderMode: RenderMode.Prerender },
  { path: 'admin', renderMode: RenderMode.Prerender },
  { path: 'verify/**', renderMode: RenderMode.Server },
  { path: 'brigades/**', renderMode: RenderMode.Server },
  { path: 'furniture/**', renderMode: RenderMode.Server },
  { path: 'portfolio', renderMode: RenderMode.Prerender },
  { path: 'portfolio/**', renderMode: RenderMode.Server },
];
