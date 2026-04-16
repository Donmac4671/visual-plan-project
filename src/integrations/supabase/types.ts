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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_applications: {
        Row: {
          admin_notes: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          location: string
          phone: string
          reason: string
          screenshot_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          location?: string
          phone: string
          reason?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          location?: string
          phone?: string
          reason?: string
          screenshot_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          media_url: string | null
          message: string
          sender_role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message: string
          sender_role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          media_url?: string | null
          message?: string
          sender_role?: string
          user_id?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          admin_reply: string | null
          created_at: string
          id: string
          message: string
          order_id: string | null
          order_ref: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          order_ref?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          order_ref?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_bundles: {
        Row: {
          agent_price: number
          bundle_size: string
          created_at: string
          general_price: number
          id: string
          network_id: string
          size_gb: number
        }
        Insert: {
          agent_price: number
          bundle_size: string
          created_at?: string
          general_price: number
          id?: string
          network_id: string
          size_gb: number
        }
        Update: {
          agent_price?: number
          bundle_size?: string
          created_at?: string
          general_price?: number
          id?: string
          network_id?: string
          size_gb?: number
        }
        Relationships: []
      }
      hidden_bundles: {
        Row: {
          bundle_size: string
          created_at: string
          id: string
          network_id: string
        }
        Insert: {
          bundle_size: string
          created_at?: string
          id?: string
          network_id: string
        }
        Update: {
          bundle_size?: string
          created_at?: string
          id?: string
          network_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          bundle_size: string
          created_at: string
          gh_reference: string | null
          id: string
          network: string
          order_ref: string
          payment_method: string
          phone_number: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          bundle_size: string
          created_at?: string
          gh_reference?: string | null
          id?: string
          network: string
          order_ref: string
          payment_method?: string
          phone_number: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          bundle_size?: string
          created_at?: string
          gh_reference?: string | null
          id?: string
          network?: string
          order_ref?: string
          payment_method?: string
          phone_number?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agent_code: string
          created_at: string
          email: string
          full_name: string
          id: string
          is_blocked: boolean
          phone: string
          referral_code: string
          tier: string
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          agent_code?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_blocked?: boolean
          phone?: string
          referral_code?: string
          tier?: string
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          agent_code?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_blocked?: boolean
          phone?: string
          referral_code?: string
          tier?: string
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      promotions: {
        Row: {
          created_at: string
          description: string
          discount_percent: number
          expires_at: string
          id: string
          is_active: boolean
          starts_at: string
          target_audience: string
        }
        Insert: {
          created_at?: string
          description?: string
          discount_percent: number
          expires_at: string
          id?: string
          is_active?: boolean
          starts_at?: string
          target_audience?: string
        }
        Update: {
          created_at?: string
          description?: string
          discount_percent?: number
          expires_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          target_audience?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount: number
          reward_paid: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          reward_amount?: number
          reward_paid?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number
          reward_paid?: boolean
        }
        Relationships: []
      }
      site_messages: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_bot_state: {
        Row: {
          id: number
          update_offset: number
          updated_at: string
        }
        Insert: {
          id: number
          update_offset?: number
          updated_at?: string
        }
        Update: {
          id?: number
          update_offset?: number
          updated_at?: string
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          created_at: string
          processed: boolean
          raw_update: Json
          text: string | null
          update_id: number
        }
        Insert: {
          chat_id: number
          created_at?: string
          processed?: boolean
          raw_update: Json
          text?: string | null
          update_id: number
        }
        Update: {
          chat_id?: number
          created_at?: string
          processed?: boolean
          raw_update?: Json
          text?: string | null
          update_id?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verified_topups: {
        Row: {
          amount: number
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          id: string
          is_claimed: boolean
          network: string
          transaction_id: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          network: string
          transaction_id: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          id?: string
          is_claimed?: boolean
          network?: string
          transaction_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          paystack_reference: string | null
          screenshot_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          method: string
          paystack_reference?: string | null
          screenshot_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          paystack_reference?: string | null
          screenshot_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_tier: {
        Args: { new_tier: string; target_user_id: string }
        Returns: undefined
      }
      admin_toggle_admin_role: {
        Args: { make_admin: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_toggle_block: {
        Args: { block_status: boolean; target_user_id: string }
        Returns: undefined
      }
      admin_update_order_status: {
        Args: { new_status: string; order_id: string }
        Returns: undefined
      }
      admin_wallet_operation: {
        Args: {
          operation_amount: number
          operation_description?: string
          operation_type: string
          target_user_id: string
        }
        Returns: undefined
      }
      claim_verified_topup: {
        Args: { p_transaction_id: string }
        Returns: undefined
      }
      complete_paystack_topup: {
        Args: { p_amount: number; p_reference: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_order_ref: { Args: never; Returns: string }
      pay_order_with_paystack: {
        Args: {
          p_amount: number
          p_bundle: string
          p_network: string
          p_phone: string
          p_reference: string
        }
        Returns: string
      }
      pay_with_wallet: {
        Args: {
          p_amount: number
          p_bundle: string
          p_network: string
          p_phone: string
        }
        Returns: string
      }
      process_pending_orders: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
