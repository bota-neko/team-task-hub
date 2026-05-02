import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTeamStore } from '../store/team';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Pencil, Trash2, Play, CheckSquare } from 'lucide-react';
import type { Database } from '../types/supabase';
import { useNavigate } from 'react-router-dom';

type Template = Database['public']['Tables']['templates']['Row'];
type TemplateTask = Database['public']['Tables']['template_tasks']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低', cls: 'bg-gray-100 text-gray-500' },
  { value: 'medium', label: '通常', cls: 'bg-blue-50 text-blue-600' },
  { value: 'high', label: '重要', cls: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: '緊急', cls: 'bg-red-100 text-red-700' },
];

const DEFAULT_PERSONAL_TEMPLATES = [
  {
    name: 'Webサイト制作（個人）',
    tasks: [
      { title: '要件・目的の整理', priority: 'urgent', offset: 0 },
      { title: 'ドメイン・サーバーの選定・契約', priority: 'high', offset: 2 },
      { title: 'サイト構成・ワイヤーフレーム作成', priority: 'high', offset: 5 },
      { title: 'デザイン制作', priority: 'high', offset: 10 },
      { title: 'コーディング・実装', priority: 'medium', offset: 18 },
      { title: '動作確認・修正', priority: 'high', offset: 28 },
      { title: 'SEO・アナリティクス設定', priority: 'medium', offset: 32 },
      { title: '公開・告知', priority: 'urgent', offset: 35 },
    ],
  },
  {
    name: 'イベント企画・運営（個人）',
    tasks: [
      { title: '企画内容・テーマの決定', priority: 'urgent', offset: 0 },
      { title: '会場・日程の確定', priority: 'urgent', offset: 2 },
      { title: '予算の策定', priority: 'high', offset: 3 },
      { title: '告知・集客開始', priority: 'high', offset: 7 },
      { title: '備品・資料の準備', priority: 'medium', offset: 21 },
      { title: '進行台本の作成', priority: 'medium', offset: 25 },
      { title: '前日の最終確認', priority: 'urgent', offset: 29 },
      { title: 'イベント当日', priority: 'urgent', offset: 30 },
      { title: '振り返り・記録まとめ', priority: 'medium', offset: 32 },
    ],
  },
  {
    name: 'フリーランス案件管理',
    tasks: [
      { title: '要件ヒアリング・議事録作成', priority: 'urgent', offset: 0 },
      { title: '見積書の作成・提出', priority: 'urgent', offset: 1 },
      { title: '契約書の締結', priority: 'urgent', offset: 3 },
      { title: '制作・開発開始', priority: 'high', offset: 5 },
      { title: '中間確認・フィードバック対応', priority: 'high', offset: 14 },
      { title: '納品物の最終確認', priority: 'high', offset: 25 },
      { title: '納品・請求書の送付', priority: 'urgent', offset: 28 },
      { title: '入金確認', priority: 'medium', offset: 58 },
    ],
  },
  {
    name: '旅行計画',
    tasks: [
      { title: '行き先・日程を決める', priority: 'high', offset: 0 },
      { title: '交通手段・宿泊先を予約', priority: 'high', offset: 1 },
      { title: '旅行保険を確認', priority: 'medium', offset: 2 },
      { title: '持ち物リストを作成', priority: 'medium', offset: 5 },
      { title: '両替・現金準備', priority: 'medium', offset: 7 },
      { title: '荷物をまとめる', priority: 'high', offset: 13 },
    ],
  },
  {
    name: '引越し準備',
    tasks: [
      { title: '引越し業者を比較・予約', priority: 'urgent', offset: 0 },
      { title: '新居の契約手続き', priority: 'urgent', offset: 1 },
      { title: '不用品の処分', priority: 'medium', offset: 7 },
      { title: '住所変更手続き（役所・銀行など）', priority: 'high', offset: 14 },
      { title: '電気・水道・ガスの手続き', priority: 'high', offset: 14 },
      { title: '荷造り完了', priority: 'high', offset: 21 },
      { title: '引越し当日の立ち会い', priority: 'urgent', offset: 28 },
    ],
  },
  {
    name: '資格・試験対策',
    tasks: [
      { title: '受験申込', priority: 'urgent', offset: 0 },
      { title: '参考書・教材の選定', priority: 'high', offset: 1 },
      { title: '学習スケジュールを作成', priority: 'medium', offset: 2 },
      { title: '基礎分野の学習', priority: 'medium', offset: 7 },
      { title: '過去問を解く', priority: 'high', offset: 21 },
      { title: '弱点分野の復習', priority: 'high', offset: 35 },
      { title: '直前の総復習', priority: 'urgent', offset: 42 },
    ],
  },
  {
    name: '週次レビュー（個人）',
    tasks: [
      { title: '今週のタスクを振り返る', priority: 'medium', offset: 0 },
      { title: '未完了タスクの棚卸し', priority: 'medium', offset: 0 },
      { title: '来週のゴールを設定', priority: 'high', offset: 0 },
      { title: 'タスクの優先順位を整理', priority: 'medium', offset: 0 },
    ],
  },
];

