import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

/**
 * ログイン中ユーザーのプロフィールを取得し、グローバルストアに保存する共通Hook。
 * App.tsx など最上位で一度だけ呼び出すことで、全画面でprofileが共有される。
 */
export const useProfile = () => {
  const { user, setProfile } = useAuthStore();

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile({ id: data.id, name: data.name, email: data.email });
      } else {
        // DBにprofileがない場合はauthのメールで代替
        setProfile({ id: user.id, name: null, email: user.email || '' });
      }
    };

    fetchProfile();
  }, [user, setProfile]);
};
