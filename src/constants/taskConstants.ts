import type { Database } from '../types/supabase';

type TaskStatus = Database['public']['Tables']['tasks']['Row']['status'];
type TaskPriority = Database['public']['Tables']['tasks']['Row']['priority'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'することリスト',
  doing: '進行中',
  review: '確認',
  done: '完了',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: '低',
  medium: '通常',
  high: '重要',
  urgent: '緊急',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-priority-low',
  medium: 'bg-priority-medium',
  high: 'bg-priority-high',
  urgent: 'bg-priority-urgent',
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: '進行中',
  completed: '完了',
  archived: 'アーカイブ',
};
