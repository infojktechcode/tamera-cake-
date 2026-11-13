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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_dates: {
        Row: {
          created_at: string
          date: string
          id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      cake_details: {
        Row: {
          allergies: string | null
          cake_message: string | null
          created_at: string
          design_description: string | null
          design_tier_id: string | null
          design_tier_name: string
          flavour_id: string | null
          flavour_name: string
          id: string
          order_item_id: string
          reference_photos: string[]
          size_kg: number
        }
        Insert: {
          allergies?: string | null
          cake_message?: string | null
          created_at?: string
          design_description?: string | null
          design_tier_id?: string | null
          design_tier_name: string
          flavour_id?: string | null
          flavour_name: string
          id?: string
          order_item_id: string
          reference_photos?: string[]
          size_kg: number
        }
        Update: {
          allergies?: string | null
          cake_message?: string | null
          created_at?: string
          design_description?: string | null
          design_tier_id?: string | null
          design_tier_name?: string
          flavour_id?: string | null
          flavour_name?: string
          id?: string
          order_item_id?: string
          reference_photos?: string[]
          size_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "cake_details_design_tier_id_fkey"
            columns: ["design_tier_id"]
            isOneToOne: false
            referencedRelation: "design_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cake_details_flavour_id_fkey"
            columns: ["flavour_id"]
            isOneToOne: false
            referencedRelation: "cake_flavours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cake_details_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cake_flavours: {
        Row: {
          available: boolean
          created_at: string
          id: string
          image_url: string | null
          name: string
          price_per_kg: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          price_per_kg: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          price_per_kg?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      cake_sizes: {
        Row: {
          available: boolean
          created_at: string
          id: string
          kg: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: string
          kg: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: string
          kg?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          kind: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          consent: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string
          source: string | null
          updated_at: string
        }
        Insert: {
          consent?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          consent?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          active: boolean
          created_at: string
          fee: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          fee?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          fee?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      design_tiers: {
        Row: {
          created_at: string
          description: string | null
          extra_fee: number
          id: string
          name: string
          requires_quote: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          extra_fee?: number
          id?: string
          name: string
          requires_quote?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          extra_fee?: number
          id?: string
          name?: string
          requires_quote?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          recorded_by: string | null
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          recorded_by?: string | null
          spent_on?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          recorded_by?: string | null
          spent_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_outbox: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          error_message: string | null
          id: string
          idempotency_key: string
          max_attempts: number
          message: string
          order_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          template: string
          to_phone: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key: string
          max_attempts?: number
          message: string
          order_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template: string
          to_phone: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          idempotency_key?: string
          max_attempts?: number
          message?: string
          order_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          template?: string
          to_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_balance"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          name: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid: number
          checkout_request_id: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          date_needed: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_zone_id: string | null
          deposit_required: number
          fulfilment: Database["public"]["Enums"]["fulfilment"]
          id: string
          idempotency_hash: string | null
          idempotency_key: string | null
          merchant_request_id: string | null
          notes: string | null
          order_number: string
          price_needs_quote: boolean
          public_token: string
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          time_needed: string | null
          total: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          checkout_request_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date_needed?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          deposit_required?: number
          fulfilment?: Database["public"]["Enums"]["fulfilment"]
          id?: string
          idempotency_hash?: string | null
          idempotency_key?: string | null
          merchant_request_id?: string | null
          notes?: string | null
          order_number: string
          price_needs_quote?: boolean
          public_token?: string
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          time_needed?: string | null
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          checkout_request_id?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          date_needed?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_zone_id?: string | null
          deposit_required?: number
          fulfilment?: Database["public"]["Enums"]["fulfilment"]
          id?: string
          idempotency_hash?: string | null
          idempotency_key?: string | null
          merchant_request_id?: string | null
          notes?: string | null
          order_number?: string
          price_needs_quote?: boolean
          public_token?: string
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          time_needed?: string | null
          total?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          callback_payload: Json | null
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          method: Database["public"]["Enums"]["pay_method"]
          mpesa_receipt_number: string | null
          order_id: string
          paid_at: string
          payment_status: Database["public"]["Enums"]["payment_attempt_status"]
          phone_number: string | null
          reason: string | null
          recorded_by: string | null
          reference_code: string | null
        }
        Insert: {
          amount: number
          callback_payload?: Json | null
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          method: Database["public"]["Enums"]["pay_method"]
          mpesa_receipt_number?: string | null
          order_id: string
          paid_at?: string
          payment_status?: Database["public"]["Enums"]["payment_attempt_status"]
          phone_number?: string | null
          reason?: string | null
          recorded_by?: string | null
          reference_code?: string | null
        }
        Update: {
          amount?: number
          callback_payload?: Json | null
          checkout_request_id?: string | null
          created_at?: string
          id?: string
          merchant_request_id?: string | null
          method?: Database["public"]["Enums"]["pay_method"]
          mpesa_receipt_number?: string | null
          order_id?: string
          paid_at?: string
          payment_status?: Database["public"]["Enums"]["payment_attempt_status"]
          phone_number?: string | null
          reason?: string | null
          recorded_by?: string | null
          reference_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost_price: number
          product_id: string
        }
        Insert: {
          cost_price?: number
          product_id: string
        }
        Update: {
          cost_price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          low_stock_level: number
          name: string
          price: number
          slug: string
          sort_order: number
          stock_qty: number
          track_stock: boolean
          updated_at: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_level?: number
          name: string
          price?: number
          slug: string
          sort_order?: number
          stock_qty?: number
          track_stock?: boolean
          updated_at?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_level?: number
          name?: string
          price?: number
          slug?: string
          sort_order?: number
          stock_qty?: number
          track_stock?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          address: string | null
          brand_colours: Json
          cancellation_policy: string | null
          daily_cake_limit: number
          delivery_policy: string | null
          deposit_percent: number
          deposit_threshold_kg: number
          faq_items: Json
          id: number
          logo_url: string | null
          message_templates: Json
          min_lead_days: number
          opening_hours: Json
          payment_details: string | null
          payment_policy: string | null
          shop_name: string
          sms_enabled: boolean
          sms_provider: string
          social_links: Json
          updated_at: string
          whatsapp_number: string
        }
        Insert: {
          address?: string | null
          brand_colours?: Json
          cancellation_policy?: string | null
          daily_cake_limit?: number
          delivery_policy?: string | null
          deposit_percent?: number
          deposit_threshold_kg?: number
          faq_items?: Json
          id?: number
          logo_url?: string | null
          message_templates?: Json
          min_lead_days?: number
          opening_hours?: Json
          payment_details?: string | null
          payment_policy?: string | null
          shop_name?: string
          sms_enabled?: boolean
          sms_provider?: string
          social_links?: Json
          updated_at?: string
          whatsapp_number: string
        }
        Update: {
          address?: string | null
          brand_colours?: Json
          cancellation_policy?: string | null
          daily_cake_limit?: number
          delivery_policy?: string | null
          deposit_percent?: number
          deposit_threshold_kg?: number
          faq_items?: Json
          id?: number
          logo_url?: string | null
          message_templates?: Json
          min_lead_days?: number
          opening_hours?: Json
          payment_details?: string | null
          payment_policy?: string | null
          shop_name?: string
          sms_enabled?: boolean
          sms_provider?: string
          social_links?: Json
          updated_at?: string
          whatsapp_number?: string
        }
        Relationships: []
      }
    }
    Views: {
      orders_balance: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          id: string | null
          total: number | null
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: never
          id?: string | null
          total?: number | null
        }
        Update: {
          amount_paid?: number | null
          balance_due?: never
          id?: string | null
          total?: number | null
        }
        Relationships: []
      }
      sales_daily: {
        Row: {
          day: string | null
          order_count: number | null
          sales: number | null
        }
        Relationships: []
      }
      sales_daily_profit: {
        Row: {
          cost_placeholder: number | null
          day: string | null
          profit_placeholder: number | null
          revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cake_load_for_date: { Args: { d: string }; Returns: number }
      create_mpesa_payment_attempt: {
        Args: {
          p_amount: number
          p_checkout_request_id: string
          p_merchant_request_id: string
          p_order_id: string
          p_phone_number: string
        }
        Returns: {
          amount: number
          callback_payload: Json | null
          checkout_request_id: string | null
          created_at: string
          id: string
          merchant_request_id: string | null
          method: Database["public"]["Enums"]["pay_method"]
          mpesa_receipt_number: string | null
          order_id: string
          paid_at: string
          payment_status: Database["public"]["Enums"]["payment_attempt_status"]
          phone_number: string | null
          reason: string | null
          recorded_by: string | null
          reference_code: string | null
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_public_order: {
        Args: {
          p_customer: Json
          p_date_needed: string
          p_idempotency_key: string
          p_lines: Json
          p_order: Json
          p_request_hash: string
        }
        Returns: Json
      }
      is_staff: { Args: never; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
      lookup_public_order_by_idempotency: {
        Args: { p_idempotency_key: string; p_request_hash: string }
        Returns: Json
      }
      next_order_number: { Args: never; Returns: string }
      process_mpesa_callback: {
        Args: {
          p_amount_received: number
          p_callback_payload: Json
          p_checkout_request_id: string
          p_merchant_request_id: string
          p_mpesa_receipt_number: string
          p_result_code: number
          p_result_desc: string
        }
        Returns: Json
      }
      verify_legacy_public_order_retry: {
        Args: { p_idempotency_key: string; p_request_hash: string }
        Returns: Json
      }
    }
    Enums: {
      fulfilment: "pickup" | "delivery"
      notification_status: "pending" | "sent" | "failed" | "suppressed"
      order_source: "online" | "walk_in"
      order_status:
        | "new"
        | "confirmed"
        | "deposit_paid"
        | "in_production"
        | "ready"
        | "out_for_delivery"
        | "completed"
        | "cancelled"
        | "pending_payment"
      order_type: "cake" | "pastry" | "mixed"
      pay_method: "mpesa" | "cash" | "bank"
      payment_attempt_status: "pending" | "completed" | "failed" | "cancelled"
      user_role: "superadmin" | "manager"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      fulfilment: ["pickup", "delivery"],
      notification_status: ["pending", "sent", "failed", "suppressed"],
      order_source: ["online", "walk_in"],
      order_status: [
        "new",
        "confirmed",
        "deposit_paid",
        "in_production",
        "ready",
        "out_for_delivery",
        "completed",
        "cancelled",
        "pending_payment",
      ],
      order_type: ["cake", "pastry", "mixed"],
      pay_method: ["mpesa", "cash", "bank"],
      payment_attempt_status: ["pending", "completed", "failed", "cancelled"],
      user_role: ["superadmin", "manager"],
    },
  },
} as const
