import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PortfolioStoreService } from '../../core/services/portfolio-store.service';
import { FurnitureStoreService } from '../../core/services/furniture-store.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { CalculatorLeadStoreService } from '../../core/services/calculator-lead-store.service';
import { CatalogLocalizationService } from '../../core/services/catalog-localization.service';
import {
  CalculatorPerformerCard,
  CalculatorPerformerPool,
  CalculatorRenovationType,
  CalculatorRoomType,
} from '../../core/models/calculator.models';
import { PerformerProfile } from '../../core/models/portfolio.models';
import { buildJobklientJobInsert, JobDescriptionLabels } from '../../models/job.model';
import { BeforeAfterComponent } from '../../shared/components/before-after/before-after.component';
import { TranslationService } from '../../core/services/translation.service';
import { resolveAssetUrl } from '../../core/utils/asset-url.util';
import { isPaidCallOutFee } from '../../core/utils/call-out-fee.util';
import { redirectToExecutor } from '../../core/utils/executor-messenger.util';
import {
  buildChecklistPhaseGroups,
  buildChecklistScopeSummary,
  buildDefaultChecklistSelection,
  countChecklistItemsInGroups,
  filterChecklistPhaseGroups,
  matchesChecklistSearch,
  splitChecklistPhaseGroups,
  getAllVisibleChecklistItemIds,
} from '../../core/utils/renovation-checklist.util';

interface ServiceItem {
  image: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, BeforeAfterComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  protected readonly portfolioStore = inject(PortfolioStoreService);
  protected readonly furnitureStore = inject(FurnitureStoreService);
  protected readonly supabase = inject(SupabaseService);
  protected readonly calculatorLeadStore = inject(CalculatorLeadStoreService);
  protected readonly catalogL10n = inject(CatalogLocalizationService);
  protected readonly translation = inject(TranslationService);
  protected currentSlideIndex = signal(0);

  protected readonly calculatorStep = signal(1);
  protected readonly calculatorSubmitted = signal(false);
  protected readonly calculatorSubmitting = signal(false);
  protected readonly calculatorSubmitError = signal<string | null>(null);
  protected readonly calculatorLastOrderDetails = signal('');
  protected readonly calculatorSubmittedExecutors = signal<CalculatorPerformerCard[]>([]);
  protected readonly calculatorMessengerWarning = signal<string | null>(null);
  protected readonly calculatorRoomType = signal<CalculatorRoomType | null>(null);
  protected readonly calculatorRenovationType = signal<CalculatorRenovationType | null>(null);
  protected readonly calculatorArea = signal('');
  protected readonly calculatorAreaTouched = signal(false);
  protected readonly calculatorSelectedPerformerIds = signal<string[]>([]);
  protected readonly calculatorChecklistSelection = signal<string[]>([]);
  protected readonly calculatorChecklistTouched = signal(false);
  protected readonly calculatorChecklistSearchQuery = signal('');
  protected readonly calculatorChecklistCustomDraft = signal('');
  protected readonly calculatorChecklistCustomItems = signal<string[]>([]);
  protected readonly calculatorChecklistCustomError = signal<string | null>(null);

  protected readonly calculatorRoomOptions: { id: CalculatorRoomType; labelKey: string }[] = [
    { id: 'new_build', labelKey: 'home.calculator.roomTypes.newBuild' },
    { id: 'secondary', labelKey: 'home.calculator.roomTypes.secondary' },
    { id: 'house', labelKey: 'home.calculator.roomTypes.house' },
    { id: 'commercial', labelKey: 'home.calculator.roomTypes.commercial' },
  ];

  protected readonly calculatorRenovationOptions: {
    id: CalculatorRenovationType;
    labelKey: string;
  }[] = [
    { id: 'cosmetic', labelKey: 'home.calculator.renovationTypes.cosmetic' },
    { id: 'capital', labelKey: 'home.calculator.renovationTypes.capital' },
    { id: 'design', labelKey: 'home.calculator.renovationTypes.design' },
    { id: 'furniture', labelKey: 'home.calculator.renovationTypes.furniture' },
  ];

