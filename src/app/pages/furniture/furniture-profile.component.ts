import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-furniture-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, BeforeAfterComponent],
  templateUrl: './furniture-profile.component.html',
  styleUrls: ['./furniture-profile.component.css'],
})
export class FurnitureProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(FurnitureStoreService);
  protected readonly translation = inject(TranslationService);

  private readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '')), {
    initialValue: '',
  });

  protected readonly company = computed(() => {
    const id = this.id();
    return id ? this.store.getCompany(id) : undefined;
  });

  protected readonly heroImage = computed(() => this.company()?.works[0]?.afterImage ?? null);
}
