import { useTranslation } from 'react-i18next';

function Navbar() {
  const { t } = useTranslation();

  return (
    <nav>
      <ul>
        <li>
          <a href="/features">{t('app.nav.features')}</a>
        </li>
        <li>
          <a href="/services">{t('app.nav.services')}</a>
        </li>
        <li>
          <a href="/portfolio">{t('app.nav.portfolio')}</a>
        </li>
        <li>
          <a href="/cabinet">{t('app.nav.cabinet')}</a>
        </li>
        <li>
          <a href="/estimate">{t('app.nav.estimate')}</a>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
