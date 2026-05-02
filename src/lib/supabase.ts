import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

// 型引数を外してDBとの不整合によるnever型エラーを回避
// 各ページで必要な型はimport type { Database }から個別に参照する
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
