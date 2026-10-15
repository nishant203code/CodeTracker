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
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      extension_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          token_hash: string
          token_hint: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token_hash: string
          token_hint: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token_hash?: string
          token_hint?: string
          user_id?: string
        }
        Relationships: []
      }
      github_settings: {
        Row: {
          github_login: string | null
          repo_name: string | null
          repo_owner: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          github_login?: string | null
          repo_name?: string | null
          repo_owner?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          github_login?: string | null
          repo_name?: string | null
          repo_owner?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      problems: {
        Row: {
          created_at: string
          date_first_solved: string
          difficulty: Database["public"]["Enums"]["difficulty_level"]
          favorite: boolean
          hints: string | null
          id: string
          last_revised_at: string | null
          last_solved_date: string
          link: string | null
          name: string
          notes: string | null
          pattern: string | null
          platform: Database["public"]["Enums"]["platform_type"]
          problem_id: string | null
          solution_link: string | null
          status: Database["public"]["Enums"]["problem_status"]
          time_taken_minutes: number | null
          times_solved: number
          topics: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_first_solved?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          favorite?: boolean
          hints?: string | null
          id?: string
          last_revised_at?: string | null
          last_solved_date?: string
          link?: string | null
          name: string
          notes?: string | null
          pattern?: string | null
          platform?: Database["public"]["Enums"]["platform_type"]
          problem_id?: string | null
          solution_link?: string | null
          status?: Database["public"]["Enums"]["problem_status"]
          time_taken_minutes?: number | null
          times_solved?: number
          topics?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_first_solved?: string
          difficulty?: Database["public"]["Enums"]["difficulty_level"]
          favorite?: boolean
          hints?: string | null
          id?: string
          last_revised_at?: string | null
          last_solved_date?: string
          link?: string | null
          name?: string
          notes?: string | null
          pattern?: string | null
          platform?: Database["public"]["Enums"]["platform_type"]
          problem_id?: string | null
          solution_link?: string | null
          status?: Database["public"]["Enums"]["problem_status"]
          time_taken_minutes?: number | null
          times_solved?: number
          topics?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      revision_session_items: {
        Row: {
          difficulty: string
          id: string
          position: number
          priority_score: number
          problem_id: string | null
          problem_name: string
          session_id: string
          status: string
          times_solved: number
          user_id: string
        }
        Insert: {
          difficulty: string
          id?: string
          position: number
          priority_score: number
          problem_id?: string | null
          problem_name: string
          session_id: string
          status: string
          times_solved: number
          user_id: string
        }
        Update: {
          difficulty?: string
          id?: string
          position?: number
          priority_score?: number
          problem_id?: string | null
          problem_name?: string
          session_id?: string
          status?: string
          times_solved?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revision_session_items_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revision_session_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "revision_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      revision_sessions: {
        Row: {
          generated_at: string
          id: string
          mode: string
          problem_count: number
          user_id: string
        }
        Insert: {
          generated_at?: string
          id: string
          mode?: string
          problem_count: number
          user_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          mode?: string
          problem_count?: number
          user_id?: string
        }
        Relationships: []
      }
      revisions: {
        Row: {
          id: string
          outcome: Database["public"]["Enums"]["revision_outcome"]
          problem_id: string
          revised_at: string
          user_id: string
        }
        Insert: {
          id?: string
          outcome: Database["public"]["Enums"]["revision_outcome"]
          problem_id: string
          revised_at?: string
          user_id: string
        }
        Update: {
          id?: string
          outcome?: Database["public"]["Enums"]["revision_outcome"]
          problem_id?: string
          revised_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revisions_problem_id_fkey"
            columns: ["problem_id"]
            isOneToOne: false
            referencedRelation: "problems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      norm_problem_name: { Args: { "": string }; Returns: string }
    }
    Enums: {
      difficulty_level: "easy" | "medium" | "hard"
      platform_type: "leetcode" | "codeforces" | "other"
      problem_status:
        | "solved"
        | "need_revision"
        | "mastered"
        | "forgotten"
        | "learning"
        | "practicing"
      revision_outcome:
        | "solved_again"
        | "forgot"
        | "too_easy"
        | "need_more_practice"
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
      difficulty_level: ["easy", "medium", "hard"],
      platform_type: ["leetcode", "codeforces", "other"],
      problem_status: [
        "solved",
        "need_revision",
        "mastered",
        "forgotten",
        "learning",
        "practicing",
      ],
      revision_outcome: [
        "solved_again",
        "forgot",
        "too_easy",
        "need_more_practice",
      ],
    },
  },
} as const
