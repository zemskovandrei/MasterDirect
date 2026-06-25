export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      deals: {
        Row: {
          client_confirmed: boolean | null
          client_id: string | null
          created_at: string | null
          id: string
          master_confirmed: boolean | null
          master_id: string | null
          status: string | null
        }
        Insert: {
          client_confirmed?: boolean | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          master_confirmed?: boolean | null
          master_id?: string | null
          status?: string | null
        }
        Update: {
          client_confirmed?: boolean | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          master_confirmed?: boolean | null
          master_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "specialist"
            referencedColumns: ["id"]
          },
        ]
      }
      order: {
        Row: {
          budget: number | null
          category: string | null
          city: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          description: string | null
          id: number
          status: string | null
          title: string | null
          user_id: string | null
        }
        Insert: {
          budget?: number | null
          category?: string | null
          city?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Update: {
          budget?: number | null
          category?: string | null
          city?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          status?: string | null
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "specialist"
            referencedColumns: ["id"]
          },
        ]
      }
      order_files: {
        Row: {
          created_at: string | null
          file_path: string
          id: string
          order_id: number | null
        }
        Insert: {
          created_at?: string | null
          file_path: string
          id?: string
          order_id?: number | null
        }
        Update: {
          created_at?: string | null
          file_path?: string
          id?: string
          order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_files_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
        ]
      }
      order_leads: {
        Row: {
          cost: number | null
          id: string
          master_id: string | null
          order_id: number | null
          purchase_date: string | null
        }
        Insert: {
          cost?: number | null
          id?: string
          master_id?: string | null
          order_id?: number | null
          purchase_date?: string | null
        }
        Update: {
          cost?: number | null
          id?: string
          master_id?: string | null
          order_id?: number | null
          purchase_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_leads_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "specialist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_leads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_works: {
        Row: {
          after_image_url: string
          before_image_url: string
          created_at: string
          description: string | null
          id: string
          owner_id: string | null
          owner_type: string | null
          status: string | null
        }
        Insert: {
          after_image_url: string
          before_image_url: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string | null
          status?: string | null
        }
        Update: {
          after_image_url?: string
          before_image_url?: string
          created_at?: string
          description?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string | null
          status?: string | null
        }
        Relationships: []
      }
      site_reviews: {
        Row: {
          created_at: string | null
          id: string
          is_approved: boolean | null
          review_text: string | null
          role: string | null
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          review_text?: string | null
          role?: string | null
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          review_text?: string | null
          role?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      specialist: {
        Row: {
          account_type: string | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          current_active_orders: number | null
          facebook: string | null
          id: string
          instagram: string | null
          is_archive: boolean | null
          is_pro: boolean | null
          is_verified: boolean | null
          max_active_orders: number | null
          name: string | null
          orders_count: number | null
          phone: string | null
          role: string | null
          skills: string[] | null
          slug: string | null
          surname: string | null
          tg_username: string | null
          whatsapp_phone: string | null
        }
        Insert: {
          account_type?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          current_active_orders?: number | null
          facebook?: string | null
          id: string
          instagram?: string | null
          is_archive?: boolean | null
          is_pro?: boolean | null
          is_verified?: boolean | null
          max_active_orders?: number | null
          name?: string | null
          orders_count?: number | null
          phone?: string | null
          role?: string | null
          skills?: string[] | null
          slug?: string | null
          surname?: string | null
          tg_username?: string | null
          whatsapp_phone?: string | null
        }
        Update: {
          account_type?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          current_active_orders?: number | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          is_archive?: boolean | null
          is_pro?: boolean | null
          is_verified?: boolean | null
          max_active_orders?: number | null
          name?: string | null
          orders_count?: number | null
          phone?: string | null
          role?: string | null
          skills?: string[] | null
          slug?: string | null
          surname?: string | null
          tg_username?: string | null
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          master_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          master_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          master_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "specialist"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          id: string
          master_id: string | null
          status: string | null
          user_email: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          master_id?: string | null
          status?: string | null
          user_email: string
        }
        Update: {
          created_at?: string | null
          id?: string
          master_id?: string | null
          status?: string | null
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_master_id_fkey"
            columns: ["master_id"]
            isOneToOne: false
            referencedRelation: "specialist"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          after_image_url: string
          before_image_url: string
          client_contact: string | null
          created_at: string | null
          description: string | null
          id: string
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          after_image_url: string
          before_image_url: string
          client_contact?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          after_image_url?: string
          before_image_url?: string
          client_contact?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_specialist_with_evidence: {
        Args: { admin_email: string; target_id: string }
        Returns: undefined
      }
      increment_master_orders: {
        Args: { p_master_id: string }
        Returns: boolean
      }
      purchase_order_lead: {
        Args: { p_cost: number; p_order_id: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
