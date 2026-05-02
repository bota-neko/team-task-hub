import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../store/team';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Link } from 'react-router-dom';
import { Trash2, Pencil } from 'lucide-react';
import type { Database } from '../types/supabase';
import { PROJECT_STATUS_LABELS } from '../constants/taskConstants';

type Project = Database['public']['Tables']['projects']['Row'];

export const Projects: React.FC = () => {
  const { currentTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templates, setTemplates] = useState<Database['public']['Tables']['templates']['Row'][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  useEffect(() => {
    if (currentTeam) {
      fetchProjects();
      fetchTemplates();
    } else {
      setProjects([]);
      setTemplates([]);
    }
  }, [currentTeam]);

  const fetchTemplates = async () => {
    if (!currentTeam) return;
    const { data } = await supabase.from('templates').select('*').eq('team_id', currentTeam.id);
    if (data) setTemplates(data);
  };

  const fetchProjects = async () => {
    if (!currentTeam) return;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('team_id', currentTeam.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProjects(data);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeam || !user || !newProjectName.trim()) return;
    setLoading(true);
    setError('');

    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert([{
        team_id: currentTeam.id,
        name: newProjectName,
        description: newProjectDesc,
        created_by: user.id,
      }])
      .select()
      .single();

    if (projectError || !projectData) {
      setError(`プロジェクトの作成に失敗しました: ${projectError?.message ?? '不明なエラー'}`);
      setLoading(false);
      return;
    }

    if (selectedTemplateId) {
      const { data: templateTasks } = await supabase
        .from('template_tasks')
        .select('*')
        .eq('template_id', selectedTemplateId);

      if (templateTasks && templateTasks.length > 0) {
        const tasksToInsert = templateTasks.map(t => ({
          project_id: projectData.id,
          team_id: currentTeam.id,
          title: t.title,
          description: t.description,
          status: t.status as Database['public']['Tables']['tasks']['Row']['status'],
          priority: t.priority as Database['public']['Tables']['tasks']['Row']['priority'],
          sort_order: t.sort_order
        }));
        await supabase.from('tasks').insert(tasksToInsert);
      }
    }

    setProjects([projectData, ...projects]);
    setIsModalOpen(false);
    setNewProjectName('');
    setNewProjectDesc('');
    setSelectedTemplateId('');
    setLoading(false);
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;
    setEditLoading(true);
    setEditError('');

    const { error } = await supabase
      .from('projects')
      .update({ name: editName, description: editDesc })
      .eq('id', editingProject.id);

    if (error) {
      setEditError('更新に失敗しました');
    } else {
      setProjects(projects.map(p =>
        p.id === editingProject.id ? { ...p, name: editName, description: editDesc } : p
      ));
      setEditingProject(null);
    }
    setEditLoading(false);
  };

  const handleDeleteProject = async () => {
    if (!deletingProject) return;
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    setDeleteError('');

    // タスクを削除（task_commentsはCASCADEで自動削除）
    const { error: tasksError } = await supabase
      .from('tasks')
      .delete()
      .eq('project_id', deletingProject.id);

    if (tasksError) {
      setDeleteError(`タスクの削除に失敗しました: ${tasksError.message}`);
      return;
    }

    // 3. プロジェクトを削除（.select()で実際に削除されたか検証）
    const { data: deleted, error: projectError } = await supabase
      .from('projects')
      .delete()
      .eq('id', deletingProject.id)
      .select();

    if (projectError) {
      setDeleteError(`削除に失敗しました: ${projectError.message}`);
      return;
    }

    if (!deleted || deleted.length === 0) {
      setDeleteError('削除できませんでした。Supabase の RLS ポリシーで DELETE が許可されていない可能性があります。');
      return;
    }

    setProjects(projects.filter(p => p.id !== deletingProject.id));
    setDeletingProject(null);
    setDeleteConfirm(false);
  };

  if (!currentTeam) {
    return <div className="text-base-subtext">ダッシュボードからチームを選択または作成してください。</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-base-text">プロジェクト</h2>
        <Button onClick={() => { setError(''); setIsModalOpen(true); }}>新規プロジェクト</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {projects.map(project => (
          <div key={project.id} className="relative group">
            <Link to={`/projects/${project.id}`} className="block">
              <Card className="hover:border-blue-300 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-base-subtext line-clamp-2">
                    {project.description || '説明なし'}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-base-subtext">
                    <span>ステータス: {PROJECT_STATUS_LABELS[project.status] ?? project.status}</span>
                    <span>{new Date(project.created_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setEditingProject(project);
                  setEditName(project.name);
                  setEditDesc(project.description || '');
                  setEditError('');
                }}
                className="p-1.5 rounded-md text-base-subtext hover:text-blue-500 hover:bg-blue-50"
                title="編集"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setDeletingProject(project);
                  setDeleteConfirm(false);
                  setDeleteError('');
                }}
                className="p-1.5 rounded-md text-base-subtext hover:text-red-500 hover:bg-red-50"
                title="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="col-span-full text-center py-12 text-base-subtext">
            プロジェクトがありません。新規プロジェクトを作成しましょう。
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="新規プロジェクト作成">
        <form onSubmit={handleCreateProject} className="space-y-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">プロジェクト名</label>
            <Input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              required
              placeholder="例: ウェブサイトリニューアル"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">説明（任意）</label>
            <Input
              value={newProjectDesc}
              onChange={e => setNewProjectDesc(e.target.value)}
              placeholder="プロジェクトの簡単な説明"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">テンプレートを使用（任意）</label>
            <select
              className="w-full border border-base-border rounded-md px-3 py-2 bg-base-bg text-sm"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
            >
              <option value="">テンプレートなし</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>キャンセル</Button>
            <Button type="submit" disabled={loading}>{loading ? '作成中...' : '作成'}</Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={!!editingProject} onClose={() => setEditingProject(null)} title="プロジェクトを編集">
        <form onSubmit={handleEditProject} className="space-y-4">
          {editError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {editError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">プロジェクト名</label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">説明（任意）</label>
            <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="プロジェクトの簡単な説明" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditingProject(null)}>キャンセル</Button>
            <Button type="submit" disabled={editLoading}>{editLoading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!deletingProject}
        onClose={() => { setDeletingProject(null); setDeleteConfirm(false); }}
        title="プロジェクトを削除"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {deleteError}
            </div>
          )}
          {!deleteConfirm ? (
            <>
              <p className="text-sm text-base-text">
                <span className="font-semibold">「{deletingProject?.name}」</span> を削除しますか？
              </p>
              <p className="text-sm text-base-subtext">このプロジェクトに含まれるすべてのタスクも削除されます。</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setDeletingProject(null)}>キャンセル</Button>
                <Button type="button" variant="danger" onClick={handleDeleteProject}>削除する</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-red-600">本当に削除しますか？この操作は取り消せません。</p>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setDeleteConfirm(false)}>戻る</Button>
                <Button type="button" variant="danger" onClick={handleDeleteProject}>完全に削除する</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
