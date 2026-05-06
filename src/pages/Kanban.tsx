import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/supabase';
import { format } from 'date-fns';
import { Button } from '../components/ui/Button';
import { User as UserIcon } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { DndContext, DragOverlay, closestCorners, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTeamStore } from '../store/team';
import { useAuthStore } from '../store/auth';
import { useTeamMembers, type TeamMember } from '../hooks/useTeamMembers';
import { PRIORITY_LABELS, PRIORITY_COLORS } from '../constants/taskConstants';

type Task = Database['public']['Tables']['tasks']['Row'];

const COLUMNS = [
  { id: 'todo', title: 'することリスト', color: 'bg-status-todo' },
  { id: 'doing', title: '進行中', color: 'bg-status-doing' },
  { id: 'review', title: '確認', color: 'bg-status-review' },
  { id: 'done', title: '完了', color: 'bg-status-done' },
] as const;

export const Kanban: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentTeam } = useTeamStore();
  const { user } = useAuthStore();
  const isPersonal = currentTeam?.type === 'personal';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskStartTime, setNewTaskStartTime] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('');
  const [createError, setCreateError] = useState('');
  const teamMembers = useTeamMembers();

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Task['priority']>('medium');
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDueTime, setEditDueTime] = useState('');
  const [editAssignee, setEditAssignee] = useState<string>('');
  const [editError, setEditError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // コメント機能
  type Comment = { id: string; user_id: string; comment: string; created_at: string; authorName?: string };
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (projectId) {
      fetchTasks();
      fetchProjectName();
    }
  }, [projectId]);

  // リアルタイム購読
  useEffect(() => {
    if (!projectId) return;
    const channel = supabase
      .channel(`tasks:project:${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks(prev => [...prev, payload.new as Task]);
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => t.id === (payload.new as Task).id ? payload.new as Task : t));
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== (payload.old as Task).id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const fetchProjectName = async () => {
    const { data } = await supabase.from('projects').select('name').eq('id', projectId).single();
    if (data) setProjectName(data.name);
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setTasks(data);
    }
  };

  const handleCreateTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTaskTitle.trim()) return;
    if (!currentTeam || !projectId) {
      setCreateError('チームまたはプロジェクトが読み込まれていません。ページを再読み込みしてください。');
      return;
    }

    const titles = newTaskTitle.split('\n').map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) return;

    const currentTodoCount = tasks.filter(t => t.status === 'todo').length;

    const tasksToInsert = titles.map((title, idx) => ({
      project_id: projectId,
      team_id: currentTeam.id,
      title,
      status: 'todo' as const,
      start_date: newTaskStartDate ? new Date(`${newTaskStartDate}T${newTaskStartTime || '00:00'}`).toISOString() : null,
      due_date: newTaskDueDate ? new Date(`${newTaskDueDate}T${newTaskDueTime || '00:00'}`).toISOString() : null,
      assigned_to: newTaskAssignee || null,
      sort_order: currentTodoCount + idx
    }));

    setCreateError('');
    const { data, error } = await supabase.from('tasks').insert(tasksToInsert).select();

    if (error) {
      setCreateError('タスクの作成に失敗しました: ' + error.message);
      return;
    }
    if (data) {
      setTasks([...tasks, ...(data as Task[])]);
      setNewTaskTitle('');
      setNewTaskStartDate('');
      setNewTaskStartTime('');
      setNewTaskDueDate('');
      setNewTaskDueTime('');
      setNewTaskAssignee('');
      setCreateError('');
      setIsModalOpen(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    const overId = over.id as string;
    if (!activeTask) return;

    const isOverColumn = COLUMNS.some(col => col.id === overId);
    let newStatus: Task['status'] = activeTask.status;

    if (isOverColumn) {
      newStatus = overId as Task['status'];
    } else {
      const overTask = tasks.find(t => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    const isActiveInSameColumn = activeTask.status === newStatus;

    if (isActiveInSameColumn) {
      // 同じ列内での並び替え
      if (active.id === overId) return;

      const columnTasks = tasks.filter(t => t.status === newStatus).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const oldIndex = columnTasks.findIndex(t => t.id === active.id);
      const newIndex = columnTasks.findIndex(t => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrderedColumnTasks = arrayMove(columnTasks, oldIndex, newIndex);
        
        // ローカルステートを更新
        const otherTasks = tasks.filter(t => t.status !== newStatus);
        const updatedColumnTasks = newOrderedColumnTasks.map((t, idx) => ({ ...t, sort_order: idx }));
        setTasks([...otherTasks, ...updatedColumnTasks]);

        // DBを更新（並列実行）
        await Promise.all(
          updatedColumnTasks.map((t, i) =>
            supabase.from('tasks').update({ sort_order: i }).eq('id', t.id)
          )
        );
      }
    } else {
      // 別の列への移動
      const targetColumnTasks = tasks.filter(t => t.status === newStatus);
      const newSortOrder = targetColumnTasks.length;

      const updatedTasks = tasks.map(t =>
        t.id === activeTask.id ? { ...t, status: newStatus, sort_order: newSortOrder } : t
      );
      setTasks(updatedTasks);
      await supabase.from('tasks').update({ status: newStatus, sort_order: newSortOrder }).eq('id', activeTask.id);
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(task.description || '');
    setEditPriority(task.priority || 'medium');
    setEditAssignee(task.assigned_to || '');
    setEditError('');
    setDeleteConfirm(false);
    setNewComment('');
    fetchComments(task.id);

    if (task.start_date) {
      const sd = new Date(task.start_date);
      setEditStartDate(format(sd, 'yyyy-MM-dd'));
      const stimeStr = format(sd, 'HH:mm');
      setEditStartTime(stimeStr === '00:00' ? '' : stimeStr);
    } else {
      setEditStartDate('');
      setEditStartTime('');
    }

    if (task.due_date) {
      const d = new Date(task.due_date);
      setEditDueDate(format(d, 'yyyy-MM-dd'));
      const timeStr = format(d, 'HH:mm');
      setEditDueTime(timeStr === '00:00' ? '' : timeStr);
    } else {
      setEditDueDate('');
      setEditDueTime('');
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editTitle.trim()) return;
    setEditError('');

    const updates = {
      title: editTitle,
      description: editDescription,
      priority: editPriority,
      start_date: editStartDate ? new Date(`${editStartDate}T${editStartTime || '00:00'}`).toISOString() : null,
      due_date: editDueDate ? new Date(`${editDueDate}T${editDueTime || '00:00'}`).toISOString() : null,
      assigned_to: editAssignee || null
    };

    const { error } = await supabase.from('tasks').update(updates).eq('id', editingTask.id);
    if (!error) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { ...t, ...updates } : t));
      setEditingTask(null);
    } else {
      setEditError('タスクの更新に失敗しました');
    }
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;

    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    const { error } = await supabase.from('tasks').delete().eq('id', editingTask.id);
    if (!error) {
      setTasks(tasks.filter(t => t.id !== editingTask.id));
      setEditingTask(null);
    } else {
      setEditError('タスクの削除に失敗しました');
    }
  };

  const fetchComments = async (taskId: string) => {
    const { data } = await supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', userIds);
      const enriched = data.map(c => {
        const p = profiles?.find(p => p.id === c.user_id);
        return { ...c, authorName: p?.name || p?.email || '不明' };
      });
      setComments(enriched);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !user || !newComment.trim()) return;
    const { error } = await supabase.from('task_comments').insert({
      task_id: editingTask.id,
      user_id: user.id,
      comment: newComment.trim(),
    });
    if (!error) {
      setNewComment('');
      fetchComments(editingTask.id);
    }
  };

  const handleMobileStatusChange = async (task: Task, newStatus: Task['status']) => {
    const updatedTasks = tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t);
    setTasks(updatedTasks);
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <p className="text-xs text-base-subtext mb-1">プロジェクト</p>
          <h2 className="text-xl font-bold text-base-text">{projectName || '読み込み中...'}</h2>
          {!isPersonal && teamMembers.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {teamMembers.map(m => (
                <div
                  key={m.id}
                  title={m.name || m.email}
                  className="w-7 h-7 rounded-full bg-base-border flex items-center justify-center text-xs font-medium text-base-text border border-base-bg"
                >
                  {(m.name || m.email || '?')[0].toUpperCase()}
                </div>
              ))}
              <span className="text-xs text-base-subtext ml-1">{teamMembers.length}人</span>
            </div>
          )}
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="shrink-0">タスクを追加</Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={(args) => {
          // ポインターが入っているカラムを優先検出
          const pointerCollisions = pointerWithin(args);
          const columnCollision = pointerCollisions.find(c => COLUMNS.some(col => col.id === c.id));
          if (columnCollision) return [columnCollision];
          if (pointerCollisions.length > 0) return pointerCollisions;
          return closestCorners(args);
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-3 md:gap-6 overflow-x-auto pb-4 -mx-4 md:mx-0 px-4 md:px-0">
          {COLUMNS.map(col => {
            const columnTasks = tasks.filter(t => t.status === col.id);
            return (
              <Column key={col.id} id={col.id} title={col.title} color={col.color} tasks={columnTasks} onEdit={openEditModal} teamMembers={teamMembers} onStatusChange={handleMobileStatusChange} />
            );
          })}
        </div>

        <DragOverlay>
          {activeId && tasks.find(t => t.id === activeId)
            ? <TaskCard task={tasks.find(t => t.id === activeId)!} onEdit={() => {}} teamMembers={teamMembers} onStatusChange={handleMobileStatusChange} />
            : null}
        </DragOverlay>
      </DndContext>

      {/* 新規タスク作成モーダル */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setCreateError(''); }} title="新規タスクを追加">
        <form onSubmit={(e) => { e.preventDefault(); handleCreateTask(); }} className="space-y-4">
          {createError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{createError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">タスク名（改行で複数一括登録できます）</label>
            <textarea
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder={"タスク1\nタスク2\nタスク3"}
              required
              className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[100px] bg-base-bg text-sm"
            />
          </div>
          {!isPersonal && (
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">担当者</label>
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
              >
                <option value="">未設定</option>
                {user && (() => {
                  const me = teamMembers.find(m => m.id === user.id);
                  return <option value={user.id}>{me?.name || user.email}（自分）</option>;
                })()}
                {teamMembers.filter(m => m.id !== user?.id).map(member => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">開始日時</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newTaskStartDate}
                  onChange={(e) => setNewTaskStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                />
                <input
                  type="time"
                  value={newTaskStartTime}
                  onChange={(e) => setNewTaskStartTime(e.target.value)}
                  className="w-24 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">終了日時</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                />
                <input
                  type="time"
                  value={newTaskDueTime}
                  onChange={(e) => setNewTaskDueTime(e.target.value)}
                  className="w-24 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>キャンセル</Button>
            <Button type="button" onClick={() => handleCreateTask()}>作成</Button>
          </div>
        </form>
      </Modal>

      {/* タスク編集モーダル */}
      <Modal isOpen={!!editingTask} onClose={() => { setEditingTask(null); setDeleteConfirm(false); }} title="タスクを編集">
        {editingTask && (
          <form onSubmit={handleUpdateTask} className="space-y-4">
            {editError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {editError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">タイトル</label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
                className="w-full bg-base-bg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">説明</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px] bg-base-bg text-sm text-base-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">優先度</label>
              <select
                value={editPriority ?? 'medium'}
                onChange={(e) => setEditPriority(e.target.value as Task['priority'])}
                className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
              >
                <option value="low">低</option>
                <option value="medium">通常</option>
                <option value="high">重要</option>
                <option value="urgent">緊急</option>
              </select>
            </div>
            {!isPersonal && (
              <div>
                <label className="block text-sm font-medium text-base-subtext mb-1">担当者</label>
                <select
                  value={editAssignee}
                  onChange={(e) => setEditAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                >
                  <option value="">未設定</option>
                  {user && (() => {
                    const me = teamMembers.find(m => m.id === user.id);
                    return <option value={user.id}>{me?.name || user.email}（自分）</option>;
                  })()}
                  {teamMembers.filter(m => m.id !== user?.id).map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-subtext mb-1">開始日時</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                  />
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-24 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-base-subtext mb-1">終了日時</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                  />
                  <input
                    type="time"
                    value={editDueTime}
                    onChange={(e) => setEditDueTime(e.target.value)}
                    className="w-24 px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-sm text-base-text"
                  />
                </div>
              </div>
            </div>
            {deleteConfirm ? (
              <div className="flex items-center gap-2 pt-4">
                <span className="text-sm text-red-600">本当に削除しますか？</span>
                <Button type="button" variant="danger" size="sm" onClick={handleDeleteTask}>削除する</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>取消</Button>
              </div>
            ) : (
              <div className="flex justify-between items-center pt-4">
                <Button type="button" variant="ghost" onClick={handleDeleteTask} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  削除する
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" onClick={() => { setEditingTask(null); setDeleteConfirm(false); }}>キャンセル</Button>
                  <Button type="submit">更新</Button>
                </div>
              </div>
            )}

            {/* コメントセクション */}
            <div className="border-t border-base-border pt-4 mt-2">
              <h4 className="text-sm font-medium text-base-text mb-3">コメント</h4>
              <form onSubmit={handlePostComment} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="コメントを入力..."
                  className="flex-1 px-3 py-2 border border-base-border rounded-md text-sm bg-base-bg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button type="submit" size="sm" disabled={!newComment.trim()}>投稿</Button>
              </form>
              {comments.length === 0 ? (
                <p className="text-xs text-base-subtext">まだコメントはありません。</p>
              ) : (
                <ul className="space-y-3 max-h-48 overflow-y-auto">
                  {comments.map(c => (
                    <li key={c.id} className="text-sm">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-base-text">{c.authorName}</span>
                        <span className="text-xs text-base-subtext">{new Date(c.created_at).toLocaleString('ja-JP')}</span>
                      </div>
                      <p className="text-base-subtext bg-base-card px-3 py-2 rounded-md">{c.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

// --- Sub components ---

function Column({ id, title, color, tasks, onEdit, teamMembers, onStatusChange }: {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  onEdit: (task: Task) => void;
  teamMembers: TeamMember[];
  onStatusChange: (task: Task, newStatus: Task['status']) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex-shrink-0 w-72 md:w-80 bg-base-card rounded-lg border border-base-border flex flex-col">
      <div className={`p-3 font-semibold rounded-t-lg border-b border-base-border flex justify-between ${color}`}>
        <span>{title}</span>
        <span className="bg-white/50 text-xs px-2 py-1 rounded-full">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-3 overflow-y-auto space-y-3 min-h-[200px] transition-colors ${isOver ? 'bg-blue-50/30' : ''}`}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTask key={task.id} task={task} onEdit={onEdit} teamMembers={teamMembers} onStatusChange={onStatusChange} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTask({ task, onEdit, teamMembers, onStatusChange }: {
  task: Task;
  onEdit: (task: Task) => void;
  teamMembers: TeamMember[];
  onStatusChange: (task: Task, newStatus: Task['status']) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { type: 'Task', task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} onEdit={onEdit} teamMembers={teamMembers} onStatusChange={onStatusChange} />
    </div>
  );
}

function TaskCard({ task, onEdit, teamMembers, onStatusChange }: {
  task: Task;
  onEdit: (task: Task) => void;
  teamMembers: TeamMember[];
  onStatusChange?: (task: Task, newStatus: Task['status']) => void;
}) {
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);
  const priorityColor = PRIORITY_COLORS[task.priority || 'medium'];

  const formatPart = (str: string) => {
    const d = new Date(str);
    const isMidnight = format(d, 'HH:mm') === '00:00';
    return format(d, isMidnight ? 'MM/dd' : 'MM/dd HH:mm');
  };

  const dateLabel = (() => {
    if (task.start_date && task.due_date) {
      return `${formatPart(task.start_date)} 〜 ${formatPart(task.due_date)}`;
    } else if (task.start_date) {
      return `${formatPart(task.start_date)} から`;
    } else if (task.due_date) {
      return `〜 ${formatPart(task.due_date)}`;
    }
    return null;
  })();

  const assigneeName = (() => {
    if (!task.assigned_to) return null;
    const member = teamMembers.find(m => m.id === task.assigned_to);
    return member?.name || member?.email || '担当者';
  })();

  return (
    <div
      onClick={() => onEdit(task)}
      className="bg-base-bg p-3 rounded-md shadow-sm border border-base-border cursor-grab active:cursor-grabbing hover:border-blue-300 transition-colors group relative"
    >
      <div className="absolute top-2 right-2 flex gap-1">
        {/* PC用編集ボタン */}
        <span className="opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline">
          <button className="text-base-subtext hover:text-blue-500 bg-base-card p-1 rounded-sm shadow-sm">✎</button>
        </span>
        {/* モバイル用メニューボタン */}
        <button
          className="md:hidden text-base-subtext hover:text-blue-500 bg-base-card p-1 rounded-sm shadow-sm"
          onClick={(e) => { e.stopPropagation(); setShowMobileMenu(v => !v); }}
        >⋮</button>
      </div>
      {/* モバイル用ステータス変更メニュー */}
      {showMobileMenu && (
        <div
          className="absolute top-8 right-2 z-20 bg-base-bg border border-base-border rounded-md shadow-lg p-2 space-y-1 min-w-[140px] md:hidden"
          onClick={e => e.stopPropagation()}
        >
          <p className="text-xs text-base-subtext font-medium px-2 pb-1">ステータス変更</p>
          {([['todo', 'することリスト'], ['doing', '進行中'], ['review', '確認'], ['done', '完了']] as const).map(([st, label]) => (
            <button
              key={st}
              disabled={task.status === st}
              onClick={() => { onStatusChange?.(task, st); setShowMobileMenu(false); }}
              className={`w-full text-left text-sm px-2 py-1 rounded hover:bg-base-border transition-colors ${
                task.status === st ? 'font-bold text-blue-500' : 'text-base-text'
              }`}
            >{label}</button>
          ))}
          <button
            onClick={() => { setShowMobileMenu(false); onEdit(task); }}
            className="w-full text-left text-sm px-2 py-1 rounded hover:bg-base-border transition-colors text-base-text border-t border-base-border mt-1 pt-2"
          >編集</button>
        </div>
      )}
      {/* タイトル */}
      <div className="text-sm font-medium text-base-text mb-2 pr-6">{task.title}</div>
      {/* 優先度 + 担当者 */}
      <div className="flex items-center gap-2 text-xs mb-1.5">
        <span className={`px-2 py-0.5 rounded-sm text-base-text opacity-90 ${priorityColor}`}>
          {PRIORITY_LABELS[task.priority || 'medium']}
        </span>
        {assigneeName && (
          <span className="flex items-center gap-1 text-base-subtext border border-base-border px-2 py-0.5 rounded-sm">
            <UserIcon size={11} />
            {assigneeName}
          </span>
        )}
      </div>
      {/* 日付（1行） */}
      {dateLabel && (
        <div className="flex items-center gap-1 text-xs text-base-subtext">
          <span>📅</span>
          <span>{dateLabel}</span>
        </div>
      )}
    </div>
  );
}
