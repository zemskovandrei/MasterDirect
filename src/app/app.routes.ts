import { Routes } from '@angular/router';
import { SiteLayoutComponent } from './layout/site-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { PortfolioCatalogComponent } from './pages/portfolio/portfolio-catalog.component';
import { PerformerProfileComponent } from './pages/portfolio/performer-profile.component';
import { CabinetComponent } from './pages/cabinet/cabinet.component';

export const routes: Routes = [
  {
    path: '',
    component: SiteLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'portfolio', component: PortfolioCatalogComponent },
      { path: 'portfolio/:type/:id', component: PerformerProfileComponent },
      { path: 'cabinet', component: CabinetComponent },
      { path: 'moderation', component: CabinetComponent },
    ],
  },
];