  protected readonly calculatorPerformerPool = computed((): CalculatorPerformerPool | null => {
    const renovationType = this.calculatorRenovationType();
    if (!renovationType) {
      return null;
    }
    if (renovationType === 'furniture') {
      return 'furniture';
    }
    if (renovationType === 'cosmetic') {
      return 'worker';
    }
    return 'brigade';
  });

  protected readonly calculatorPerformerCards = computed((): CalculatorPerformerCard[] => {
    this.translation.locale();
    const pool = this.calculatorPerformerPool();
    const defaultCity = this.translation.t('home.calculator.defaultCity');

    if (pool === 'brigade') {
      return this.supabase
        .brigades()
        .map((performer) => this.mapPerformerCard(performer, 'brigade'));
    }

    if (pool === 'worker') {
      return this.supabase.workers().map((performer) => this.mapPerformerCard(performer, 'worker'));
    }

    if (pool === 'furniture') {
      return this.supabase.furnitureCompanies().map((company) => ({
        id: company.id,
        pool: 'furniture',
        name: company.name,
        city: company.city || defaultCity,
        experience: this.catalogL10n.localizeSpecialtyField(company.specialty),
        callOutFee: null,
        callOutPaid: false,
        whatsapp_phone: company.whatsapp_phone ?? company.socialLinks?.whatsapp ?? null,
        tg_username: company.tg_username ?? company.socialLinks?.telegram ?? null,
      }));
    }

    return [];
  });

  protected readonly calculatorSelectedPerformerNames = computed(() => {
    const selectedIds = new Set(this.calculatorSelectedPerformerIds());
    return this.calculatorPerformerCards()
      .filter((card) => selectedIds.has(card.id))
      .map((card) => card.name);
  });

  protected readonly calculatorHasSelectedPerformers = computed(
    () => this.calculatorSelectedPerformerNames().length > 0,
  );

  protected readonly calculatorRequiresPaidCallOutConsent = computed(() => {
    const selectedIds = new Set(this.calculatorSelectedPerformerIds());
    return this.calculatorPerformerCards()
      .filter((card) => selectedIds.has(card.id))
      .some((card) => card.callOutPaid);
  });

  protected readonly calculatorCityOptions = [
    { id: 'batumi', labelKey: 'home.calculator.cities.batumi' },
    { id: 'tbilisi', labelKey: 'home.calculator.cities.tbilisi' },
    { id: 'both', labelKey: 'home.calculator.cities.both' },
  ] as const;

