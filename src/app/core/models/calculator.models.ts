export type CalculatorRoomType = 'new_build' | 'secondary' | 'house' | 'commercial';

export type CalculatorRenovationType = 'cosmetic' | 'capital' | 'design' | 'furniture';

export type CalculatorPerformerPool = 'brigade' | 'worker' | 'furniture';

export interface CalculatorPerformerCard {
  id: string;
  pool: CalculatorPerformerPool;
  name: string;
  avatarUrl?: string;
  city: string;
  experience: string;
}

export interface CalculatorSelectedPerformer {
  id: string;
  pool: CalculatorPerformerPool;
  name: string;
}

export interface CalculatorLeadSubmission {
  id: string;
  roomType: CalculatorRoomType;
  renovationType: CalculatorRenovationType;
  areaSqm: number;
  name: string;
  contact: string;
  selectedPerformers: CalculatorSelectedPerformer[];
  createdAt: string;
}

export interface CalculatorTelegramPayload {
  directedTo: string;
  name: string;
  contact: string;
  roomType: CalculatorRoomType;
  renovationType: CalculatorRenovationType;
  areaSqm: number;
}
