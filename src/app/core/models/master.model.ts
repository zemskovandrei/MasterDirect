export type MasterAccountType = 'worker' | 'brigade';

export interface MasterRow {
  id: string;
  full_name: string;
  phone: string | null;
  city: string | null;
  specialty: string | null;
  description: string | null;
  account_type: MasterAccountType | null;
  call_out_fee: string | null;
  whatsapp: string | null;
  telegram: string | null;
  instagram: string | null;
  facebook: string | null;
  created_at?: string;
}

export interface ReviewRow {
  id: string;
  master_id: string | null;
  client_name: string;
  review_text: string;
  rating: number | null;
  kind: string | null;
  performer_type: string | null;
  performer_type_key: string | null;
  performer_name: string | null;
  before_image: string | null;
  after_image: string | null;
  is_approved: boolean;
  created_at: string;
}

export interface AuthSignUpMetadata {
  full_name: string;
  phone?: string;
  city?: string;
  specialty?: string;
  description?: string;
  account_type?: MasterAccountType;
  call_out_fee?: string;
  whatsapp?: string;
  telegram?: string;
  instagram?: string;
  facebook?: string;
}
