import { Routes } from '@angular/router';
import { SiteLayoutComponent } from './layout/site-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { PerformerProfileComponent } from './pages/portfolio/performer-profile.component';
import { BrigadesPageComponent } from './pages/brigades/brigades-page.component';
import { MastersPageComponent } from './pages/masters/masters-page.component';
import { FurnitureCompaniesPageComponent } from './pages/furniture/furniture-companies-page.component';
import { FurnitureProfileComponent } from './pages/furniture/furniture-profile.component';
import { CabinetComponent } from './pages/cabinet/cabinet.component';
import { ModerationComponent } from './pages/moderation/moderation.component';
import { WorkVerificationComponent } from './pages/work-verification/work-verification.component';

export const routes: Routes = [
  { path: 'verify/:token', component: WorkVerificationComponent },
  {
    path: '',
    component: SiteLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'brigades', component: BrigadesPageComponent },
      { path: 'brigades/:id', component: PerformerProfileComponent, data: { performerType: 'brigade' } },
      { path: 'masters', component: MastersPageComponent },
      { path: 'masters/:id', component: PerformerProfileComponent, data: { performerType: 'worker' } },
      { path: 'furniture', component: FurnitureCompaniesPageComponent },
      { path: 'furniture/:id', component: FurnitureProfileComponent },
      { path: 'cabinet', component: CabinetComponent },
      { path: 'moderation', component: ModerationComponent },
      { path: 'portfolio', redirectTo: 'brigades', pathMatch: 'full' },
      { path: 'portfolio/brigade/:id', redirectTo: 'brigades/:id' },
      { path: 'portfolio/worker/:id', redirectTo: 'masters/:id' },
    ],
  },
];
