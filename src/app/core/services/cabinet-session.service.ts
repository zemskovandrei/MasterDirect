import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import type { User } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { FurnitureStoreService } from './furniture-store.service';
import { PortfolioStoreService } from './portfolio-store.service';
import { SupabaseService } from './supabase.service';
import { profileToFurnitureCompany, profileToPerformer } from '../utils/profile-mapper.util';
import type { Profile } from '../models/profile.models';
import type { AccountType } from '../models/portfolio.models';
import { buildFurnitureSlug } from '../utils/furniture-id.util';

@Injectable({ providedIn: 'root' })
export class CabinetSessionService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly portfolioStore = inject(PortfolioStoreService);
  private readonly furnitureStore = inject(FurnitureStoreService);

  async restoreForCurrentUser(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    await this.auth.ensureInitialized();
    const user = this.auth.user();
    if (!user?.id) {
      return false;
    }

    const userId = user.id;
    const currentPerformer = this.portfolioStore.currentPerformer();
    if (currentPerformer?.id === userId) {
      return true;
    }

    const currentCompany = this.furnitureStore.currentCompany();
    if (currentCompany?.id === userId || currentCompany?.dbId === userId) {
      return true;
    }

    await firstValueFrom(this.supabase.loadProfiles());
    const profiles = this.supabase.profiles();
    const profile =
      profiles.find((item) => item.id === userId) ??
      profiles.find((item) => item.slug === userId);

    if (!profile) {
      const sync = await this.supabase.syncAuthProfileFromUser(user);
      if (!sync.error) {
        await firstValueFrom(this.supabase.loadProfiles());
        const syncedProfile =
          this.supabase.profiles().find((item) => item.id === userId) ??
          this.supabase.profiles().find((item) => item.slug === userId);
        if (syncedProfile) {
          return this.applyProfileSession(syncedProfile);
        }
      }

      return this.ensureFromAuthUser(user);
    }

    return this.applyProfileSession(profile);
  }

  private async persistLocalProfileToDatabase(user: User): Promise<void> {
    const sync = await this.supabase.syncAuthProfileFromUser(user);
    if (!sync.error) {
      return;
    }

    const meta = user.user_metadata ?? {};
    const fullName = String(meta['full_name'] ?? user.email?.split('@')[0] ?? 'Профиль').trim();
    const specialty = String(meta['specialty'] ?? 'electrician').trim();
    const phone = String(meta['phone'] ?? '').trim();
    const proRole = String(meta['pro_role'] ?? '');
    const accountTypeRaw = String(meta['account_type'] ?? '');
    const accountType = this.resolveAccountType(proRole, accountTypeRaw);

    if (!accountType) {
      return;
    }

    await this.supabase.registerAuthProfile({
      userId: user.id,
      accountType: accountType === 'furniture' ? 'furniture' : accountType,
      fullName,
      phone: phone || '-',
      city: String(meta['city'] ?? '').trim(),
      specialty,
      description: String(meta['description'] ?? fullName).trim(),
      proRole: proRole || undefined,
      whatsapp: String(meta['whatsapp'] ?? '').trim() || undefined,
      telegram: String(meta['telegram'] ?? '').trim() || undefined,
      instagram: String(meta['instagram'] ?? '').trim() || undefined,
      facebook: String(meta['facebook'] ?? '').trim() || undefined,
      slug:
        accountType === 'furniture'
          ? `${buildFurnitureSlug(fullName)}-${user.id.replace(/-/g, '').slice(0, 8)}`
          : undefined,
    });
  }

  private applyProfileSession(profile: Profile): boolean {
    if (profile.type === 'furniture') {
      const local = this.furnitureStore
        .companies()
        .find(
          (item) =>
            item.id === profile.id ||
            item.dbId === profile.id ||
            (profile.slug != null && item.slug === profile.slug),
        );
      const company = profileToFurnitureCompany(
        profile,
        local?.works ?? [],
        local?.workVideos ?? [],
      );
      this.furnitureStore.ensureCompany(company);
      this.furnitureStore.setSession(company.id);
      this.portfolioStore.signOut();
      return true;
    }

    const local = this.portfolioStore
      .performers()
      .find((item) => item.id === profile.id && item.type === profile.type);
    const performer = profileToPerformer(profile, local?.works ?? [], local?.workVideos ?? []);
    this.portfolioStore.ensurePerformer(performer);
    this.portfolioStore.setSession(performer.id);
    this.furnitureStore.signOut();
    return true;
  }

  private ensureFromAuthUser(user: User): boolean {
    const meta = user.user_metadata ?? {};
    const fullName = String(meta['full_name'] ?? user.email?.split('@')[0] ?? 'Профиль').trim();
    const specialty = String(meta['specialty'] ?? 'electrician').trim();
    const description = String(meta['description'] ?? fullName).trim();
    const phone = String(meta['phone'] ?? '').trim();
    const city = String(meta['city'] ?? '').trim();
    const proRole = String(meta['pro_role'] ?? '');
    const accountTypeRaw = String(meta['account_type'] ?? '');
    const accountType = this.resolveAccountType(proRole, accountTypeRaw);

    const socialLinks = {
      phone: phone || undefined,
      whatsapp: String(meta['whatsapp'] ?? '').trim() || undefined,
      telegram: String(meta['telegram'] ?? '').trim() || undefined,
      instagram: String(meta['instagram'] ?? '').trim() || undefined,
      facebook: String(meta['facebook'] ?? '').trim() || undefined,
    };

    if (accountType === 'furniture') {
      const slug = buildFurnitureSlug(fullName);
      this.furnitureStore.registerCompanyWithId(slug, {
        name: fullName,
        specialty,
        description,
        city,
        socialLinks,
        dbId: user.id,
        slug,
      });
      this.portfolioStore.signOut();
      void this.persistLocalProfileToDatabase(user);
      return true;
    }

    if (accountType === 'brigade' || accountType === 'worker') {
      this.portfolioStore.registerPerformerWithId(user.id, {
        type: accountType,
        name: fullName,
        specialty,
        description,
        socialLinks,
      });
      this.furnitureStore.signOut();
      void this.persistLocalProfileToDatabase(user);
      return true;
    }

    return false;
  }

  private resolveAccountType(proRole: string, accountTypeRaw: string): AccountType | 'furniture' | null {
    if (proRole === 'furniture_maker' || accountTypeRaw === 'furniture') {
      return 'furniture';
    }
    if (proRole === 'builder' || accountTypeRaw === 'brigade') {
      return 'brigade';
    }
    if (proRole === 'master' || accountTypeRaw === 'worker') {
      return 'worker';
    }
    return null;
  }
}
