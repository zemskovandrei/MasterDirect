import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="catalog-tab-page" style="padding:2rem 1rem;max-width:900px;margin:0 auto;">
      <h1>Условия использования</h1>
      <p>
        Используя сайт, вы соглашаетесь с правилами публикации контента, обработки заявок и
        коммуникации между участниками платформы.
      </p>
      <h2>Общие правила</h2>
      <ul>
        <li>Публикуйте только достоверную информацию.</li>
        <li>Запрещены мошеннические, оскорбительные и незаконные материалы.</li>
        <li>Администрация вправе ограничить доступ к контенту, нарушающему правила.</li>
      </ul>
      <h2>Ответственность</h2>
      <p>
        Платформа предоставляет техническую возможность поиска и публикации заявок, но не является
        стороной договоров между пользователями.
      </p>
      <h2>Изменения условий</h2>
      <p>
        Мы можем обновлять условия использования. Актуальная версия всегда доступна на этой
        странице.
      </p>
      <p><em>Последнее обновление: 27.06.2026</em></p>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsOfServiceComponent {}
