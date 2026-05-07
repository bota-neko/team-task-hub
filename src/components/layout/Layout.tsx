import React, { useState } from 'react';
import { Outlet, Navigate, NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useTeamStore } from '../../store/team';
import { supabase } from '../../lib/supabase';
import { LayoutDashboard, Folder, KanbanSquare, Settings, LogOut, User as UserIcon, Menu, X, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export const Layout: React.FC = () => {
  const { user, profile, setProfile } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const isTeam = currentTeam?.type === 'team';

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const displayName = profile?.name || profile?.email || user.email || '';

  const NAV_ITEMS = [
    { to: '/', label: 'ダッシュボード', icon: LayoutDashboard, end: true },
    { to: '/tasks', label: 'タスク一覧', icon: KanbanSquare, end: false },
    { to: '/projects', label: 'プロジェクト', icon: Folder, end: false },
    { to: '/templates', label: 'テンプレート', icon: Settings, end: false },
    { to: '/team-settings', label: isTeam ? 'チーム設定' : 'ワークスペース設定', icon: Users, end: false },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileError('');

    const email = profile?.email || user.email || '';
    const { error } = await supabase.from('profiles').upsert({ id: user.id, email, name: editName });
    if (!error) {
      setProfile({ id: user.id, name: editName, email });
      setIsProfileModalOpen(false);
    } else {
      setProfileError('プロフィールの更新に失敗しました: ' + error.message);
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-base-border flex items-center justify-between">
        <h1 className="text-lg font-bold text-base-text">タスク管理システム</h1>
        <button
          onClick={() => setSidebarOpen(false)}
          className="md:hidden p-1 rounded-md hover:bg-base-border text-base-subtext"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 p-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-base-text text-base-bg'
                  : 'hover:bg-base-border text-base-text'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-base-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 p-2 w-full text-left rounded-md hover:bg-base-border transition-colors text-red-500"
        >
          <LogOut size={20} />
          <span>ログアウト</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-base-bg">
      {/* デスクトップ サイドバー */}
      <aside className="hidden md:flex w-64 border-r border-base-border bg-base-card flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* モバイル ドロワー */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-base-card border-r border-base-border flex flex-col z-50">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto min-w-0">
        <header className="h-14 border-b border-base-border flex items-center justify-between px-4 bg-base-bg sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-md hover:bg-base-border text-base-subtext"
          >
            <Menu size={20} />
          </button>
          <span className="md:hidden text-sm font-semibold text-base-text">タスク管理システム</span>

          <div className="hidden md:block" />

          <button
            onClick={() => {
              setEditName(profile?.name || '');
              setProfileError('');
              setResetSent(false);
              setIsProfileModalOpen(true);
            }}
            className="flex items-center gap-2 text-sm text-base-subtext hover:text-blue-500 transition-colors bg-base-card px-3 py-1.5 rounded-full border border-base-border"
          >
            <UserIcon size={16} />
            <span className="hidden sm:inline">ようこそ、{displayName} さん</span>
            <span className="sm:hidden">{profile?.name || displayName.split('@')[0]}</span>
          </button>
        </header>
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>

      <Modal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} title="プロフィール設定">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          {profileError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {profileError}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">表示名</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="あなたの名前"
              className="w-full bg-base-bg text-sm"
            />
          </div>
          <div className="text-xs text-base-subtext">
            メールアドレス: {profile?.email || user.email}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setIsProfileModalOpen(false)}>キャンセル</Button>
            <Button type="submit">保存</Button>
          </div>
          <div className="border-t border-base-border pt-4">
            <p className="text-xs text-base-subtext mb-2">パスワードを変更する場合は確認メールを送信します。</p>
            {resetSent ? (
              <p className="text-xs text-green-600">確認メールを送信しました。メール内のリンクをクリックしてください。</p>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  const email = profile?.email || user.email || '';
                  await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  setResetSent(true);
                }}
                className="text-xs text-blue-500 hover:text-blue-600 underline"
              >
                パスワード変更メールを送信
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
