import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useTeamStore } from '../store/team';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { User, Users } from 'lucide-react';
import type { Database } from '../types/supabase';
import { useTeamMembers } from '../hooks/useTeamMembers';
import { PROJECT_STATUS_LABELS } from '../constants/taskConstants';

type Task = Database['public']['Tables']['tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Role = Database['public']['Tables']['team_members']['Row']['role'];

interface TaskWithProject extends Task {
  project?: Pick<Project, 'name'>;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: '管理者',
  member: 'メンバー',
  viewer: '閲覧者',
};

const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-700',
  member: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { teams, currentTeam, setTeams, setCurrentTeam } = useTeamStore();
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamType, setNewTeamType] = useState<'personal' | 'team'>('personal');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [createError, setCreateError] = useState('');
  const members = useTeamMembers();

  const isPersonal = currentTeam?.type === 'personal';

  useEffect(() => {
    if (currentTeam && user) {
      fetchTasks();
      fetchProjects();
    }
  }, [currentTeam, user]);

  const fetchTasks = async () => {
    let query = supabase
      .from('tasks')
      .select('*, project:projects(name)')
      .eq('team_id', currentTeam!.id)
      .neq('status', 'done')
      .order('due_date', { ascending: true, nullsFirst: false });

    // チームモードは自分のタスクのみ
    if (!isPersonal) {
      query = query.eq('assigned_to', user!.id);
    }

    const { data } = await query;
    setTasks((data as TaskWithProject[]) || []);
  };

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('team_id', currentTeam!.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setProjects(data || []);
  };


  useEffect(() => {
    fetchTeams();
  }, [user]);

  const fetchTeams = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('teams').select('*').order('created_at', { ascending: false });

    if (!error) {
      setTeams(data || []);
      if (data && data.length > 0 && !currentTeam) setCurrentTeam(data[0]);
    }
    setLoading(false);
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTeamName.trim()) return;
    setCreateError('');

    const { data, error } = await supabase
      .from('teams')
      .insert([{ name: newTeamName, owner_id: user.id, type: newTeamType }])
      .select()
      .single();

    if (error) {
      setCreateError('作成に失敗しました');
    } else if (data) {
      await supabase.from('team_members').insert([{
        team_id: data.id, user_id: user.id, role: 'admin'
      }]);
      setTeams([data, ...teams]);
      setCurrentTeam(data);
      setNewTeamName('');
      setIsCreateOpen(false);
    }
  };

  if (loading) return <div className="text-base-subtext">読み込み中...</div>;

  const taskLabel = isPersonal ? '未完了タスク' : '自分のタスク';
  const emptyTaskLabel = isPersonal
    ? '未完了のタスクはありません。'
    : 'アサインされているタスクはありません。';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-base-text">ダッシュボード</h2>
        {teams.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => { setIsCreateOpen(true); setCreateError(''); }}>
            + 新規ワークスペース
          </Button>
        )}
      </div>

      {/* ワークスペース切り替え */}
      {teams.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {teams.map(team => {
            const isSelected = currentTeam?.id === team.id;
            const isTeamType = team.type === 'team';
            return (
              <button
                key={team.id}
                onClick={() => setCurrentTeam(team)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? isTeamType
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-base-border bg-base-bg text-base-subtext hover:border-base-text hover:text-base-text'
                }`}
              >
                {isTeamType ? <Users size={15} /> : <User size={15} />}
                {team.name}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isSelected
                    ? isTeamType ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                    : 'bg-base-border text-base-subtext'
                }`}>
                  {isTeamType ? 'チーム' : '個人'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!teams.length ? (
        <Card>
          <CardHeader>
            <CardTitle>タスク管理システムへようこそ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-6 text-base-subtext">利用方法を選んでください。</p>

            {/* 利用タイプ選択 */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => setNewTeamType('personal')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${newTeamType === 'personal' ? 'border-blue-500 bg-blue-50' : 'border-base-border hover:border-base-text'}`}
              >
                <User size={24} className="mb-2 text-blue-500" />
                <div className="font-medium text-base-text text-sm">個人利用</div>
                <div className="text-xs text-base-subtext mt-1">自分だけのタスク管理</div>
              </button>
              <button
                type="button"
                onClick={() => setNewTeamType('team')}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${newTeamType === 'team' ? 'border-purple-500 bg-purple-50' : 'border-base-border hover:border-base-text'}`}
              >
                <Users size={24} className="mb-2 text-purple-500" />
                <div className="font-medium text-base-text text-sm">チーム利用</div>
                <div className="text-xs text-base-subtext mt-1">複数人でタスクを管理</div>
              </button>
            </div>

            {createError && (
              <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateTeam} className="flex gap-2">
              <Input
                placeholder={newTeamType === 'personal' ? '例: 個人タスク' : '例: 開発チーム'}
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit">作成</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {/* タスク */}
          <Card>
            <CardHeader>
              <CardTitle>{taskLabel}</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-base-subtext">{emptyTaskLabel}</p>
              ) : (
                <ul className="space-y-2">
                  {tasks.slice(0, 5).map(task => {
                    const isUrgentDue = task.due_date && (new Date(task.due_date).getTime() - Date.now()) < 3 * 24 * 60 * 60 * 1000 && new Date(task.due_date).getTime() > Date.now();
                    const isOverdue = task.due_date && new Date(task.due_date).getTime() < Date.now();
                    const priorityBadge: Record<string, { label: string; cls: string }> = {
                      urgent:  { label: '緊急',     cls: 'bg-red-100 text-red-700' },
                      high:    { label: '重要',     cls: 'bg-orange-100 text-orange-700' },
                      medium:  { label: '通常',     cls: 'bg-blue-50 text-blue-600' },
                      low:     { label: '低',       cls: 'bg-gray-100 text-gray-500' },
                      routine: { label: 'ルーティン', cls: 'bg-green-100 text-green-700' },
                    };
                    const badge = priorityBadge[task.priority ?? 'medium'] ?? priorityBadge['medium'];
                    return (
                      <li
                        key={task.id}
                        className={`text-sm border-b border-base-border pb-2 last:border-0 last:pb-0 ${
                          isOverdue ? 'opacity-70' : ''
                        }`}
                      >
                        <Link to={`/projects/${task.project_id}`} className="hover:text-blue-500 transition-colors block">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>
                            <span className={`font-medium truncate ${ isOverdue ? 'line-through text-base-subtext' : 'text-base-text' }`}>{task.title}</span>
                          </div>
                          <div className="text-xs text-base-subtext mt-1 flex items-center gap-2 flex-wrap">
                            <span>{task.project?.name || '不明なプロジェクト'}</span>
                            {task.due_date && (
                              <span className={`flex items-center gap-0.5 ${ isOverdue ? 'text-red-500 font-medium' : isUrgentDue ? 'text-orange-500 font-medium' : '' }`}>
                                📅 {new Date(task.due_date).toLocaleDateString('ja-JP')}
                                {isOverdue && ' (期限切れ)'}
                                {isUrgentDue && ' (まもなく期限)'}
                              </span>
                            )}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                  {tasks.length > 5 && (
                    <li className="text-xs pt-2 text-right">
                      <Link to="/tasks" className="text-blue-500 hover:underline">すべて見る ({tasks.length})</Link>
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* プロジェクト */}
          <Card>
            <CardHeader>
              <CardTitle>プロジェクト</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-base-subtext">プロジェクトがありません。</p>
                  <Link to="/projects">
                    <Button size="sm" variant="secondary">プロジェクトを作成</Button>
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {projects.map(project => (
                    <li key={project.id} className="text-sm border-b border-base-border pb-2 last:border-0 last:pb-0">
                      <Link to={`/projects/${project.id}`} className="hover:text-blue-500 transition-colors block">
                        <div className="font-medium text-base-text truncate">{project.name}</div>
                        <div className="text-xs text-base-subtext mt-1">
                          {PROJECT_STATUS_LABELS[project.status] ?? '進行中'}
                        </div>
                      </Link>
                    </li>
                  ))}
                  <li className="text-xs pt-2 text-right">
                    <Link to="/projects" className="text-blue-500 hover:underline">すべて見る</Link>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>

          {/* チームメンバー（チーム利用のみ） */}
          {!isPersonal && (
            <Card>
              <CardHeader>
                <CardTitle>チームメンバー</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-base-subtext">メンバーがいません。</p>
                ) : (
                  <ul className="space-y-2">
                    {members.map(m => {
                      const name = m.name || m.email || '不明なユーザー';
                      const isMe = m.id === user?.id;
                      return (
                        <li key={m.id} className="flex items-center justify-between text-sm border-b border-base-border pb-2 last:border-0 last:pb-0">
                          <span className="text-base-text truncate">
                            {name}
                            {isMe && <span className="ml-1 text-xs text-base-subtext">（自分）</span>}
                          </span>
                          <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${m.role ? ROLE_COLORS[m.role] : 'bg-purple-100 text-purple-700'}`}>
                            {m.role ? ROLE_LABELS[m.role] : '管理者'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
      {/* 新規チーム/ワークスペース作成モーダル */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="新規ワークスペース作成">
        <form onSubmit={handleCreateTeam} className="space-y-4">
          {createError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{createError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setNewTeamType('personal')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${newTeamType === 'personal' ? 'border-blue-500 bg-blue-50' : 'border-base-border hover:border-base-text'}`}
            >
              <User size={20} className="mb-2 text-blue-500" />
              <div className="font-medium text-base-text text-sm">個人利用</div>
              <div className="text-xs text-base-subtext mt-1">自分だけのタスク管理</div>
            </button>
            <button
              type="button"
              onClick={() => setNewTeamType('team')}
              className={`p-4 rounded-lg border-2 text-left transition-colors ${newTeamType === 'team' ? 'border-purple-500 bg-purple-50' : 'border-base-border hover:border-base-text'}`}
            >
              <Users size={20} className="mb-2 text-purple-500" />
              <div className="font-medium text-base-text text-sm">チーム利用</div>
              <div className="text-xs text-base-subtext mt-1">複数人でタスクを管理</div>
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">名前</label>
            <Input
              placeholder={newTeamType === 'personal' ? '例: 個人タスク' : '例: 開発チーム'}
              value={newTeamName}
              onChange={e => setNewTeamName(e.target.value)}
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>キャンセル</Button>
            <Button type="submit">作成</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