const DEFAULT_TEAM_TEMPLATES = [
  {
    name: 'Webサイト制作',
    tasks: [
      { title: '要件定義・ヒアリング', priority: 'urgent', offset: 0 },
      { title: 'サイトマップ作成', priority: 'high', offset: 3 },
      { title: 'ワイヤーフレーム作成', priority: 'high', offset: 7 },
      { title: 'デザインカンプ制作', priority: 'high', offset: 14 },
      { title: 'フロントエンド実装', priority: 'medium', offset: 21 },
      { title: 'バックエンド実装', priority: 'medium', offset: 21 },
      { title: '動作テスト・修正', priority: 'high', offset: 35 },
      { title: 'クライアント確認', priority: 'urgent', offset: 40 },
      { title: '本番リリース', priority: 'urgent', offset: 45 },
    ],
  },
  {
    name: 'アプリ開発（MVP）',
    tasks: [
      { title: 'プロダクト要件定義（PRD作成）', priority: 'urgent', offset: 0 },
      { title: 'UI/UXデザイン・プロトタイプ', priority: 'high', offset: 5 },
      { title: 'アーキテクチャ設計', priority: 'high', offset: 7 },
      { title: '開発環境・CI/CD構築', priority: 'medium', offset: 10 },
      { title: 'コア機能の実装', priority: 'high', offset: 14 },
      { title: '内部テスト（ユニット・結合）', priority: 'high', offset: 35 },
      { title: 'ユーザーテスト・フィードバック収集', priority: 'high', offset: 42 },
      { title: 'バグ修正・改善対応', priority: 'urgent', offset: 49 },
      { title: 'ベータリリース', priority: 'urgent', offset: 56 },
      { title: '正式リリース・モニタリング', priority: 'urgent', offset: 63 },
    ],
  },
  {
    name: '製品ローンチ',
    tasks: [
      { title: 'ローンチ戦略・KPIの設定', priority: 'urgent', offset: 0 },
      { title: 'ターゲット・ペルソナの定義', priority: 'high', offset: 2 },
      { title: 'ランディングページ制作', priority: 'high', offset: 7 },
      { title: 'プレスリリース草稿', priority: 'medium', offset: 14 },
      { title: 'SNS・メール告知の準備', priority: 'medium', offset: 21 },
      { title: 'インフルエンサー・メディアへの働きかけ', priority: 'high', offset: 21 },
      { title: 'ローンチ当日の対応体制を整える', priority: 'urgent', offset: 28 },
      { title: '公式ローンチ', priority: 'urgent', offset: 30 },
      { title: 'ローンチ後KPI計測・レポート', priority: 'medium', offset: 37 },
    ],
  },
  {
    name: 'マーケティングキャンペーン',
    tasks: [
      { title: 'キャンペーン目標・予算の設定', priority: 'urgent', offset: 0 },
      { title: 'ターゲットオーディエンスの定義', priority: 'high', offset: 2 },
      { title: 'クリエイティブ（画像・動画）制作', priority: 'high', offset: 7 },
      { title: 'コピーライティング', priority: 'medium', offset: 10 },
      { title: '配信チャネルの設定（SNS・広告・メール）', priority: 'high', offset: 14 },
      { title: 'A/Bテストの設計', priority: 'medium', offset: 16 },
      { title: 'キャンペーン開始', priority: 'urgent', offset: 21 },
      { title: '中間効果測定・改善', priority: 'high', offset: 28 },
      { title: '最終レポート・振り返り', priority: 'medium', offset: 42 },
    ],
  },
  {
    name: 'イベント企画・運営',
    tasks: [
      { title: '企画書・予算案の作成', priority: 'urgent', offset: 0 },
      { title: '会場の選定・予約', priority: 'urgent', offset: 3 },
      { title: '登壇者・出演者の依頼', priority: 'high', offset: 7 },
      { title: '集客・告知開始', priority: 'high', offset: 14 },
      { title: '進行台本・タイムラインの作成', priority: 'medium', offset: 21 },
      { title: '備品・機材の準備', priority: 'medium', offset: 28 },
      { title: 'リハーサル', priority: 'high', offset: 35 },
      { title: 'イベント当日運営', priority: 'urgent', offset: 42 },
      { title: 'アンケート集計・振り返り', priority: 'medium', offset: 44 },
    ],
  },
  {
    name: '社内研修・セミナー',
    tasks: [
      { title: '研修目的・対象者の定義', priority: 'high', offset: 0 },
      { title: 'カリキュラム・資料の作成', priority: 'high', offset: 5 },
      { title: '講師・ファシリテーターの手配', priority: 'urgent', offset: 7 },
      { title: '会場・オンライン環境の準備', priority: 'medium', offset: 10 },
      { title: '参加者への案内送付', priority: 'medium', offset: 14 },
      { title: 'リハーサル・最終確認', priority: 'high', offset: 20 },
      { title: '研修当日の運営', priority: 'urgent', offset: 21 },
      { title: 'アンケート・効果測定', priority: 'medium', offset: 22 },
      { title: '改善点の整理・次回への反映', priority: 'low', offset: 28 },
    ],
  },
  {
    name: '新入社員オンボーディング',
    tasks: [
      { title: 'PC・デバイスの手配', priority: 'urgent', offset: -7 },
      { title: 'アカウント・権限の発行', priority: 'urgent', offset: -3 },
      { title: '入社初日のオリエンテーション', priority: 'high', offset: 0 },
      { title: '社内ツールの使い方説明', priority: 'high', offset: 1 },
      { title: 'チームメンバーとの顔合わせ', priority: 'medium', offset: 2 },
      { title: '業務フロー・ルールの説明', priority: 'medium', offset: 3 },
      { title: '最初の1週間の目標設定', priority: 'high', offset: 5 },
      { title: '1ヶ月後のフォローアップ面談', priority: 'medium', offset: 30 },
    ],
  },
  {
    name: '採用プロセス',
    tasks: [
      { title: '採用要件・JDの作成', priority: 'urgent', offset: 0 },
      { title: '求人票の公開', priority: 'high', offset: 3 },
      { title: '書類選考', priority: 'medium', offset: 7 },
      { title: '一次面接', priority: 'high', offset: 14 },
      { title: '二次面接・課題選考', priority: 'high', offset: 21 },
      { title: '最終面接', priority: 'urgent', offset: 28 },
      { title: 'オファー提示', priority: 'urgent', offset: 32 },
      { title: '入社手続き・書類回収', priority: 'high', offset: 40 },
    ],
  },
  {
    name: 'スプリント計画（2週間）',
    tasks: [
      { title: 'バックログの整理・優先順位付け', priority: 'urgent', offset: 0 },
      { title: 'スプリントゴールの設定', priority: 'high', offset: 0 },
      { title: 'タスクの見積もり・アサイン', priority: 'high', offset: 1 },
      { title: '中間チェックイン（1週目）', priority: 'medium', offset: 7 },
      { title: 'スプリントレビュー', priority: 'high', offset: 14 },
      { title: 'レトロスペクティブ', priority: 'medium', offset: 14 },
    ],
  },
  {
    name: 'システム導入・切替',
    tasks: [
      { title: '現状課題の整理・要件定義', priority: 'urgent', offset: 0 },
      { title: 'ベンダー・ツールの比較検討', priority: 'high', offset: 5 },
      { title: '導入ベンダーの決定・契約', priority: 'urgent', offset: 14 },
      { title: 'データ移行計画の策定', priority: 'high', offset: 18 },
      { title: 'テスト環境での動作検証', priority: 'high', offset: 25 },
      { title: '社内向けマニュアル・研修資料の作成', priority: 'medium', offset: 32 },
      { title: '利用者への研修実施', priority: 'high', offset: 38 },
      { title: '本番環境への移行・切替', priority: 'urgent', offset: 45 },
      { title: '移行後のサポート・不具合対応', priority: 'high', offset: 46 },
    ],
  },
  {
    name: 'オフィス移転',
    tasks: [
      { title: '移転先の候補選定・内見', priority: 'urgent', offset: 0 },
      { title: '新オフィスの契約', priority: 'urgent', offset: 14 },
      { title: '旧オフィス解約通知', priority: 'urgent', offset: 14 },
      { title: '内装・レイアウトの設計', priority: 'high', offset: 21 },
      { title: '什器・備品の手配', priority: 'medium', offset: 30 },
      { title: '通信回線・ITインフラの手配', priority: 'high', offset: 35 },
      { title: '社員・取引先への住所変更通知', priority: 'high', offset: 42 },
      { title: '引越し作業', priority: 'urgent', offset: 56 },
      { title: '旧オフィスの原状回復', priority: 'medium', offset: 63 },
    ],
  },
  {
    name: '予算策定（期初）',
    tasks: [
      { title: '前期実績の集計・分析', priority: 'high', offset: 0 },
      { title: '各部門へのヒアリング', priority: 'high', offset: 3 },
      { title: '売上・費用予測の作成', priority: 'urgent', offset: 7 },
      { title: '予算案のドラフト作成', priority: 'high', offset: 12 },
      { title: '経営陣レビュー・修正対応', priority: 'urgent', offset: 16 },
      { title: '最終予算の承認', priority: 'urgent', offset: 21 },
      { title: '各部門への予算配布・説明', priority: 'medium', offset: 23 },
    ],
  },
  {
    name: 'PR・プレスリリース',
    tasks: [
      { title: 'リリース内容・メッセージの整理', priority: 'high', offset: 0 },
      { title: 'プレスリリース原稿の執筆', priority: 'high', offset: 3 },
      { title: '社内レビュー・法務確認', priority: 'urgent', offset: 7 },
      { title: 'メディアリスト・配信先の選定', priority: 'medium', offset: 7 },
      { title: '写真・素材の準備', priority: 'medium', offset: 10 },
      { title: 'メディアへの事前案内（エンバーゴ）', priority: 'high', offset: 12 },
      { title: 'プレスリリース配信', priority: 'urgent', offset: 14 },
      { title: '掲載状況のモニタリング・対応', priority: 'medium', offset: 15 },
    ],
  },
  {
    name: '週次チームMTG運営',
    tasks: [
      { title: 'アジェンダの作成・共有', priority: 'medium', offset: 0 },
      { title: '各メンバーの進捗確認', priority: 'medium', offset: 0 },
      { title: 'ブロッカー・課題の洗い出し', priority: 'high', offset: 0 },
      { title: '次週の優先タスク・アサインの確認', priority: 'high', offset: 0 },
      { title: '議事録の作成・共有', priority: 'medium', offset: 0 },
    ],
  },
];