  protected readonly calculatorContactForm = this.fb.nonNullable.group({
    city: ['batumi', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    contact: ['', [Validators.required, Validators.minLength(5)]],
    photoLink: [''],
    paidCallOutAccepted: [false],
  });

  protected readonly calculatorChecklistReady = computed(() => {
    const roomType = this.calculatorRoomType();
    const renovationType = this.calculatorRenovationType();
    const areaSqm = Number(this.calculatorArea().replace(',', '.'));

    return !!(
      roomType &&
      renovationType &&
      Number.isFinite(areaSqm) &&
      areaSqm >= 5
    );
  });

  protected readonly calculatorChecklistGroups = computed(() => {
    this.translation.locale();
    const roomType = this.calculatorRoomType();
    const renovationType = this.calculatorRenovationType();

    if (!roomType || !renovationType) {
      return [];
    }

    return buildChecklistPhaseGroups(
      renovationType,
      roomType,
      new Set(this.calculatorChecklistSelection()),
    );
  });

  protected readonly calculatorChecklistFilteredGroups = computed(() => {
    this.translation.locale();
    return filterChecklistPhaseGroups(
      this.calculatorChecklistGroups(),
      this.calculatorChecklistSearchQuery(),
      (key) => this.translation.t(key),
    );
  });

  protected readonly calculatorChecklistMainFilteredGroups = computed(() =>
    splitChecklistPhaseGroups(this.calculatorChecklistFilteredGroups()).main,
  );

  protected readonly calculatorChecklistExtraGroup = computed(
    () => splitChecklistPhaseGroups(this.calculatorChecklistFilteredGroups()).extra,
  );

  protected readonly calculatorChecklistSearchResultsCount = computed(() =>
    countChecklistItemsInGroups(this.calculatorChecklistFilteredGroups()) +
    this.calculatorChecklistFilteredCustomItems().length,
  );

  protected readonly calculatorChecklistFilteredCustomItems = computed(() => {
    const query = this.calculatorChecklistSearchQuery().trim();
    const items = this.calculatorChecklistCustomItems();
    if (!query) {
      return items;
    }
    return items.filter((item) => matchesChecklistSearch(item, query));
  });

  protected readonly calculatorChecklistSearchHasResults = computed(() => {
    if (!this.calculatorChecklistSearchQuery().trim()) {
      return true;
    }
    return (
      countChecklistItemsInGroups(this.calculatorChecklistMainFilteredGroups()) > 0 ||
      (this.calculatorChecklistExtraGroup()?.items.length ?? 0) > 0 ||
      this.calculatorChecklistFilteredCustomItems().length > 0
    );
  });

  protected readonly hasGalleryPerformers = computed(
    () =>
      this.supabase.brigades().length > 0 ||
      this.supabase.workers().length > 0 ||
      this.supabase.furnitureCompanies().length > 0,
  );

  private readonly serviceImageFiles = ['1.jpeg', '2.jpeg', '3.jpeg', '4.jpeg', '5.jpeg', '6.jpeg'];

  private readonly serviceContent: Omit<ServiceItem, 'image'>[] = [
    {
      title: 'home.services.items.turnkey.title',
      description: 'home.services.items.turnkey.desc',
    },
    {
      title: 'home.services.items.tiler.title',
      description: 'home.services.items.tiler.desc',
    },
    {
      title: 'home.services.items.electrician.title',
      description: 'home.services.items.electrician.desc',
    },
    {
      title: 'home.services.items.plumber.title',
      description: 'home.services.items.plumber.desc',
    },
    {
      title: 'home.services.items.finisher.title',
      description: 'home.services.items.finisher.desc',
    },
    {
      title: 'home.services.items.furniture.title',
      description: 'home.services.items.furniture.desc',
    },
  ];

  private readonly sliderImageFiles = [
    'portfolio-01.jpg',
    'portfolio-02.jpg',
    'portfolio-03.jpg',
    'portfolio-04.jpg',
    'portfolio-05.jpg',
    'portfolio-06.jpg',
  ];

  private readonly sliderImages = this.sliderImageFiles.map((file) =>
    resolveAssetUrl(`assets/${file}`),
  );

  protected readonly services: ServiceItem[] = this.serviceContent.map((item, index) => ({
    ...item,
    image: resolveAssetUrl(`assets/${this.serviceImageFiles[index]}`),
  }));

  protected readonly sliderDots = this.sliderImageFiles.map((_, index) => index);
  protected readonly currentSlide = signal(this.sliderImages[0] ?? '');
  protected readonly slideTone = signal<'light' | 'dark'>('dark');

  private slideIntervalId?: ReturnType<typeof setInterval>;
  private readonly slideToneCache = new Map<number, 'light' | 'dark'>();

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.supabase.loadProfiles().subscribe();
      this.resolveSlideTone(0);
      this.sliderImages.forEach((_, index) => {
        if (index !== 0) {
          this.analyzeSlideTone(index);
        }
      });
      this.slideIntervalId = setInterval(() => this.nextSlide(), 5000);
    }
  }

  ngOnDestroy() {
    if (this.slideIntervalId !== undefined) {
      clearInterval(this.slideIntervalId);
    }
  }

  nextSlide() {
    const nextIndex = (this.currentSlideIndex() + 1) % this.sliderImages.length;
    this.setSlideIndex(nextIndex);
  }

  prevSlide() {
    const prevIndex =
      (this.currentSlideIndex() - 1 + this.sliderImages.length) % this.sliderImages.length;
    this.setSlideIndex(prevIndex);
  }

  goToSlide(index: number) {
    this.setSlideIndex(index);
  }

  selectCalculatorRoom(type: CalculatorRoomType) {
    this.calculatorRoomType.set(type);
    this.resetChecklistSelection();
    this.goToCalculatorStep(2);
  }

  selectCalculatorRenovation(type: CalculatorRenovationType) {
    this.calculatorRenovationType.set(type);
    this.calculatorSelectedPerformerIds.set([]);
    this.resetChecklistSelection();
    this.goToCalculatorStep(3);
  }

  continueCalculatorArea() {
    this.calculatorAreaTouched.set(true);
    if (!this.isCalculatorAreaValid()) {
      return;
    }
    this.ensureChecklistSelection();
    this.goToCalculatorStep(4);
  }

  continueCalculatorChecklist() {
    this.calculatorChecklistTouched.set(true);
    if (!this.calculatorChecklistReady() || this.totalSelectedWorkCount() === 0) {
      return;
    }
    this.goToCalculatorStep(5);
  }

  continueCalculatorPerformers() {
    this.goToCalculatorStep(6);
  }

  toggleChecklistItem(id: string) {
    this.calculatorChecklistSelection.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  isChecklistItemSelected(id: string): boolean {
    return this.calculatorChecklistSelection().includes(id);
  }

  selectedChecklistCount(): number {
    return this.calculatorChecklistSelection().length;
  }

  totalSelectedWorkCount(): number {
    return this.selectedChecklistCount() + this.calculatorChecklistCustomItems().length;
  }

  addCustomChecklistItem() {
    const text = this.calculatorChecklistCustomDraft().trim();
    if (text.length < 3) {
      this.calculatorChecklistCustomError.set(
        this.translation.t('home.calculator.checklistCustomTooShort'),
      );
      return;
    }

    const duplicate = this.calculatorChecklistCustomItems().some(
      (item) => item.toLowerCase() === text.toLowerCase(),
    );
    if (duplicate) {
      this.calculatorChecklistCustomError.set(
        this.translation.t('home.calculator.checklistCustomDuplicate'),
      );
      return;
    }

    this.calculatorChecklistCustomItems.update((items) => [...items, text]);
    this.calculatorChecklistCustomDraft.set('');
    this.calculatorChecklistCustomError.set(null);
  }

  removeCustomChecklistItem(text: string) {
    this.calculatorChecklistCustomItems.update((items) => items.filter((item) => item !== text));
  }

  onCustomChecklistDraftInput(value: string) {
    this.calculatorChecklistCustomDraft.set(value);
    if (this.calculatorChecklistCustomError()) {
      this.calculatorChecklistCustomError.set(null);
    }
  }

  selectAllChecklistItems() {
    const roomType = this.calculatorRoomType();
    const renovationType = this.calculatorRenovationType();
    if (!roomType || !renovationType) {
      return;
    }
    this.calculatorChecklistSelection.set(
      getAllVisibleChecklistItemIds(renovationType, roomType),
    );
  }

  selectRecommendedChecklistItems() {
    this.ensureChecklistSelection();
  }

  clearChecklistSelection() {
    this.calculatorChecklistSelection.set([]);
  }

  clearChecklistSearch() {
    this.calculatorChecklistSearchQuery.set('');
  }

  private ensureChecklistSelection() {
    const roomType = this.calculatorRoomType();
    const renovationType = this.calculatorRenovationType();
    if (!roomType || !renovationType) {
      return;
    }
    this.calculatorChecklistSelection.set([
      ...buildDefaultChecklistSelection(renovationType, roomType),
    ]);
  }

  private resetChecklistSelection() {
    this.calculatorChecklistSelection.set([]);
    this.calculatorChecklistTouched.set(false);
    this.calculatorChecklistSearchQuery.set('');
    this.calculatorChecklistCustomDraft.set('');
    this.calculatorChecklistCustomItems.set([]);
    this.calculatorChecklistCustomError.set(null);
  }

  toggleCalculatorPerformer(id: string) {
    this.calculatorSelectedPerformerIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
    this.calculatorContactForm.patchValue({ paidCallOutAccepted: false });
  }

  isCalculatorSubmitAllowed(): boolean {
    if (this.calculatorRequiresPaidCallOutConsent()) {
      return this.calculatorContactForm.get('paidCallOutAccepted')?.value === true;
    }
    return true;
  }

  formatCallOutFeeDisplay(fee: string | null | undefined): string {
    if (!fee?.trim()) {
      return this.translation.t('home.calculator.callOutNotSpecified');
    }
    return fee.trim();
  }

  calculatorRoomTypeLabel(type: CalculatorRoomType | null): string {
    if (!type) {
      return '—';
    }
    const key = `home.calculator.roomTypes.${type === 'new_build' ? 'newBuild' : type === 'secondary' ? 'secondary' : type === 'house' ? 'house' : 'commercial'}`;
    return this.translation.t(key);
  }

  calculatorRenovationTypeLabel(type: CalculatorRenovationType | null): string {
    if (!type) {
      return '—';
    }
    return this.translation.t(`home.calculator.renovationTypes.${type}`);
  }

  isCalculatorPerformerSelected(id: string): boolean {
    return this.calculatorSelectedPerformerIds().includes(id);
  }

  calculatorPerformerInitials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  goToCalculatorStep(step: number) {
    this.calculatorStep.set(step);
  }

  calculatorBack() {
    const step = this.calculatorStep();
    if (step > 1) {
      this.calculatorStep.set(step - 1);
    }
  }

  isCalculatorAreaValid(): boolean {
    const value = Number(this.calculatorArea().replace(',', '.'));
    return Number.isFinite(value) && value >= 5 && value <= 5000;
  }

  calculatorFieldInvalid(field: 'name' | 'contact'): boolean {
    const control = this.calculatorContactForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  async submitCalculatorLead() {
    if (this.calculatorSubmitted() || this.calculatorSubmitting()) {
      return;
    }

    this.calculatorContactForm.markAllAsTouched();
    if (this.calculatorContactForm.invalid || !this.isCalculatorSubmitAllowed()) {
      return;
    }

    const roomType = this.calculatorRoomType();
    const renovationType = this.calculatorRenovationType();
    if (!roomType || !renovationType || !this.isCalculatorAreaValid()) {
      return;
    }

    const { city, name, contact, photoLink, paidCallOutAccepted } =
      this.calculatorContactForm.getRawValue();
    const areaSqm = Number(this.calculatorArea().replace(',', '.'));
    const selectedIds = new Set(this.calculatorSelectedPerformerIds());
    const selectedCards = this.calculatorPerformerCards().filter((card) =>
      selectedIds.has(card.id),
    );
    const selectedPerformers = selectedCards.map((card) => ({
      id: card.id,
      pool: card.pool,
      name: card.name,
      callOutFee: card.callOutFee,
    }));
    const directedTo = selectedPerformers.map((item) => item.name).join(', ');
    const selectedCallOutFees = selectedCards
      .filter((card) => card.callOutFee)
      .map((card) => `${card.name}: ${card.callOutFee}`)
      .join('; ');
    const estimateSummary = buildChecklistScopeSummary(
      renovationType,
      roomType,
      new Set(this.calculatorChecklistSelection()),
      (key) => this.translation.t(key),
      this.calculatorChecklistCustomItems(),
    );

    this.calculatorSubmitting.set(true);
    this.calculatorSubmitError.set(null);

    this.calculatorLeadStore.addLead({
      roomType,
      renovationType,
      areaSqm,
      name,
      contact,
      photoLink,
      paidCallOutAccepted,
      selectedPerformers,
    });

    // Сопоставление полей калькулятора с колонками таблицы jobklient (snake_case).
    const jobklientPayload = buildJobklientJobInsert(
      {
        customerName: name,
        contact,
        city,
        roomTypeLabel: this.calculatorRoomTypeLabel(roomType),
        renovationTypeLabel: this.calculatorRenovationTypeLabel(renovationType),
        areaSqm,
        photoLink,
        directedTo,
        selectedCallOutFees,
        paidCallOutAccepted,
        estimateSummary,
      },
      this.jobDescriptionLabels(),
    );

    // 1) Сначала Supabase — при ошибке прерываем, Telegram не вызываем.
    const insertResult = await this.supabase.insertJobklientJobAsync(jobklientPayload);

    if (insertResult.error) {
      console.error('Полный объект ошибки Supabase:', insertResult.supabaseError ?? insertResult.error);
      console.error('[HomeComponent] jobklient insert failed:', insertResult.error);
      this.calculatorSubmitError.set(this.translation.t('home.calculator.errorText'));
      this.calculatorSubmitting.set(false);
      return;
    }

    const orderDetails = this.buildCalculatorOrderDetails({
      name,
      contact,
      city,
      roomType,
      renovationType,
      areaSqm,
      photoLink,
      directedTo,
      selectedCallOutFees,
      paidCallOutAccepted,
      estimateSummary,
    });

    this.calculatorLastOrderDetails.set(orderDetails);
    this.calculatorSubmittedExecutors.set(selectedCards);
    this.calculatorMessengerWarning.set(null);

    void this.supabase.loadActiveJobs(true);
    this.calculatorSubmitting.set(false);
    this.calculatorSubmitted.set(true);
  }

  protected openExecutorMessenger(
    messenger: 'whatsapp' | 'telegram',
    executor: CalculatorPerformerCard,
  ): void {
    const orderDetails = this.calculatorLastOrderDetails();
    if (!orderDetails) {
      return;
    }

    const opened = redirectToExecutor(messenger, executor, orderDetails);
    if (!opened) {
      const key =
        messenger === 'whatsapp'
          ? 'home.calculator.messengerMissingWhatsApp'
          : 'home.calculator.messengerMissingTelegram';
      this.calculatorMessengerWarning.set(
        this.translation.t(key).replace('{{name}}', executor.name),
      );
    }
  }

  protected executorHasMessenger(
    executor: CalculatorPerformerCard,
    messenger: 'whatsapp' | 'telegram',
  ): boolean {
    if (messenger === 'whatsapp') {
      return !!executor.whatsapp_phone?.replace(/\D/g, '');
    }
    return !!executor.tg_username?.replace(/^@/, '').trim();
  }

  private buildCalculatorOrderDetails(input: {
    name: string;
    contact: string;
    city: string;
    roomType: CalculatorRoomType;
    renovationType: CalculatorRenovationType;
    areaSqm: number;
    photoLink?: string;
    directedTo: string;
    selectedCallOutFees: string;
    paidCallOutAccepted: boolean;
    estimateSummary: string;
  }): string {
    const cityLabel = this.calculatorCityLabel(input.city);
    const lines = [
      `🎯 ${this.translation.t('home.calculator.orderMessage.directed')}: ${input.directedTo || '—'}`,
      `👤 ${this.translation.t('home.calculator.orderMessage.customer')}: ${input.name.trim()}`,
      `📞 ${this.translation.t('home.calculator.orderMessage.contact')}: ${input.contact.trim()}`,
      `🏠 ${this.translation.t('home.calculator.orderMessage.room')}: ${this.calculatorRoomTypeLabel(input.roomType)}`,
      `🔧 ${this.translation.t('home.calculator.orderMessage.renovation')}: ${this.calculatorRenovationTypeLabel(input.renovationType)}`,
      `📐 ${this.translation.t('home.calculator.orderMessage.area')}: ${input.areaSqm} m²`,
      `📍 ${this.translation.t('home.calculator.orderMessage.city')}: ${cityLabel}`,
    ];

    if (input.estimateSummary.trim()) {
      lines.push(
        `📋 ${this.translation.t('home.calculator.orderMessage.scope')}:\n${input.estimateSummary.trim()}`,
      );
    }
    if (input.photoLink?.trim()) {
      lines.push(`📷 ${this.translation.t('home.calculator.orderMessage.photo')}: ${input.photoLink.trim()}`);
    }
    if (input.selectedCallOutFees.trim()) {
      lines.push(`💰 ${this.translation.t('home.calculator.orderMessage.callOut')}: ${input.selectedCallOutFees.trim()}`);
    }
    if (input.paidCallOutAccepted) {
      lines.push(`✅ ${this.translation.t('home.calculator.paidCallOutConsent')}`);
    }

    return lines.join('\n');
  }

  private jobDescriptionLabels(): JobDescriptionLabels {
    return {
      customer: this.translation.t('jobs.fields.customer'),
      contact: this.translation.t('jobs.fields.contact'),
      area: this.translation.t('jobs.fields.area'),
      photo: this.translation.t('jobs.fields.photo'),
      directedTo: this.translation.t('jobs.fields.directedTo'),
      callOut: this.translation.t('jobs.fields.callOut'),
      paidCallOutYes: this.translation.t('jobs.fields.paidCallOutYes'),
      estimate: this.translation.t('jobs.fields.estimate'),
      estimateTotal: this.translation.t('jobs.fields.estimateTotal'),
    };
  }

  private calculatorCityLabel(city: string): string {
    const option = this.calculatorCityOptions.find((item) => item.id === city);
    return option ? this.translation.t(option.labelKey) : this.translation.t('home.calculator.cities.both');
  }

  resetCalculator() {
    this.calculatorSubmitted.set(false);
    this.calculatorSubmitting.set(false);
    this.calculatorSubmitError.set(null);
    this.calculatorLastOrderDetails.set('');
    this.calculatorSubmittedExecutors.set([]);
    this.calculatorMessengerWarning.set(null);
    this.calculatorStep.set(1);
    this.calculatorRoomType.set(null);
    this.calculatorRenovationType.set(null);
    this.calculatorArea.set('');
    this.calculatorAreaTouched.set(false);
    this.calculatorSelectedPerformerIds.set([]);
    this.resetChecklistSelection();
    this.calculatorContactForm.reset({ city: 'batumi' });
  }

  private mapPerformerCard(
    performer: PerformerProfile,
    pool: Extract<CalculatorPerformerPool, 'brigade' | 'worker'>,
  ): CalculatorPerformerCard {
    const callOutFee = performer.callOutFee ?? null;

    return {
      id: performer.id,
      pool,
      name: performer.name,
      avatarUrl: performer.avatarUrl,
      city: this.translation.t('home.calculator.defaultCity'),
      experience: this.formatCalculatorExperience(performer.works.length),
      callOutFee,
      callOutPaid: isPaidCallOutFee(callOutFee),
      whatsapp_phone: performer.whatsapp_phone ?? performer.socialLinks?.whatsapp ?? null,
      tg_username: performer.tg_username ?? performer.socialLinks?.telegram ?? null,
    };
  }

  private formatCalculatorExperience(worksCount: number): string {
    return this.translation
      .t('home.calculator.experienceProjects')
      .replace('{{count}}', String(worksCount));
  }

  private setSlideIndex(index: number) {
    this.currentSlideIndex.set(index);
    this.currentSlide.set(this.sliderImages[index]);
    this.resolveSlideTone(index);
  }

  private resolveSlideTone(index: number) {
    const cached = this.slideToneCache.get(index);
    if (cached) {
      this.slideTone.set(cached);
      return;
    }

    if (!isPlatformBrowser(this.platformId)) {
      this.slideTone.set('dark');
      return;
    }

    this.analyzeSlideTone(index);
  }

  private analyzeSlideTone(index: number) {
    const url = this.sliderImages[index];
    if (!url) {
      return;
    }

    const img = new Image();
    img.onload = () => {
      const tone = this.measureImageTone(img);
      this.slideToneCache.set(index, tone);
      if (this.currentSlideIndex() === index) {
        this.slideTone.set(tone);
      }
    };
    img.onerror = () => {
      this.slideToneCache.set(index, 'dark');
      if (this.currentSlideIndex() === index) {
        this.slideTone.set('dark');
      }
    };
    img.src = url;
  }

  private measureImageTone(img: HTMLImageElement): 'light' | 'dark' {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx || img.naturalWidth === 0) {
      return 'dark';
    }

    const sampleSize = 48;
    canvas.width = sampleSize;
    canvas.height = sampleSize;

    const sx = img.naturalWidth * 0.2;
    const sy = img.naturalHeight * 0.2;
    const sw = img.naturalWidth * 0.6;
    const sh = img.naturalHeight * 0.6;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

    const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);
    let sum = 0;
    const pixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    }

    return sum / pixels >= 128 ? 'light' : 'dark';
  }
}
