import { PerformerProfile } from '../models/portfolio.models';

function work(
  id: string,
  title: string,
  description: string,
  before: string,
  after: string,
  verificationStatus: import('../models/portfolio.models').WorkVerificationStatus = 'verified',
): import('../models/portfolio.models').WorkProject {
  return {
    id,
    title,
    description,
    beforeImage: before,
    afterImage: after,
    createdAt: new Date().toISOString(),
    verificationStatus,
    verifiedAt: verificationStatus === 'verified' ? new Date().toISOString() : undefined,
  };
}

export const SEED_PERFORMERS: PerformerProfile[] = [
  {
    id: 'brigada-stroykomfort',
    type: 'brigade',
    name: 'Бригада «СтройКомфорт»',
    specialty: 'Ремонт под ключ',
    description: 'Комплексный ремонт квартир и домов. Работаем с дизайн-проектом и без.',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'w1',
        'Ванная комната',
        'Полная отделка санузла с заменой сантехники',
        'assets/portfolio-03.jpg',
        'assets/portfolio-06.webp',
      ),
      work(
        'w2',
        'Кухня',
        'Черновая и чистовая отделка, встроенная техника',
        'assets/portfolio-02.jpg',
        'assets/portfolio-05.jpg',
      ),
    ],
  },
  {
    id: 'brigada-remont-pro',
    type: 'brigade',
    name: 'Remont Pro Team',
    specialty: 'Косметический и капитальный ремонт',
    description: 'Бригада из 6 человек. Смета и график до старта работ.',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'w1',
        'Гостиная',
        'Выравнивание стен, напольное покрытие, освещение',
        'assets/portfolio-02.jpg',
        'assets/portfolio-01.webp',
      ),
      work(
        'w2',
        'Спальня',
        'Отделка и монтаж встроенных систем хранения',
        'assets/portfolio-03.jpg',
        'assets/portfolio-04.jpg',
      ),
    ],
  },
  {
    id: 'master-ivan-plit',
    type: 'worker',
    name: 'Иван К.',
    specialty: 'Плиточник',
    description: 'Укладка плитки и керамогранита. Опыт 12 лет.',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'w1',
        'Ванная — плитка',
        'Керамогранит на пол и стены, затирка эпоксидная',
        'assets/portfolio-02.jpg',
        'assets/portfolio-06.webp',
      ),
    ],
  },
  {
    id: 'master-aleksey-elektrik',
    type: 'worker',
    name: 'Алексей М.',
    specialty: 'Электрик',
    description: 'Разводка, щиты, умный дом. Допуски и гарантия.',
    subscribed: true,
    isDemo: true,
    works: [
      work(
        'w1',
        'Квартира — электрика',
        'Новая разводка и освещение по проекту',
        'assets/portfolio-03.jpg',
        'assets/portfolio-01.webp',
      ),
    ],
  },
];
