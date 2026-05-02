import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let resolved = false;

    const resolve = (valid: boolean) => {
      if (!resolved) {
        resolved = true;
        if (valid) setValidSession(true);
        setChecking(false);
      }
    };

    // すでにリカバリーセッションが存在する場合（PKCE code exchange済み）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) resolve(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        resolve(true);
      }
    });

    const timer = setTimeout(() => resolve(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError('パスワードの更新に失敗しました: ' + error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    }
    setLoading(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card">
        <p className="text-base-subtext">確認中...</p>
      </div>
    );
  }

  if (!validSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
        <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border text-center space-y-4">
          <p className="text-red-600">無効または期限切れのリンクです。</p>
          <p className="text-sm text-base-subtext">パスワード変更メールを再送してください。</p>
          <Button onClick={() => navigate('/')}>ホームへ</Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
        <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border text-center space-y-4">
          <p className="text-2xl">✓</p>
          <p className="text-base-text font-semibold">パスワードを変更しました</p>
          <p className="text-sm text-base-subtext">ダッシュボードへ移動します...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
      <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border space-y-6">
        <h2 className="text-xl font-bold text-base-text">新しいパスワードを設定</h2>
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">新しいパスワード（6文字以上）</label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">パスワードを再入力</label>
            <Input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '変更中...' : 'パスワードを変更する'}
          </Button>
        </form>
      </div>
    </div>
  );
};
