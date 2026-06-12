import {
  CalculatorRenovationType,
  CalculatorRoomType,
} from '../models/calculator.models';

export type RenovationChecklistPhaseId =
  | 'preparation'
  | 'geometry'
  | 'engineering_rough'
  | 'floor'
  | 'prefinish'
  | 'finish'
  | 'engineering_finish'
  | 'furnishing'
  | 'handyman'
  | 'handover';

export interface RenovationChecklistPhase {
  id: RenovationChecklistPhaseId;
  order: number;
  titleKey: string;
}

export interface RenovationChecklistItemDef {
  id: string;
  phaseId: RenovationChecklistPhaseId;
  labelKey: string;
  /** Renovation types where this item is shown and selected by default */
  defaultFor: CalculatorRenovationType[];
  /** Hide completely for these renovation types */
  hideFor?: CalculatorRenovationType[];
  excludeRoomTypes?: CalculatorRoomType[];
}

export const RENOVATION_CHECKLIST_PHASES: RenovationChecklistPhase[] = [
  { id: 'preparation', order: 1, titleKey: 'home.calculator.checklist.phases.preparation' },
  { id: 'geometry', order: 2, titleKey: 'home.calculator.checklist.phases.geometry' },
  { id: 'engineering_rough', order: 3, titleKey: 'home.calculator.checklist.phases.engineeringRough' },
  { id: 'floor', order: 4, titleKey: 'home.calculator.checklist.phases.floor' },
  { id: 'prefinish', order: 5, titleKey: 'home.calculator.checklist.phases.prefinish' },
  { id: 'finish', order: 6, titleKey: 'home.calculator.checklist.phases.finish' },
  { id: 'engineering_finish', order: 7, titleKey: 'home.calculator.checklist.phases.engineeringFinish' },
  { id: 'furnishing', order: 8, titleKey: 'home.calculator.checklist.phases.furnishing' },
  { id: 'handyman', order: 9, titleKey: 'home.calculator.checklist.phases.handyman' },
  { id: 'handover', order: 10, titleKey: 'home.calculator.checklist.phases.handover' },
];

const ALL_RENO_TYPES: CalculatorRenovationType[] = ['cosmetic', 'capital', 'design', 'furniture'];
const TURNKEY_TYPES: CalculatorRenovationType[] = ['capital', 'design'];
const FINISH_TYPES: CalculatorRenovationType[] = ['cosmetic', 'capital', 'design'];

