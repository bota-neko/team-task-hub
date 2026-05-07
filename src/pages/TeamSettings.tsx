import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useTeamStore } from '../store/team';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import type { Database } from '../types/supabase';
import { Copy, Check, Trash2 } from 'lucide-react';

type Role = Database['public']['Tables']['team_members']['Row']['role'];
type Invitation = Database['public']['Tables']['team_invitations']['Row'];

interface MemberRow {
  id: string;
  user_id: string;
  role: Role;
  name: string | null;
  email: string;
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

export const TeamSettings: React.FC = () => {
  const { user } = useAuthStore();
  const { currentTeam, teams, setTeams, setCurrentTeam } = useTeamStore();
  const navigate = useNavigate();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [newInviteUrl, setNewInviteUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // ワークスペース名編集
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [nameError, setNameError] = useState('');

  // ワークスペース削除
  const [deleteWorkspaceConfirm, setDeleteWorkspaceConfirm] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState('');

  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeam || !editName.trim()) return;
    setNameError('');
    const { error } = await supabase.from('teams').update({ name: editName.trim() }).eq('id', currentTeam.id);
    if (error) {
      setNameError('名前の変更に失敗しました');
    } else {
      const updated = { ...currentTeam, name: editName.trim() };
      setCurrentTeam(updated);
      setTeams(teams.map(t => t.id === currentTeam.id ? updated : t));
      setEditingName(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentTeam) return;
    setDeleteWorkspaceError('');
    const { error } = await supabase.from('teams').delete().eq('id', currentTeam.id);
    if (error) {
      setDeleteWorkspaceError('削除に失敗しました: ' + error.message);
      return;
    }
    const remaining = teams.filter(t => t.id !== currentTeam.id);
    setTeams(remaining);
    setCurrentTeam(remaining[0] ?? null);
    navigate('/');
  };

  useEffect(() => {
    if (currentTeam) {
      fetchMembers();
      fetchPendingInvitations();
    }
  }, [currentTeam]);

  const fetchMembers = async () => {
    if (!currentTeam) return;

    const { data: memberRows } = await supabase
      .from('team_members')
      .select('id, user_id, role')
      .eq('team_id', currentTeam.id);

    if (!memberRows || memberRows.length === 0) {
      setMembers([]);
      return;
    }

    const userIds = memberRows.map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIds);

    const combined = memberRows.map(m => {
      const profile = profiles?.find(p => p.id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        name: profile?.name ?? null,
        email: profile?.email ?? '',
      };
    });

    setMembers(combined);
  };

  const fetchPendingInvitations = async () => {
    if (!currentTeam) return;
    const { data } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', currentTeam.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingInvitations(data ?? []);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTeam || !user || !inviteEmail.trim()) return;
    setInviteError('');
    setInviteSuccess('');
    setNewInviteUrl('');
    setLoading(true);

    // メールからprofileを検索
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', inviteEmail.trim())
      .single();

    if (profile) {
      // 既にメンバーか確認
      const alreadyMember = members.some(m => m.user_id === profile.id);
      if (alreadyMember) {
        setInviteError('このユーザーはすでにチームメンバーです。');
        setLoading(false);
        return;
      }

      // 登録済みユーザーは直接追加
      const { error } = await supabase.from('team_members').insert({
        team_id: currentTeam.id,
        user_id: profile.id,
        role: inviteRole,
      });

      if (error) {
        setInviteError('追加に失敗しました。');
      } else {
        setInviteSuccess(`${profile.name || profile.email} をチームに追加しました。`);
        setInviteEmail('');
        fetchMembers();
      }
    } else {
      // 未登録ユーザー → 招待レコードを作成
      const alreadyInvited = pendingInvitations.some(
        inv => inv.email.toLowerCase() === inviteEmail.trim().toLowerCase()
      );
      if (alreadyInvited) {
        setInviteError('このメールアドレスにはすでに招待を送信済みです。');
        setLoading(false);
        return;
      }

      const { data: invitation, error } = await supabase
        .from('team_invitations')
        .insert({
          team_id: currentTeam.id,
          email: inviteEmail.trim(),
          role: inviteRole,
          invited_by: user.id,
          team_name: currentTeam.name,
        } as any)
        .select()
        .single();

      if (error || !invitation) {
        setInviteError('招待の作成に失敗しました: ' + (error?.message ?? '不明なエラー'));
      } else {
        const url = `${window.location.origin}/invite/${invitation.token}`;
        setNewInviteUrl(url);
        setInviteSuccess(
          `${inviteEmail.trim()} はまだ登録されていません。下の招待リンクを共有してください。`
        );
        setInviteEmail('');
        fetchPendingInvitations();
      }
    }
    setLoading(false);
  };

