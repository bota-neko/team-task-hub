import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useTeamStore } from '../store/team';
import type { Database } from '../types/supabase';
import { Link } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Button } from '../components/ui/Button';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { STATUS_LABELS, PRIORITY_LABELS } from '../constants/taskConstants';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

interface TaskWithProject extends Task {
  project?: Project;
}

export const TaskList: React.FC = () => {
  const { user } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const isPersonal = currentTeam?.type === 'personal';
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [filter, setFilter] = useState<'all' | 'my' | 'incomplete' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const teamMembers = useTeamMembers();

  useEffect(() => {
    if (currentTeam) {
      fetchTasks();
    }
  }, [currentTeam, filter, viewMode]);

  useEffect(() => {
    if (currentTeam && viewMode === 'calendar') {
      fetchTasks();
    }
  }, [currentDate]);

  const fetchTasks = async () => {
    if (!currentTeam) return;

    let query = supabase.from('tasks').select('*, project:projects(*)').eq('team_id', currentTeam.id);

    if (viewMode === 'calendar') {
      const calendarStart = startOfWeek(startOfMonth(currentDate)).toISOString();
      const calendarEnd = endOfWeek(endOfMonth(currentDate)).toISOString();
      query = query
        .or(`start_date.gte.${calendarStart},due_date.gte.${calendarStart}`)
        .or(`start_date.lte.${calendarEnd},due_date.lte.${calendarEnd}`);
    } else {
      if (filter === 'my' && user) {
        query = query.eq('assigned_to', user.id);
      } else if (filter === 'incomplete') {
        query = query.neq('status', 'done');
      } else if (filter === 'overdue') {
        const today = new Date().toISOString();
        query = query.lt('due_date', today).neq('status', 'done');
      }
    }

    const { data, error } = await query;
    if (!error && data) {
      setTasks(data as TaskWithProject[]);
    }
  };

  if (!currentTeam) return <div className="text-base-subtext">チームを選択してください。</div>;

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  const formatPart = (str: string) => {
    const d = new Date(str);
    const isMidnight = format(d, 'HH:mm') === '00:00';
    return format(d, isMidnight ? 'MM/dd' : 'MM/dd HH:mm');
  };

  const renderDateDisplay = (startStr: string | null, dueStr: string | null) => {
    if (startStr && dueStr) {
      return `${formatPart(startStr)} - ${formatPart(dueStr)}`;
    } else if (startStr) {
      return `${formatPart(startStr)} から`;
    } else if (dueStr) {
      return `${formatPart(dueStr)} まで`;
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-base-text">タスク一覧</h2>

        <div className="flex items-center gap-2 bg-base-card p-1 rounded-md border border-base-border">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${viewMode === 'list' ? 'bg-base-text text-base-bg' : 'text-base-subtext hover:bg-base-border'}`}
          >
            リスト
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${viewMode === 'calendar' ? 'bg-base-text text-base-bg' : 'text-base-subtext hover:bg-base-border'}`}
          >
            カレンダー
          </button>
        </div>

        {viewMode === 'list' && (
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="border border-base-border rounded-md px-3 py-1.5 bg-base-bg text-sm"
          >
            <option value="all">すべてのタスク</option>
            {!isPersonal && <option value="my">自分のタスク</option>}
            <option value="incomplete">未完了</option>
            <option value="overdue">期限切れ</option>
          </select>
        )}
      </div>

      {viewMode === 'list' ? (
        <div className="overflow-x-auto border border-base-border rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-base-card border-b border-base-border">
              <tr>
                <th className="p-3 font-medium text-base-text">タイトル</th>
                <th className="p-3 font-medium text-base-text hidden sm:table-cell">プロジェクト</th>
                <th className="p-3 font-medium text-base-text">ステータス</th>
                <th className="p-3 font-medium text-base-text hidden md:table-cell">優先度</th>
                {!isPersonal && <th className="p-3 font-medium text-base-text hidden md:table-cell">担当者</th>}
                <th className="p-3 font-medium text-base-text hidden sm:table-cell">期間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-border bg-base-bg">
              {tasks.map(task => (
                <tr key={task.id} className="hover:bg-base-card transition-colors">
                  <td className="p-3 font-medium text-base-text">{task.title}</td>
                  <td className="p-3 text-base-subtext hidden sm:table-cell">
                    {task.project ? (
                      <Link to={`/projects/${task.project_id}`} className="hover:underline">{task.project.name}</Link>
                    ) : 'N/A'}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs whitespace-nowrap">
                      {STATUS_LABELS[task.status] ?? task.status}
                    </span>
                  </td>
                  <td className="p-3 hidden md:table-cell">
                    <span className="px-2 py-1 bg-blue-50 rounded-md text-xs">
                      {PRIORITY_LABELS[task.priority ?? 'medium'] ?? task.priority}
                    </span>
                  </td>
                  {!isPersonal && (
                    <td className="p-3 text-base-subtext hidden md:table-cell">
                      {task.assigned_to ? (teamMembers.find(m => m.id === task.assigned_to)?.name || teamMembers.find(m => m.id === task.assigned_to)?.email || '担当者') : '-'}
                    </td>
                  )}
                  <td className="p-3 text-base-subtext hidden sm:table-cell">
                    {renderDateDisplay(task.start_date, task.due_date)}
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-base-subtext">タスクが見つかりません。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-base-bg border border-base-border rounded-lg overflow-hidden flex flex-col h-[700px]">
          <div className="flex justify-between items-center p-4 bg-base-card border-b border-base-border">
            <h3 className="text-lg font-bold text-base-text">{format(currentDate, 'yyyy年 MM月')}</h3>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>前月</Button>
              <Button variant="ghost" onClick={() => setCurrentDate(new Date())}>今日</Button>
              <Button variant="ghost" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>次月</Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-base-border bg-base-card">
            {['日', '月', '火', '水', '木', '金', '土'].map(day => (
              <div key={day} className="py-2 text-center text-sm font-medium text-base-subtext border-r border-base-border last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6">
            {calendarDays.map((day) => {
              const dayTasks = tasks.filter(t => {
                if (t.start_date && t.due_date) {
                  try {
                    return isWithinInterval(day, { start: startOfDay(new Date(t.start_date)), end: endOfDay(new Date(t.due_date)) });
                  } catch { return false; }
                } else if (t.start_date) {
                  return isSameDay(new Date(t.start_date), day);
                } else if (t.due_date) {
                  return isSameDay(new Date(t.due_date), day);
                }
                return false;
              });
              return (
                <div
                  key={day.toISOString()}
                  className={`border-r border-b border-base-border p-1 overflow-y-auto ${!isSameMonth(day, currentDate) ? 'bg-base-card opacity-50' : ''}`}
                >
                  <div className="text-xs text-base-subtext text-right p-1">{format(day, 'd')}</div>
                  <div className="space-y-1">
                    {dayTasks.map(task => (
                      <Link
                        key={task.id}
                        to={`/projects/${task.project_id}`}
                        className="block text-[10px] p-1 bg-blue-50 text-blue-700 rounded truncate hover:bg-blue-100 transition-colors"
                        title={task.title}
                      >
                        {task.start_date && !task.due_date && format(new Date(task.start_date), 'HH:mm') !== '00:00'
                          ? `${format(new Date(task.start_date), 'HH:mm')} ` : ''}
                        {!task.start_date && task.due_date && format(new Date(task.due_date), 'HH:mm') !== '00:00'
                          ? `${format(new Date(task.due_date), 'HH:mm')} ` : ''}
                        {task.start_date && task.due_date && format(new Date(task.start_date), 'HH:mm') !== '00:00' && isSameDay(day, new Date(task.start_date))
                          ? `${format(new Date(task.start_date), 'HH:mm')} ` : ''}
                        {task.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