export const RENOVATION_CHECKLIST_ITEMS: RenovationChecklistItemDef[] = [
  // 1. Подготовка
  { id: 'design_docs', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.designDocs', defaultFor: ['design'], hideFor: ['furniture'] },
  { id: 'contract_schedule', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.contractSchedule', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'replanning_approval', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.replanningApproval', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'protection_materials', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.protectionMaterials', defaultFor: ALL_RENO_TYPES },
  { id: 'common_areas_protection', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.commonAreasProtection', defaultFor: ALL_RENO_TYPES, excludeRoomTypes: ['house'] },
  { id: 'temp_toilet', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.tempToilet', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'temp_light_power', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.tempLightPower', defaultFor: ALL_RENO_TYPES },
  { id: 'noise_schedule', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.noiseSchedule', defaultFor: ALL_RENO_TYPES, excludeRoomTypes: ['house', 'commercial'] },
  { id: 'partition_demolition', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.partitionDemolition', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'developer_elements_removal', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.developerElementsRemoval', defaultFor: ['capital', 'design', 'cosmetic'], hideFor: ['furniture'], excludeRoomTypes: ['house'] },
  { id: 'waste_removal', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.wasteRemoval', defaultFor: ALL_RENO_TYPES },
  { id: 'site_insurance', phaseId: 'preparation', labelKey: 'home.calculator.checklist.items.siteInsurance', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },

  // 2. Геометрия
  { id: 'wall_layout', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.wallLayout', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'primer_partitions', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.primerPartitions', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'damper_tape_guides', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.damperTapeGuides', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'partition_walls', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.partitionWalls', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'wall_reinforcement', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.wallReinforcement', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'door_openings', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.doorOpenings', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'laser_level_check', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.laserLevelCheck', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'concrete_contact_primer', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.concreteContactPrimer', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'plaster_beacons', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.plasterBeacons', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'wall_plaster', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.wallPlaster', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'beacon_removal', phaseId: 'geometry', labelKey: 'home.calculator.checklist.items.beaconRemoval', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },

  // 3. Черновая инженерия
  { id: 'electrical_layout', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.electricalLayout', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'electrical_chasing', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.electricalChasing', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'cables_in_conduit', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.cablesInConduit', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'socket_boxes', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.socketBoxes', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'junction_boxes', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.junctionBoxes', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'power_panel', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.powerPanel', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'low_voltage_panel', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.lowVoltagePanel', defaultFor: ['design', 'capital'], hideFor: ['furniture'] },
  { id: 'plumbing_layout', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.plumbingLayout', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'plumbing_chasing', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.plumbingChasing', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'collector_unit', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.collectorUnit', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'water_pipes', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.waterPipes', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'sewage_pipes', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.sewagePipes', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'toilet_installation_frame', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.toiletInstallationFrame', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'built_in_mixer_boxes', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.builtInMixerBoxes', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'pressure_test', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.pressureTest', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'leak_protection', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.leakProtection', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'ac_lines', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.acLines', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'heating_pipes_walls', phaseId: 'engineering_rough', labelKey: 'home.calculator.checklist.items.heatingPipesWalls', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },

  // 4. Пол
  { id: 'slab_cleaning', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.slabCleaning', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'pipe_joint_seal', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.pipeJointSeal', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'floor_insulation', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.floorInsulation', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'underfloor_heating', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.underfloorHeating', defaultFor: ['capital', 'design'], hideFor: ['furniture'] },
  { id: 'perimeter_damper', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.perimeterDamper', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'screed_beacons', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.screedBeacons', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'screed_pour', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.screedPour', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },
  { id: 'screed_grind', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.screedGrind', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'screed_curing', phaseId: 'floor', labelKey: 'home.calculator.checklist.items.screedCuring', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },

  // 5. Предчистовая
  { id: 'wall_priming', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.wallPriming', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'ceiling_frame', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.ceilingFrame', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'ceiling_insulation', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.ceilingInsulation', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'ceiling_drywall', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.ceilingDrywall', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'base_putty', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.basePutty', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'drywall_joints', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.drywallJoints', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'fiberglass_mesh', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.fiberglassMesh', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'finish_putty_layers', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.finishPuttyLayers', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'wall_sanding', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.wallSanding', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'final_primer', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.finalPrimer', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'wet_area_waterproof', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.wetAreaWaterproof', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'waterproof_tape_corners', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.waterproofTapeCorners', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'antiseptic_wet_zones', phaseId: 'prefinish', labelKey: 'home.calculator.checklist.items.antisepticWetZones', defaultFor: TURNKEY_TYPES, hideFor: ['furniture'] },

  // 6. Чистовая
  { id: 'tile_sorting', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.tileSorting', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'tile_miter_45', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.tileMiter45', defaultFor: ['capital', 'design'], hideFor: ['furniture'] },
  { id: 'tile_install', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.tileInstall', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'tile_joint_clean', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.tileJointClean', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'tile_grout', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.tileGrout', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'ceiling_paint', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.ceilingPaint', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'stretch_ceiling', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.stretchCeiling', defaultFor: ['cosmetic', 'capital'], hideFor: ['furniture'] },
  { id: 'wall_paint_wallpaper', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.wallPaintWallpaper', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'floor_clean_before_cover', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.floorCleanBeforeCover', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'floor_underlay', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.floorUnderlay', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'floor_cover_install', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.floorCoverInstall', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'floor_cardboard_protect', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.floorCardboardProtect', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'skirting_boards', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.skirtingBoards', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'interior_doors', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.interiorDoors', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'entrance_door_trim', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.entranceDoorTrim', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'window_adjustment', phaseId: 'finish', labelKey: 'home.calculator.checklist.items.windowAdjustment', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },

  // 7. Финишная инженерия
  { id: 'switches_sockets', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.switchesSockets', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'lighting_install', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.lightingInstall', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'bathtub_shower_tray', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.bathtubShowerTray', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'silicone_seal_wet', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.siliconeSealWet', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'wall_hung_toilet', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.wallHungToilet', defaultFor: TURNKEY_TYPES, hideFor: ['cosmetic', 'furniture'] },
  { id: 'sink_vanity_mirror', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.sinkVanityMirror', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'faucets_shower', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.faucetsShower', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'towel_radiator', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.towelRadiator', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'exhaust_fans', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.exhaustFans', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'ac_indoor_units', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.acIndoorUnits', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'intercom_doorbell', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.intercomDoorbell', defaultFor: FINISH_TYPES, hideFor: ['furniture'] },
  { id: 'smart_home_setup', phaseId: 'engineering_finish', labelKey: 'home.calculator.checklist.items.smartHomeSetup', defaultFor: ['design'], hideFor: ['furniture'] },

  // 8. Мебель и техника
  { id: 'kitchen_cabinets', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.kitchenCabinets', defaultFor: ['furniture', 'capital', 'design'] },
  { id: 'countertop_backsplash', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.countertopBacksplash', defaultFor: ['furniture', 'capital', 'design'] },
  { id: 'built_in_appliances', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.builtInAppliances', defaultFor: ['furniture', 'capital', 'design'] },
  { id: 'kitchen_facades', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.kitchenFacades', defaultFor: ['furniture', 'capital', 'design'] },
  { id: 'kitchen_sink_plumbing', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.kitchenSinkPlumbing', defaultFor: ['furniture', 'capital', 'design'] },
  { id: 'dishwasher_washer', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.dishwasherWasher', defaultFor: ['furniture', 'capital', 'design'] },
  { id: 'wardrobe_systems', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.wardrobeSystems', defaultFor: ['furniture', 'design'] },
  { id: 'soft_furniture', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.softFurniture', defaultFor: ['furniture', 'design'] },
  { id: 'dining_set', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.diningSet', defaultFor: ['furniture', 'design'] },
  { id: 'curtain_rods', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.curtainRods', defaultFor: ALL_RENO_TYPES },
  { id: 'mirrors_art_hooks', phaseId: 'furnishing', labelKey: 'home.calculator.checklist.items.mirrorsArtHooks', defaultFor: ALL_RENO_TYPES },

  // 9. Мелкая навеска («Муж на час»)
  { id: 'toilet_paper_holder', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.toiletPaperHolder', defaultFor: [] },
  { id: 'toilet_brush_mount', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.toiletBrushMount', defaultFor: [] },
  { id: 'robe_towel_hooks', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.robeTowelHooks', defaultFor: [] },
  { id: 'shower_shelves', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.showerShelves', defaultFor: [] },
  { id: 'soap_dispensers', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.soapDispensers', defaultFor: [] },
  { id: 'hair_dryer_holder', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.hairDryerHolder', defaultFor: [] },
  { id: 'makeup_mirror', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.makeupMirror', defaultFor: [] },
  { id: 'shoe_horn_key_holder', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.shoeHornKeyHolder', defaultFor: [] },
  { id: 'wall_clock', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.wallClock', defaultFor: [] },
  { id: 'tv_bracket_mount', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.tvBracketMount', defaultFor: [] },
  { id: 'tv_hang_cables', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.tvHangCables', defaultFor: [] },
  { id: 'small_book_shelves', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.smallBookShelves', defaultFor: [] },
  { id: 'pictures_posters_photos', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.picturesPostersPhotos', defaultFor: [] },
  { id: 'magnetic_knife_board', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.magneticKnifeBoard', defaultFor: [] },
  { id: 'paper_towel_holder', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.paperTowelHolder', defaultFor: [] },
  { id: 'kitchen_utensil_rails', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.kitchenUtensilRails', defaultFor: [] },
  { id: 'door_stops', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.doorStops', defaultFor: [] },
  { id: 'hanging_planters', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.hangingPlanters', defaultFor: [] },
  { id: 'cat_mesh_windows', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.catMeshWindows', defaultFor: [] },
  { id: 'furniture_felt_pads', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.furnitureFeltPads', defaultFor: [] },
  { id: 'desk_cable_management', phaseId: 'handyman', labelKey: 'home.calculator.checklist.items.deskCableManagement', defaultFor: [] },

  // 10. Сдача
  { id: 'tools_removal', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.toolsRemoval', defaultFor: ALL_RENO_TYPES },
  { id: 'post_construction_cleaning', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.postConstructionCleaning', defaultFor: ALL_RENO_TYPES },
  { id: 'curtains_hanging', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.curtainsHanging', defaultFor: ALL_RENO_TYPES },
  { id: 'systems_commissioning', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.systemsCommissioning', defaultFor: ALL_RENO_TYPES },
  { id: 'acceptance_act', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.acceptanceAct', defaultFor: ALL_RENO_TYPES },
  { id: 'packaging_removal', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.packagingRemoval', defaultFor: ALL_RENO_TYPES },
  { id: 'final_walkthrough', phaseId: 'handover', labelKey: 'home.calculator.checklist.items.finalWalkthrough', defaultFor: ALL_RENO_TYPES },
];
