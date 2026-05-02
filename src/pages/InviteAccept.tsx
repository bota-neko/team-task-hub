import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { Button } from '../components/ui/Button';

const ROLE_LABELS: Record<string, string> = {
  admin: '管理者',
  member: 'メンバー',
  viewer: '閲覧者',
};

interface InvitationData {
  id: string;
  team_id: string;
  email: string;
  role: string;
  status: string;
  team_name: string;
}

export const InviteAccept: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  useEffect(() => {
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    if (!token) return;
    setPageLoading(true);

    const { data: inv, error } = await supabase
      .from('team_invitations')
      .select('id, team_id, email, role, status, team_name')
      .eq('token', token)
      .single();

    if (error || !inv) {
      setPageError('招待が見つかりません。リンクが正しいか確認してください。');
      setPageLoading(false);
      return;
    }

    setInvitation(inv as unknown as InvitationData);
    if (inv.email) setEmail(inv.email);
    setPageLoading(false);
  };

  const handleAccept = async () => {
    if (!user || !invitation) return;
    setAccepting(true);
    setPageError('');

    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', invitation.team_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!existing) {
      const { error: memberError } = await supabase.from('team_members').insert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role as 'admin' | 'member' | 'viewer',
      });

      if (memberError) {
        setPageError('チームへの参加に失敗しました: ' + memberError.message);
        setAccepting(false);
        return;
      }
    }

    await supabase
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    setAccepted(true);
    setAccepting(false);
    const timer = setTimeout(() => navigate('/'), 2000);
    return () => clearTimeout(timer);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setAuthError(error.message);
      } else {
        setAuthSuccess(
          `確認メールを送信しました。メール内のリンクをクリックしてアカウントを有効化した後、このページに再度アクセスしてログインしてください。`
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    }
    setAuthLoading(false);
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card">
        <p className="text-base-subtext">読み込み中...</p>
      </div>
    );
  }

  if (pageError && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
        <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border text-center space-y-4">
          <p className="text-red-600">{pageError}</p>
          <Button onClick={() => navigate('/')}>ホームへ</Button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
        <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border text-center space-y-4">
          <p className="text-2xl">🎉</p>
          <p className="text-base-text font-semibold">「{invitation?.team_name}」に参加しました！</p>
          <p className="text-sm text-base-subtext">ダッシュボードへ移動します...</p>
        </div>
      </div>
    );
  }

  if (invitation?.status === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
        <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border text-center space-y-4">
          <p className="text-base-text">この招待はすでに使用済みです。</p>
          <Button onClick={() => navigate('/')}>ホームへ</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
      <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border space-y-6">
        {/* 招待情報 */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-600 font-medium mb-1">チームへの招待</p>
          <p className="text-xl font-bold text-base-text">{invitation?.team_name}</p>
          <p className="text-sm text-base-subtext mt-1">
            役割: <span className="font-medium text-base-text">{ROLE_LABELS[invitation?.role ?? ''] ?? invitation?.role}</span>
          </p>
        </div>

        {user ? (
          <div className="space-y-4">
            <p className="text-sm text-base-subtext">
              <span className="font-medium text-base-text">{user.email}</span> でログイン中
            </p>
            {pageError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {pageError}
              </div>
            )}
            <Button onClick={handleAccept} disabled={accepting} className="w-full">
              {accepting ? '処理中...' : `「${invitation?.team_name}」に参加する`}
            </Button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full text-sm text-base-subtext hover:text-base-text underline"
            >
              別のアカウントでログイン
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => { setAuthMode('login'); setAuthError(''); setAuthSuccess(''); }}
                className={`flex-1 py-2 text-sm rounded-md border transition-colors ${authMode === 'login' ? 'bg-base-text text-base-bg border-base-text' : 'border-base-border text-base-subtext hover:border-base-text'}`}
              >
                ログイン
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthSuccess(''); }}
                className={`flex-1 py-2 text-sm rounded-md border transition-colors ${authMode === 'signup' ? 'bg-base-text text-base-bg border-base-text' : 'border-base-border text-base-subtext hover:border-base-text'}`}
              >
                新規登録
              </button>
            </div>

            {authError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{authError}</div>
            )}
            {authSuccess && (
              <div className="px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">{authSuccess}</div>
            )}

            {!authSuccess && (
              <form onSubmit={handleAuth} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-base-subtext mb-1">メールアドレス</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-base-text text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-base-subtext mb-1">パスワード</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-base-bg text-base-text text-sm"
                  />
                </div>
                <Button type="submit" disabled={authLoading} className="w-full">
                  {authLoading ? '処理中...' : authMode === 'login' ? 'ログインして参加する' : 'アカウントを作成'}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
