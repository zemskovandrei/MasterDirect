import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

/** Единые якоря для сценария «выбор бригады → смета» */
export const BRIGADE_SECTION_FRAGMENT = 'brigade-section';
export const SMETA_SECTION_FRAGMENT = 'smeta-section';

@Injectable({ providedIn: 'root' })
export class SmetaNavigationService {
  goToSmeta(router: Router): void {
    void router.navigate(['/portfolio'], { fragment: SMETA_SECTION_FRAGMENT });
  }

  goToBrigades(router: Router): void {
    void router.navigate(['/portfolio'], { fragment: BRIGADE_SECTION_FRAGMENT });
  }
}
