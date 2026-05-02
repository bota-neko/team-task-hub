import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMessage('確認用メールを送信しました。リンクをクリックして登録を完了してください。');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-card px-4">
      <div className="max-w-md w-full bg-base-bg p-8 rounded-lg shadow-sm border border-base-border">
        <h2 className="text-2xl font-bold mb-6 text-center text-base-text">
          {isSignUp ? 'アカウント作成' : 'ログイン'}
        </h2>
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {successMessage}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-base-subtext mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-base-border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-base-text text-base-bg rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {loading ? '処理中...' : isSignUp ? '登録する' : 'ログインする'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMessage(''); }}
            className="text-sm text-base-subtext hover:text-base-text underline"
          >
            {isSignUp ? 'すでにアカウントをお持ちですか？ ログイン' : 'アカウントを持っていませんか？ 新規登録'}
          </button>
        </div>
      </div>
    </div>
  );
};
