import { Component, computed, effect, inject, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { WorkVideoPlayerComponent } from '../../shared/components/work-video-player/work-video-player.component';
import { TranslationService } from '../../core/services/translation.service';
import { SeoService } from '../../core/services/seo.service';
import { mergeSocialLinks } from '../../core/utils/social-links.util';

@Component({
  selector: 'app-furniture-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent, WorkVideoPlayerComponent],
  templateUrl: './furniture-profile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./furniture-profile.component.css'],
})
export class FurnitureProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(FurnitureStoreService);
  private readonly supabase = inject(SupabaseService);
  protected readonly translation = inject(TranslationService);
  private readonly seo = inject(SeoService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  constructor() {
    effect(() => {
      const company = this.company();
      const id = this.id();
      if (!company || !id) {
        return;
      }
      const city = company.city?.trim() || 'Батуми / Тбилиси';
      const desc =
        (company.description?.trim() ||
          `${company.name} — мебель на заказ. Кухни, шкафы, корпусная мебель.`) + ` ${city}.`;
      this.seo.setPage({
        title: `${company.name} — мебель на заказ | MASTERDIRECT`,
        description: desc.slice(0, 320),
        path: `/furniture/${company.slug || id}`,
        image: company.works?.[0]?.afterImage ?? null,
        type: 'profile',
      });
    });
  }

  protected readonly company = computed(() => {
    const id = this.id();
    if (!id) {
      return undefined;
    }

    const local = this.store.getCompany(id);
    const remote = this.supabase
      .furnitureCompanies()
      .find((item) => item.id === id || item.slug === id || item.dbId === id);
    if (local && remote) {
      return {
        ...local,
        ...remote,
        socialLinks: mergeSocialLinks(remote.socialLinks, local.socialLinks),
        works: remote.works.length > 0 ? remote.works : local.works,
        workVideos: remote.workVideos.length > 0 ? remote.workVideos : local.workVideos,
      };
    }

    return remote ?? local;
  });

  protected readonly heroImage = computed(() => this.company()?.works[0]?.afterImage ?? null);
}
