import { FurnitureCompany } from '../models/furniture.models';

function work(
  id: string,
  title: string,
  description: string,
  before: string,
  after: string,
): import('../models/portfolio.models').WorkProject {
  return {
    id,
    title,
    description,
    beforeImage: before,
    afterImage: after,
    createdAt: new Date().toISOString(),
    verificationStatus: 'verified',
    verifiedAt: new Date().toISOString(),
  };
}

export const SEED_FURNITURE_COMPANIES: FurnitureCompany[] = [
  {
    id: 'mebel-studio-luxe',
    name: 'Студия «Luxe Kitchen»',
    specialty: 'Кухни на заказ',
    description: 'Проектирование, производство и монтаж кухонь из МДФ, массива и шпона.',
    city: 'Москва',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'f1',
        'Кухня в скандинавском стиле',
        'Фасады МДФ, фурнитура Blum, столешница камень',
        'assets/portfolio-02.jpg',
        'assets/portfolio-05.jpg',
      ),
    ],
  },
  {
    id: 'mebel-dom-fit',
    name: 'DomFit Мебель',
    specialty: 'Встроенная мебель',
    description: 'Шкафы-купе, гардеробные и мебель для гостиных под размер помещения.',
    city: 'Санкт-Петербург',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'f1',
        'Гардеробная 4 м²',
        'Система хранения, подсветка, раздвижные двери',
        'assets/portfolio-03.jpg',
        'assets/portfolio-06.webp',
      ),
      work(
        'f2',
        'Гостиная под ключ',
        'ТВ-зона, стеллажи и закрытые секции',
        'assets/portfolio-04.jpg',
        'assets/portfolio-01.webp',
      ),
    ],
  },
  {
    id: 'mebel-craft-wood',
    name: 'CraftWood',
    specialty: 'Мебель из массива',
    description: 'Столы, комоды и спальни из дуба и ясеня. Собственное производство.',
    city: 'Казань',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'f1',
        'Спальня из ясеня',
        'Кровать, прикроватные тумбы и комод в едином стиле',
        'assets/portfolio-02.jpg',
        'assets/portfolio-04.jpg',
      ),
    ],
  },
];