interface TaskInputRow {
  title: string;
  priority: string;
  offset: number;
}

export const Templates: React.FC = () => {
  const { currentTeam } = useTeamStore();
  const navigate = useNavigate();
  const isPersonal = currentTeam?.type === 'personal';

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateTasks, setTemplateTasks] = useState<Record<string, TemplateTask[]>>({});

  // 新規作成
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [taskRows, setTaskRows] = useState<TaskInputRow[]>([{ title: '', priority: 'medium', offset: 0 }]);
  const [error, setError] = useState('');

  // 編集
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editName, setEditName] = useState('');
  const [editTaskRows, setEditTaskRows] = useState<TaskInputRow[]>([]);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // 削除
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // 適用
  const [applyingTemplate, setApplyingTemplate] = useState<Template | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [applyProjectId, setApplyProjectId] = useState('');
  const [applyStartDate, setApplyStartDate] = useState('');
  const [applySuccess, setApplySuccess] = useState('');
  const [applyError, setApplyError] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);

  // プロジェクトからテンプレート作成
  const [isSaveFromProjectOpen, setIsSaveFromProjectOpen] = useState(false);
  const [saveFromProjects, setSaveFromProjects] = useState<Project[]>([]);
  const [saveFromProjectId, setSaveFromProjectId] = useState('');
  const [saveFromName, setSaveFromName] = useState('');
  const [saveFromTasks, setSaveFromTasks] = useState<Task[]>([]);
  const [saveFromLoading, setSaveFromLoading] = useState(false);
  const [saveFromError, setSaveFromError] = useState('');
  const [saveFromSuccess, setSaveFromSuccess] = useState('');

  useEffect(() => {
    if (currentTeam) fetchTemplates();
  }, [currentTeam]);

  const openSaveFromProject = async () => {
    if (!currentTeam) return;
    setSaveFromError('');
    setSaveFromSuccess('');
    setSaveFromProjectId('');
    setSaveFromName('');
    setSaveFromTasks([]);
    const { data } = await supabase.from('projects').select('*').eq('team_id', currentTeam.id).order('created_at', { ascending: false });
    setSaveFromProjects(data ?? []);
    setIsSaveFromProjectOpen(true);
  };

  const handleSelectSaveFromProject = async (projectId: string) => {
    setSaveFromProjectId(projectId);
    const project = saveFromProjects.find(p => p.id === projectId);
    setSaveFromName(project?.name ?? '');
    if (!projectId) { setSaveFromTasks([]); return; }
    const { data } = await supabase.from('tasks').select('*').eq('project_id', projectId).order('sort_order', { ascending: true });
    setSaveFromTasks(data ?? []);
  };

  const handleSaveFromProject = async () => {
    if (!currentTeam || !saveFromProjectId || !saveFromName.trim()) return;
    setSaveFromLoading(true);
    setSaveFromError('');

    const { data: templateData, error } = await (supabase.from('templates') as any)
      .insert([{ team_id: currentTeam.id, name: saveFromName.trim() }])
      .select()
      .single();

    if (error || !templateData) {
      setSaveFromError('テンプレートの作成に失敗しました');
      setSaveFromLoading(false);
      return;
    }

    const tasksToInsert = saveFromTasks.map((task, idx) => ({
      template_id: templateData.id,
      title: task.title,
      status: 'todo',
      priority: task.priority ?? 'medium',
      due_offset_days: idx,
      sort_order: idx,
    }));

    if (tasksToInsert.length > 0) {
      await supabase.from('template_tasks').insert(tasksToInsert as any);
    }

    setSaveFromSuccess(`「${saveFromName}」をテンプレートとして保存しました（${saveFromTasks.length}件のタスク）`);
    setSaveFromLoading(false);
    fetchTemplates();
  };

  const handleAddDefaults = async () => {
    if (!currentTeam) return;
    const defaults = currentTeam.type === 'personal' ? DEFAULT_PERSONAL_TEMPLATES : DEFAULT_TEAM_TEMPLATES;
    const existingNames = new Set(templates.map(t => t.name));
    const toAdd = defaults.filter(d => !existingNames.has(d.name));
    if (toAdd.length === 0) return;

    for (const t of toAdd) {
      const { data: templateData } = await (supabase.from('templates') as any)
        .insert([{ team_id: currentTeam.id, name: t.name }])
        .select()
        .single();
      if (templateData) {
        await supabase.from('template_tasks').insert(
          t.tasks.map((task, idx) => ({
            template_id: templateData.id,
            title: task.title,
            status: 'todo',
            priority: task.priority,
            due_offset_days: task.offset,
            sort_order: idx,
          })) as any
        );
      }
    }
    fetchTemplates();
  };

  const fetchTemplates = async () => {
    if (!currentTeam) return;
    const { data } = await supabase.from('templates').select('*').eq('team_id', currentTeam.id).order('created_at', { ascending: false });
    if (!data) return;
    setTemplates(data);

    if (data.length > 0) {
      const { data: tasks } = await supabase
        .from('template_tasks')
        .select('*')
        .in('template_id', data.map(t => t.id))
        .order('sort_order', { ascending: true });

      if (tasks) {
        const grouped: Record<string, TemplateTask[]> = {};
        for (const task of tasks) {
          if (!grouped[task.template_id]) grouped[task.template_id] = [];
          grouped[task.template_id].push(task);
        }
        setTemplateTasks(grouped);
      }
    }
  };

  const toTasksInsert = (rows: TaskInputRow[], templateId: string) =>
    rows.filter(r => r.title.trim()).map((r, idx) => ({
      template_id: templateId,
      title: r.title.trim(),
      status: 'todo',
      priority: r.priority,
      due_offset_days: r.offset,
      sort_order: idx,
    }));

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeam || !newTemplateName.trim()) return;
    setError('');

    const { data: templateData, error: templateError } = await (supabase.from('templates') as any)
      .insert([{ team_id: currentTeam.id, name: newTemplateName }])
      .select()
      .single();

    if (templateError || !templateData) { setError('作成に失敗しました'); return; }

    const tasksToInsert = toTasksInsert(taskRows, templateData.id);
    let newTasks: TemplateTask[] = [];
    if (tasksToInsert.length > 0) {
      const { data } = await supabase.from('template_tasks').insert(tasksToInsert as any).select();
      newTasks = (data ?? []) as TemplateTask[];
    }

    setTemplates(prev => [templateData, ...prev]);
    setTemplateTasks(prev => ({ ...prev, [templateData.id]: newTasks }));
    setIsModalOpen(false);
    setNewTemplateName('');
    setTaskRows([{ title: '', priority: 'medium', offset: 0 }]);
  };

  const openEditModal = (template: Template) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditError('');
    const tasks = templateTasks[template.id] ?? [];
    setEditTaskRows(
      tasks.length > 0
        ? tasks.map(t => ({ title: t.title, priority: t.priority || 'medium', offset: t.due_offset_days || 0 }))
        : [{ title: '', priority: 'medium', offset: 0 }]
    );
  };

  const handleEditTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editName.trim()) return;
    setEditLoading(true);
    setEditError('');

    const { error: nameError } = await (supabase.from('templates') as any)
      .update({ name: editName })
      .eq('id', editingTemplate.id);

    if (nameError) { setEditError('更新に失敗しました'); setEditLoading(false); return; }

    await supabase.from('template_tasks').delete().eq('template_id', editingTemplate.id);

    const tasksToInsert = toTasksInsert(editTaskRows, editingTemplate.id);
    let newTasks: TemplateTask[] = [];
    if (tasksToInsert.length > 0) {
      const { data } = await supabase.from('template_tasks').insert(tasksToInsert as any).select();
      newTasks = (data ?? []) as TemplateTask[];
    }

    setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, name: editName } : t));
    setTemplateTasks(prev => ({ ...prev, [editingTemplate.id]: newTasks }));
    setEditingTemplate(null);
    setEditLoading(false);
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    setDeleteError('');
    await supabase.from('template_tasks').delete().eq('template_id', deletingTemplate.id);
    const { error } = await supabase.from('templates').delete().eq('id', deletingTemplate.id);
    if (error) { setDeleteError('削除に失敗しました: ' + error.message); return; }
    setTemplates(prev => prev.filter(t => t.id !== deletingTemplate.id));
    setTemplateTasks(prev => { const next = { ...prev }; delete next[deletingTemplate.id]; return next; });
    setDeletingTemplate(null);
  };

  const openApplyModal = async (template: Template) => {
    setApplyingTemplate(template);
    setApplyError('');
    setApplySuccess('');
    setApplyProjectId('');
    setApplyStartDate(new Date().toISOString().split('T')[0]);
    if (currentTeam) {
      const { data } = await supabase.from('projects').select('*').eq('team_id', currentTeam.id).eq('status', 'active').order('created_at', { ascending: false });
      setProjects(data ?? []);
    }
  };

  const handleApplyTemplate = async () => {
    if (!applyingTemplate || !applyProjectId || !currentTeam) return;
    setApplyLoading(true);
    setApplyError('');

    const tasks = templateTasks[applyingTemplate.id] ?? [];
    if (tasks.length === 0) { setApplyError('タスクが登録されていません'); setApplyLoading(false); return; }

    const startDate = applyStartDate ? new Date(applyStartDate) : new Date();
    const { data: existing } = await supabase.from('tasks').select('sort_order').eq('project_id', applyProjectId).order('sort_order', { ascending: false }).limit(1);
    const baseOrder = (existing?.[0]?.sort_order ?? -1) + 1;

    const tasksToInsert = tasks.map((task, idx) => ({
      project_id: applyProjectId,
      team_id: currentTeam.id,
      title: task.title,
      status: 'todo' as const,
      priority: (task.priority || 'medium') as Task['priority'],
      due_date: task.due_offset_days
        ? new Date(startDate.getTime() + task.due_offset_days * 24 * 60 * 60 * 1000).toISOString()
        : null,
      sort_order: baseOrder + idx,
    }));

    const { error } = await supabase.from('tasks').insert(tasksToInsert);
    if (error) {
      setApplyError('適用に失敗しました: ' + error.message);
    } else {
      setApplySuccess(`${tasks.length}件のタスクを追加しました！`);
    }
    setApplyLoading(false);
  };


  const addTaskRow = (rows: TaskInputRow[], setRows: (r: TaskInputRow[]) => void) =>
    setRows([...rows, { title: '', priority: 'medium', offset: 0 }]);

  const removeTaskRow = (rows: TaskInputRow[], setRows: (r: TaskInputRow[]) => void, idx: number) =>
    setRows(rows.filter((_, i) => i !== idx));

  const updateTaskRow = (rows: TaskInputRow[], setRows: (r: TaskInputRow[]) => void, idx: number, field: keyof TaskInputRow, value: string | number) => {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: value };
    setRows(next);
  };

  if (!currentTeam) return <div className="text-base-subtext">ワークスペースを選択してください。</div>;

  const TaskRowEditor = ({ rows, setRows }: { rows: TaskInputRow[]; setRows: (r: TaskInputRow[]) => void }) => (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="text-xs text-base-subtext w-5 shrink-0">{idx + 1}.</span>
          <input
            type="text"
            value={row.title}
            onChange={e => updateTaskRow(rows, setRows, idx, 'title', e.target.value)}
            placeholder="タスク名"
            className="flex-1 px-2 py-1.5 border border-base-border rounded text-sm bg-base-bg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <select
            value={row.priority}
            onChange={e => updateTaskRow(rows, setRows, idx, 'priority', e.target.value)}
            className="text-xs border border-base-border rounded px-1.5 py-1.5 bg-base-bg shrink-0"
          >
            {PRIORITY_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="number"
              value={row.offset}
              onChange={e => updateTaskRow(rows, setRows, idx, 'offset', parseInt(e.target.value) || 0)}
              className="w-14 text-xs border border-base-border rounded px-1.5 py-1.5 bg-base-bg text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="開始日からの日数"
            />
            <span className="text-xs text-base-subtext">日後</span>
          </div>
          <button
            type="button"
            onClick={() => removeTaskRow(rows, setRows, idx)}
            disabled={rows.length === 1}
            className="text-base-subtext hover:text-red-500 disabled:opacity-30 p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addTaskRow(rows, setRows)}
        className="text-sm text-blue-500 hover:text-blue-600 mt-1"
      >
        + タスクを追加
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-base-text">テンプレート</h2>
          <p className="text-sm text-base-subtext mt-0.5">
            {isPersonal ? '個人用' : currentTeam.name} のテンプレート
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={handleAddDefaults}>
            デフォルトを追加
          </Button>
          <Button variant="secondary" onClick={openSaveFromProject}>
            プロジェクトから保存
          </Button>
          <Button onClick={() => { setError(''); setTaskRows([{ title: '', priority: 'medium', offset: 0 }]); setIsModalOpen(true); }}>
            + 新規テンプレート
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {templates.map(template => {
          const tasks = templateTasks[template.id] ?? [];
          return (
            <div key={template.id} className="relative group flex flex-col">
              <Card className="flex-1 flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <span className="shrink-0 text-xs text-base-subtext bg-base-border px-2 py-0.5 rounded-full">
                      {tasks.length}タスク
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  {tasks.length > 0 ? (
                    <ul className="space-y-1.5 flex-1">
                      {tasks.slice(0, 6).map((task) => {
                        const p = PRIORITY_OPTIONS.find(o => o.value === task.priority) ?? PRIORITY_OPTIONS[1];
                        return (
                          <li key={task.id} className="flex items-center gap-2 text-sm">
                            <CheckSquare size={13} className="shrink-0 text-base-subtext" />
                            <span className="flex-1 truncate text-base-text">{task.title}</span>
                            <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${p.cls}`}>{p.label}</span>
                          </li>
                        );
                      })}
                      {tasks.length > 6 && (
                        <li className="text-xs text-base-subtext pl-5">他 {tasks.length - 6} 件...</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-base-subtext flex-1">タスクなし</p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-base-border">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 gap-1"
                      onClick={() => openApplyModal(template)}
                    >
                      <Play size={13} />
                      プロジェクトに適用
                    </Button>
                    <button
                      onClick={() => openEditModal(template)}
                      className="p-1.5 rounded-md text-base-subtext hover:text-blue-500 hover:bg-blue-50"
                      title="編集"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => { setDeletingTemplate(template); setDeleteError(''); }}
                      className="p-1.5 rounded-md text-base-subtext hover:text-red-500 hover:bg-red-50"
                      title="削除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
        {templates.length === 0 && (
          <div className="col-span-full text-center py-16 text-base-subtext">
            <p className="mb-2">テンプレートがありません。</p>
            <p className="text-sm">サンプルを生成するか、新規作成しましょう。</p>
          </div>
        )}
      </div>

      {/* 新規作成モーダル */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="テンプレート作成">
        <form onSubmit={handleCreateTemplate} className="space-y-4">
          {error && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">テンプレート名</label>
            <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} required placeholder="例: プロジェクトキックオフ" />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-2">
              タスク
              <span className="ml-2 text-xs font-normal text-base-subtext">優先度・開始からの日数を設定できます</span>
            </label>
            <TaskRowEditor rows={taskRows} setRows={setTaskRows} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>キャンセル</Button>
            <Button type="submit">作成</Button>
          </div>
        </form>
      </Modal>

      {/* 編集モーダル */}
      <Modal isOpen={!!editingTemplate} onClose={() => setEditingTemplate(null)} title="テンプレートを編集">
        <form onSubmit={handleEditTemplate} className="space-y-4">
          {editError && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{editError}</div>}
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">テンプレート名</label>
            <Input value={editName} onChange={e => setEditName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-2">タスク</label>
            <TaskRowEditor rows={editTaskRows} setRows={setEditTaskRows} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditingTemplate(null)}>キャンセル</Button>
            <Button type="submit" disabled={editLoading}>{editLoading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </Modal>

      {/* 削除確認モーダル */}
      <Modal isOpen={!!deletingTemplate} onClose={() => setDeletingTemplate(null)} title="テンプレートを削除">
        <div className="space-y-4">
          {deleteError && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{deleteError}</div>}
          <p className="text-sm text-base-text"><span className="font-semibold">「{deletingTemplate?.name}」</span> を削除しますか？</p>
          <p className="text-sm text-base-subtext">テンプレートに含まれるタスクもすべて削除されます。</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeletingTemplate(null)}>キャンセル</Button>
            <Button type="button" variant="danger" onClick={handleDeleteTemplate}>削除する</Button>
          </div>
        </div>
      </Modal>

      {/* 適用モーダル */}
      <Modal isOpen={!!applyingTemplate} onClose={() => setApplyingTemplate(null)} title={`「${applyingTemplate?.name}」を適用`}>
        <div className="space-y-4">
          {applyError && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{applyError}</div>}
          {applySuccess ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">{applySuccess}</div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setApplyingTemplate(null)}>閉じる</Button>
                <Button type="button" onClick={() => { setApplyingTemplate(null); navigate(`/projects/${applyProjectId}`); }}>
                  プロジェクトを開く
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-base-subtext">
                テンプレートのタスク（{templateTasks[applyingTemplate?.id ?? '']?.length ?? 0}件）を選択したプロジェクトに追加します。
              </p>
              <div>
                <label className="block text-sm font-medium text-base-subtext mb-1">プロジェクト</label>
                {projects.length === 0 ? (
                  <p className="text-sm text-base-subtext">進行中のプロジェクトがありません。先にプロジェクトを作成してください。</p>
                ) : (
                  <select
                    value={applyProjectId}
                    onChange={e => setApplyProjectId(e.target.value)}
                    className="w-full border border-base-border rounded-md px-3 py-2 bg-base-bg text-sm"
                  >
                    <option value="">選択してください</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-base-subtext mb-1">
                  開始日
                  <span className="ml-1 text-xs font-normal">（各タスクの期限はここからの日数で計算されます）</span>
                </label>
                <input
                  type="date"
                  value={applyStartDate}
                  onChange={e => setApplyStartDate(e.target.value)}
                  className="w-full border border-base-border rounded-md px-3 py-2 bg-base-bg text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setApplyingTemplate(null)}>キャンセル</Button>
                <Button type="button" disabled={!applyProjectId || applyLoading} onClick={handleApplyTemplate}>
                  {applyLoading ? '適用中...' : '適用する'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      {/* プロジェクトからテンプレート作成モーダル */}
      <Modal isOpen={isSaveFromProjectOpen} onClose={() => setIsSaveFromProjectOpen(false)} title="プロジェクトからテンプレートを保存">
        <div className="space-y-4">
          {saveFromError && <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{saveFromError}</div>}
          {saveFromSuccess ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">{saveFromSuccess}</div>
              <div className="flex justify-end">
                <Button onClick={() => setIsSaveFromProjectOpen(false)}>閉じる</Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-base-subtext mb-1">プロジェクトを選択</label>
                {saveFromProjects.length === 0 ? (
                  <p className="text-sm text-base-subtext">進行中のプロジェクトがありません。</p>
                ) : (
                  <select
                    value={saveFromProjectId}
                    onChange={e => handleSelectSaveFromProject(e.target.value)}
                    className="w-full border border-base-border rounded-md px-3 py-2 bg-base-bg text-sm"
                  >
                    <option value="">選択してください</option>
                    {saveFromProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
              </div>
              {saveFromProjectId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-base-subtext mb-1">テンプレート名</label>
                    <input
                      type="text"
                      value={saveFromName}
                      onChange={e => setSaveFromName(e.target.value)}
                      className="w-full border border-base-border rounded-md px-3 py-2 bg-base-bg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-base-subtext mb-2">含まれるタスク（{saveFromTasks.length}件）</p>
                    {saveFromTasks.length === 0 ? (
                      <p className="text-sm text-base-subtext">このプロジェクトにタスクがありません。</p>
                    ) : (
                      <ul className="space-y-1 max-h-48 overflow-y-auto border border-base-border rounded-md p-2">
                        {saveFromTasks.map((task, i) => {
                          const p = PRIORITY_OPTIONS.find(o => o.value === task.priority) ?? PRIORITY_OPTIONS[1];
                          return (
                            <li key={task.id} className="flex items-center gap-2 text-sm">
                              <span className="text-xs text-base-subtext w-5">{i + 1}.</span>
                              <span className="flex-1 truncate text-base-text">{task.title}</span>
                              <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded ${p.cls}`}>{p.label}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsSaveFromProjectOpen(false)}>キャンセル</Button>
                <Button
                  type="button"
                  disabled={!saveFromProjectId || !saveFromName.trim() || saveFromTasks.length === 0 || saveFromLoading}
                  onClick={handleSaveFromProject}
                >
                  {saveFromLoading ? '保存中...' : 'テンプレートとして保存'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
