export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          created_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          owner_id: string
          type: 'personal' | 'team'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          type?: 'personal' | 'team'
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          type?: 'personal' | 'team'
          created_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          role: 'admin' | 'member' | 'viewer'
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          role?: 'admin' | 'member' | 'viewer'
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          role?: 'admin' | 'member' | 'viewer'
        }
      }
      projects: {
        Row: {
          id: string
          team_id: string
          name: string
          description: string | null
          status: 'active' | 'completed' | 'archived'
          start_date: string | null
          due_date: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          description?: string | null
          status?: 'active' | 'completed' | 'archived'
          start_date?: string | null
          due_date?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          description?: string | null
          status?: 'active' | 'completed' | 'archived'
          start_date?: string | null
          due_date?: string | null
          created_by?: string
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          team_id: string
          title: string
          description: string | null
          status: 'todo' | 'doing' | 'review' | 'done'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to: string | null
          start_date: string | null
          due_date: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          team_id: string
          title: string
          description?: string | null
          status?: 'todo' | 'doing' | 'review' | 'done'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          start_date?: string | null
          due_date?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          team_id?: string
          title?: string
          description?: string | null
          status?: 'todo' | 'doing' | 'review' | 'done'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_to?: string | null
          start_date?: string | null
          due_date?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          comment: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          comment: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          comment?: string
          created_at?: string
        }
      }
      task_checklists: {
        Row: {
          id: string
          task_id: string
          title: string
          is_done: boolean
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          is_done?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          is_done?: boolean
          created_at?: string
        }
      }
      templates: {
        Row: {
          id: string
          team_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          name?: string
          created_at?: string
        }
      }
      team_invitations: {
        Row: {
          id: string
          team_id: string
          email: string
          role: 'admin' | 'member' | 'viewer'
          token: string
          status: 'pending' | 'accepted' | 'expired'
          invited_by: string
          created_at: string
        }
        Insert: {
          id?: string
          team_id: string
          email: string
          role?: 'admin' | 'member' | 'viewer'
          token?: string
          status?: 'pending' | 'accepted' | 'expired'
          invited_by: string
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          email?: string
          role?: 'admin' | 'member' | 'viewer'
          token?: string
          status?: 'pending' | 'accepted' | 'expired'
          invited_by?: string
          created_at?: string
        }
      }
      template_tasks: {
        Row: {
          id: string
          template_id: string
          title: string
          description: string | null
          status: string
          priority: string
          due_offset_days: number
          sort_order: number
        }
        Insert: {
          id?: string
          template_id: string
          title: string
          description?: string | null
          status?: string
          priority?: string
          due_offset_days?: number
          sort_order?: number
        }
        Update: {
          id?: string
          template_id?: string
          title?: string
          description?: string | null
          status?: string
          priority?: string
          due_offset_days?: number
          sort_order?: number
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
