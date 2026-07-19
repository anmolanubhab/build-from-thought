// path: src/integrations/supabase/types.ts
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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          created_at: string
          id: string
          model: string | null
          project_id: string | null
          prompt: string
          response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model?: string | null
          project_id?: string | null
          prompt: string
          response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string | null
          project_id?: string | null
          prompt?: string
          response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          ai_suggestions: Json | null
          created_at: string
          deploy_url: string | null
          env_var_keys: string[] | null
          error_message: string | null
          external_id: string | null
          id: string
          lighthouse_scores: Json | null
          production_alias: string | null
          project_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_suggestions?: Json | null
          created_at?: string
          deploy_url?: string | null
          env_var_keys?: string[] | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          lighthouse_scores?: Json | null
          production_alias?: string | null
          project_id: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_suggestions?: Json | null
          created_at?: string
          deploy_url?: string | null
          env_var_keys?: string[] | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          lighthouse_scores?: Json | null
          production_alias?: string | null
          project_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      github_tokens: {
        Row: {
          access_token: string
          created_at: string
          github_username: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          github_username?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          github_username?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_interest: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          plan: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          plan: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          plan?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_daily_limit: number
          credits_remaining: number
          credits_reset_at: string
          display_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_daily_limit?: number
          credits_remaining?: number
          credits_reset_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_daily_limit?: number
          credits_remaining?: number
          credits_reset_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      project_domains: {
        Row: {
          created_at: string
          domain: string
          error_message: string | null
          id: string
          project_id: string
          status: string
          updated_at: string
          verification: Json | null
        }
        Insert: {
          created_at?: string
          domain: string
          error_message?: string | null
          id?: string
          project_id: string
          status?: string
          updated_at?: string
          verification?: Json | null
        }
        Update: {
          created_at?: string
          domain?: string
          error_message?: string | null
          id?: string
          project_id?: string
          status?: string
          updated_at?: string
          verification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "project_domains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          code: string | null
          created_at: string
          css: string | null
          html: string | null
          id: string
          pages: Json | null
          preview_url: string | null
          project_id: string
          published_at: string | null
          react_code: string | null
          status: string
          summary: string | null
          version_number: number
        }
        Insert: {
          code?: string | null
          created_at?: string
          css?: string | null
          html?: string | null
          id?: string
          pages?: Json | null
          preview_url?: string | null
          project_id: string
          published_at?: string | null
          react_code?: string | null
          status?: string
          summary?: string | null
          version_number?: number
        }
        Update: {
          code?: string | null
          created_at?: string
          css?: string | null
          html?: string | null
          id?: string
          pages?: Json | null
          preview_url?: string | null
          project_id?: string
          published_at?: string | null
          react_code?: string | null
          status?: string
          summary?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          css: string | null
          deployed_url: string | null
          html: string | null
          id: string
          is_multipage: boolean
          is_public: boolean
          is_starred: boolean
          pages: Json | null
          prompt: string
          react_code: string | null
          slug: string
          title: string
          type: string
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          created_at?: string
          css?: string | null
          deployed_url?: string | null
          html?: string | null
          id?: string
          is_multipage?: boolean
          is_public?: boolean
          is_starred?: boolean
          pages?: Json | null
          prompt: string
          react_code?: string | null
          slug: string
          title: string
          type?: string
          updated_at?: string
          user_id: string
          view_count?: number
        }
        Update: {
          created_at?: string
          css?: string | null
          deployed_url?: string | null
          html?: string | null
          id?: string
          is_multipage?: boolean
          is_public?: boolean
          is_starred?: boolean
          pages?: Json | null
          prompt?: string
          react_code?: string | null
          slug?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: []
      }
      vercel_connections: {
        Row: {
          access_token: string
          created_at: string
          team_id: string | null
          team_name: string | null
          updated_at: string
          user_id: string
          vercel_username: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
          user_id: string
          vercel_username?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          team_id?: string | null
          team_name?: string | null
          updated_at?: string
          user_id?: string
          vercel_username?: string | null
        }
        Relationships: []
      }
      supabase_connections: {
        Row: {
          access_token: string
          created_at: string
          project_name: string | null
          project_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          project_name?: string | null
          project_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          project_name?: string | null
          project_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_projects: {
        Row: {
          created_at: string
          id: string
          project_id: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      record_referral: {
        Args: { p_referrer_id: string }
        Returns: undefined
      }
      get_supabase_connection_status: {
        Args: Record<PropertyKey, never>
        Returns: { connected: boolean; project_ref: string | null; project_name: string | null }[]
      }
      get_vercel_connection_status: {
        Args: Record<PropertyKey, never>
        Returns: { connected: boolean; team_name: string | null; vercel_username: string | null }[]
      }
      publish_project_version: {
        Args: { p_version_id: string }
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