  const handleCopyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(id);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // クリップボードへのアクセスが拒否された場合は手動コピーを促す
    }
  };

  const handleDeleteInvitation = async (id: string) => {
    await supabase.from('team_invitations').delete().eq('id', id);
    setPendingInvitations(prev => prev.filter(inv => inv.id !== id));
    if (newInviteUrl) setNewInviteUrl('');
  };

  const handleChangeRole = async (memberId: string, newRole: Role) => {
    const { error } = await supabase
      .from('team_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (!error) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
    }
  };

  const handleRemoveMember = async (member: MemberRow) => {
    if (deleteConfirmId !== member.id) {
      setDeleteConfirmId(member.id);
      return;
    }

    const { error } = await supabase.from('team_members').delete().eq('id', member.id);
    if (!error) {
      setMembers(prev => prev.filter(m => m.id !== member.id));
      setDeleteConfirmId(null);
    }
  };

  if (!currentTeam) {
    return <div className="text-base-subtext">チームを選択してください。</div>;
  }

  const WorkspaceManagementCard = () => (
    <Card>
      <CardHeader>
        <CardTitle>ワークスペース管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 名前変更 */}
        {editingName ? (
          <form onSubmit={handleRenameWorkspace} className="space-y-2">
            <label className="block text-sm font-medium text-base-subtext">新しい名前</label>
            <div className="flex gap-2">
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder={currentTeam.name}
                required
                className="flex-1"
              />
              <Button type="submit" size="sm">保存</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingName(false)}>取消</Button>
            </div>
            {nameError && <p className="text-xs text-red-600">{nameError}</p>}
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-base-subtext mb-0.5">ワークスペース名</p>
              <p className="text-sm font-medium text-base-text">{currentTeam.name}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => { setEditName(currentTeam.name); setEditingName(true); setNameError(''); }}>
              名前を変更
            </Button>
          </div>
        )}

        {/* 削除 */}
        <div className="border-t border-base-border pt-4">
          {deleteWorkspaceError && (
            <p className="text-xs text-red-600 mb-2">{deleteWorkspaceError}</p>
          )}
          {deleteWorkspaceConfirm ? (
            <div className="space-y-2">
              <p className="text-sm text-red-600 font-medium">⚠️ 本当に削除しますか？</p>
              <p className="text-xs text-base-subtext">このワークスペースのプロジェクト・タスクがすべて削除されます。元に戻せません。</p>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={handleDeleteWorkspace}>削除する</Button>
                <Button size="sm" variant="ghost" onClick={() => setDeleteWorkspaceConfirm(false)}>取消</Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={() => setDeleteWorkspaceConfirm(true)}
            >
              ワークスペースを削除
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (currentTeam.type === 'personal') {
    return (
      <div className="space-y-6 max-w-2xl">
        <h2 className="text-2xl font-bold text-base-text">ワークスペース設定</h2>
        <WorkspaceManagementCard />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-base-text">チーム設定</h2>
      <p className="text-base-subtext text-sm">ワークスペース: <span className="font-medium text-base-text">{currentTeam.name}</span></p>

      {/* メンバー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>メンバー一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-base-subtext">メンバーがいません。</p>
          ) : (
            <ul className="divide-y divide-base-border">
              {(() => {
                const myRole = members.find(m => m.user_id === user?.id)?.role;
                const canManage = myRole === 'admin';
                return members.map(member => {
                  const isMe = member.user_id === user?.id;
                  const isOtherAdmin = !isMe && member.role === 'admin';
                  const displayName = member.name || member.email;
                  const canDelete = canManage && !isMe && !isOtherAdmin;
                  return (
                    <li key={member.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-base-border flex items-center justify-center text-sm font-medium text-base-text">
                          {displayName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-base-text">
                            {displayName}
                            {isMe && <span className="ml-1 text-xs text-base-subtext">（自分）</span>}
                          </div>
                          {member.name && (
                            <div className="text-xs text-base-subtext">{member.email}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManage && !isMe ? (
                          <select
                            value={member.role}
                            onChange={e => handleChangeRole(member.id, e.target.value as Role)}
                            className="text-xs border border-base-border rounded px-2 py-1 bg-base-bg"
                          >
                            <option value="admin">管理者</option>
                            <option value="member">メンバー</option>
                            <option value="viewer">閲覧者</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[member.role]}`}>
                            {ROLE_LABELS[member.role]}
                          </span>
                        )}

                        {canDelete && (
                          deleteConfirmId === member.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600">削除しますか？</span>
                              <Button size="sm" variant="danger" onClick={() => handleRemoveMember(member)}>削除</Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>取消</Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => handleRemoveMember(member)} className="text-red-500 hover:text-red-600">
                              削除
                            </Button>
                          )
                        )}
                      </div>
                    </li>
                  );
                });
              })()}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 保留中の招待 */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>保留中の招待</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-base-border">
              {pendingInvitations.map(inv => {
                const url = `${window.location.origin}/invite/${inv.token}`;
                const isCopied = copiedToken === inv.id;
                return (
                  <li key={inv.id} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-base-text">{inv.email}</p>
                        <p className="text-xs text-base-subtext">
                          {ROLE_LABELS[inv.role as Role] ?? inv.role} ·{' '}
                          {new Date(inv.created_at).toLocaleDateString('ja-JP')} 招待
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteInvitation(inv.id)}
                        className="p-1.5 text-base-subtext hover:text-red-500 rounded-md"
                        title="招待を取り消す"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 bg-base-card rounded-md px-3 py-2 border border-base-border">
                      <span className="text-xs text-base-subtext flex-1 truncate">{url}</span>
                      <button
                        onClick={() => handleCopyUrl(url, inv.id)}
                        className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        {isCopied ? 'コピー済み' : 'コピー'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ワークスペース管理 */}
      <WorkspaceManagementCard />

      {/* メンバー招待 */}
      <Card>
        <CardHeader>
          <CardTitle>メンバーを招待</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-base-subtext mb-4">
            登録済みユーザーはすぐに追加されます。未登録の場合は招待リンクを発行します。
          </p>
          {inviteError && (
            <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{inviteError}</div>
          )}
          {inviteSuccess && (
            <div className="mb-3 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
              {inviteSuccess}
            </div>
          )}
          {/* 新しく生成された招待URL */}
          {newInviteUrl && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-medium text-base-subtext">招待リンク</p>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                <span className="text-xs text-blue-700 flex-1 break-all">{newInviteUrl}</span>
                <button
                  onClick={() => handleCopyUrl(newInviteUrl, 'new')}
                  className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                >
                  {copiedToken === 'new' ? <Check size={12} /> : <Copy size={12} />}
                  {copiedToken === 'new' ? 'コピー済み' : 'コピー'}
                </button>
              </div>
            </div>
          )}
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">メールアドレス</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="example@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-base-subtext mb-1">役割</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as Role)}
                className="w-full border border-base-border rounded-md px-3 py-2 bg-base-bg text-sm"
              >
                <option value="admin">管理者 - 全ての操作が可能</option>
                <option value="member">メンバー - タスクの作成・編集が可能</option>
                <option value="viewer">閲覧者 - 閲覧のみ</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>
                {loading ? '処理中...' : '追加 / 招待リンクを発行'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
