export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: {
          id: string;
          name: string;
          endpoint_url: string;
          icon: string | null;
          description: string | null;
          status: string;
          last_seen_at: string | null;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          endpoint_url: string;
          icon?: string | null;
          description?: string | null;
          status?: string;
          last_seen_at?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          endpoint_url?: string;
          icon?: string | null;
          description?: string | null;
          status?: string;
          last_seen_at?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      threads: {
        Row: {
          id: string;
          agent_id: string;
          title: string | null;
          status: string;
          last_activity_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          title?: string | null;
          status?: string;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          title?: string | null;
          status?: string;
          last_activity_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          thread_id: string;
          role: string;
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          role: string;
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          role?: string;
          content?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      inbox_view: {
        Row: {
          id: string;
          agent_id: string;
          title: string | null;
          status: string;
          last_activity_at: string;
          created_at: string;
          agent_name: string;
          agent_icon: string | null;
          last_message: string | null;
          last_message_role: string | null;
          last_message_at: string | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Convenience types
export type Agent = Database["public"]["Tables"]["agents"]["Row"];
export type Thread = Database["public"]["Tables"]["threads"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type InboxItem = Database["public"]["Views"]["inbox_view"]["Row"];

export type AgentInsert = Database["public"]["Tables"]["agents"]["Insert"];
export type ThreadInsert = Database["public"]["Tables"]["threads"]["Insert"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
