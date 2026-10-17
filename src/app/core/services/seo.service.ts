import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface SeoPageInput {
  title: string;
  description: string;
  path?: string;
  image?: string | null;
  type?: 'website' | 'profile' | 'article';
  noIndex?: boolean;
}

const SITE_URL = 'https://masterdirect.ge';
const SITE_NAME = 'MASTERDIRECT';
const DEFAULT_IMAGE = `${SITE_URL}/assets/logo-mark.png`;
const DEFAULT_DESCRIPTION =
  'MASTERDIRECT — мастера, бригады и мебель в Батуми и Тбилиси. Заказы на ремонт, прямой контакт без посредников и комиссии.';

/** Route SEO tuned for Google impressions (local + intent keywords). */
const ROUTE_SEO: Array<{ match: RegExp; page: SeoPageInput }> = [
  {
    match: /^\/?$/,
    page: {
      title: 'MASTERDIRECT — мастера и ремонт в Батуми и Тбилиси',
      description:
        'Биржа мастеров и заказов в Грузии: плитка, электрика, сантехника, отделка, ремонт под ключ. Найдите исполнителя или разместите заказ бесплатно.',
      path: '/',
    },
  },
  {
    match: /^\/masters\/?$/,
    page: {
      title: 'Мастера по ремонту в Батуми и Тбилиси — каталог MASTERDIRECT',
      description:
        'Каталог мастеров: плиточники, электрики, сантехники, отделочники. Контакты WhatsApp и Telegram без посредника. Батуми, Тбилиси.',
      path: '/masters',
    },
  },
  {
    match: /^\/brigades\/?$/,
    page: {
      title: 'Бригады для ремонта квартир и домов — MASTERDIRECT',
      description:
        'Бригады для ремонта под ключ в Батуми и Тбилиси. Смотрите портфолио до/после и пишите напрямую.',
      path: '/brigades',
    },
  },
  {
    match: /^\/furniture\/?$/,
    page: {
      title: 'Мебель на заказ в Батуми и Тбилиси — MASTERDIRECT',
      description:
        'Мебельные компании: кухни, шкафы, корпусная мебель на заказ. Портфолио и прямой контакт с фабрикой.',
      path: '/furniture',
    },
  },
  {
    match: /^\/jobs\/?$/,
    page: {
      title: 'Заказы на ремонт — найти работу мастеру | MASTERDIRECT',
      description:
        'Актуальные заказы на ремонт в Батуми и Тбилиси. Разместите заявку или откликнитесь как мастер — без комиссии платформы.',
      path: '/jobs',
    },
  },
  {
    match: /^\/portfolio\/?$/,
    page: {
      title: 'Работы до и после — портфолио ремонта | MASTERDIRECT',
      description:
        'Галерея реальных объектов: фото до и после ремонта от мастеров и бригад Батуми и Тбилиси.',
      path: '/portfolio',
    },
  },
  {
    match: /^\/reviews\/?$/,
    page: {
      title: 'Отзывы о мастерах и ремонте — MASTERDIRECT',
      description:
        'Отзывы заказчиков о мастерах и бригадах на платформе MASTERDIRECT. Выбирайте исполнителя по рейтингу и работам.',
      path: '/reviews',
    },
  },
  {
    match: /^\/privacy\/?$/,
    page: {
      title: 'Политика конфиденциальности — MASTERDIRECT',
      description: 'Как MASTERDIRECT обрабатывает персональные данные пользователей.',
      path: '/privacy',
    },
  },
  {
    match: /^\/terms\/?$/,
    page: {
      title: 'Пользовательское соглашение — MASTERDIRECT',
      description: 'Условия использования платформы MASTERDIRECT.',
      path: '/terms',
    },
  },
  {
    match: /^\/cabinet/,
    page: {
      title: 'Личный кабинет — MASTERDIRECT',
      description: 'Кабинет исполнителя и заказчика MASTERDIRECT.',
      path: '/cabinet',
      noIndex: true,
    },
  },
  {
    match: /^\/admin/,
    page: {
      title: 'Админ — MASTERDIRECT',
      description: 'Администрирование MASTERDIRECT.',
      path: '/admin',
      noIndex: true,
    },
  },
  {
    match: /^\/moderation/,
    page: {
      title: 'Модерация — MASTERDIRECT',
      description: 'Модерация контента MASTERDIRECT.',
      path: '/moderation',
      noIndex: true,
    },
  },
];

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects.split('?')[0].split('#')[0];
      this.applyRouteDefaults(url);
    });
  }

  /** Call when page has dynamic entity (profile / company). */
  setPage(input: SeoPageInput): void {
    this.apply(input);
  }

  applyRouteDefaults(url: string): void {
    const normalized = url.startsWith('/') ? url : `/${url}`;
    // Dynamic profile routes — leave until component sets SEO; use safe fallback.
    if (/^\/(masters|brigades|furniture)\/[^/]+/.test(normalized)) {
      this.apply({
        title: `${SITE_NAME} — профиль исполнителя`,
        description: DEFAULT_DESCRIPTION,
        path: normalized,
      });
      return;
    }
    const hit = ROUTE_SEO.find((item) => item.match.test(normalized));
    this.apply(hit?.page ?? {
      title: `${SITE_NAME} — ремонт и мастера в Грузии`,
      description: DEFAULT_DESCRIPTION,
      path: normalized,
    });
  }

  private apply(input: SeoPageInput): void {
    const title = input.title.trim();
    const description = input.description.trim().slice(0, 320);
    const path = (input.path ?? '/').startsWith('http')
      ? (input.path as string)
      : `${SITE_URL}${input.path?.startsWith('/') ? input.path : `/${input.path ?? ''}`}`;
    const canonical = path.replace(/\/$/, '') || SITE_URL;
    const image = (input.image?.trim() || DEFAULT_IMAGE).startsWith('http')
      ? (input.image?.trim() || DEFAULT_IMAGE)
      : `${SITE_URL}${input.image}`;
    const ogType = input.type === 'profile' ? 'profile' : 'website';

    this.title.setTitle(title);
    this.upsertName('description', description);
    this.upsertName('robots', input.noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    this.upsertName('author', SITE_NAME);
    this.upsertProperty('og:type', ogType);
    this.upsertProperty('og:site_name', SITE_NAME);
    this.upsertProperty('og:locale', 'ru_GE');
    this.upsertProperty('og:locale:alternate', 'ka_GE');
    this.upsertProperty('og:title', title);
    this.upsertProperty('og:description', description);
    this.upsertProperty('og:url', canonical);
    this.upsertProperty('og:image', image);
    this.upsertName('twitter:card', 'summary_large_image');
    this.upsertName('twitter:title', title);
    this.upsertName('twitter:description', description);
    this.upsertName('twitter:image', image);
    this.setCanonical(canonical);
    this.setJsonLd('website', {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_DESCRIPTION,
      inLanguage: ['ru', 'ka', 'en'],
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/masters?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    });
  }

  private upsertName(name: string, content: string): void {
    if (this.meta.getTag(`name="${name}"`)) {
      this.meta.updateTag({ name, content });
    } else {
      this.meta.addTag({ name, content });
    }
  }

  private upsertProperty(property: string, content: string): void {
    if (this.meta.getTag(`property="${property}"`)) {
      this.meta.updateTag({ property, content });
    } else {
      this.meta.addTag({ property, content });
    }
  }

  private setCanonical(url: string): void {
    const head = this.document.head;
    if (!head) {
      return;
    }
    let link = head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(id: string, data: Record<string, unknown>): void {
    const scriptId = `md-jsonld-${id}`;
    let el = this.document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!el) {
      el = this.document.createElement('script');
      el.type = 'application/ld+json';
      el.id = scriptId;
      this.document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }
}
