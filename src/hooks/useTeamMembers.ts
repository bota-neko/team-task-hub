import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useTeamStore } from '../store/team';
import type { Database } from '../types/supabase';

type Role = Database['public']['Tables']['team_members']['Row']['role'];

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: Role | null;
}

export function useTeamMembers(): TeamMember[] {
  const { user, profile } = useAuthStore();
  const { currentTeam } = useTeamStore();
  const [rawMembers, setRawMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!currentTeam || !user) {
      setRawMembers([]);
      return;
    }

    const fetch = async () => {
      const { data: memberRows } = await supabase
        .from('team_members')
        .select('user_id, role')
        .eq('team_id', currentTeam.id);

      const rows = memberRows ?? [];
      const userIds = rows.map(m => m.user_id);

      if (!userIds.includes(user.id)) userIds.push(user.id);
      if (currentTeam.owner_id && !userIds.includes(currentTeam.owner_id)) {
        userIds.push(currentTeam.owner_id);
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      setRawMembers(
        userIds.map(uid => {
          const row = rows.find(r => r.user_id === uid);
          const dbProfile = profiles?.find(p => p.id === uid);
          return {
            id: uid,
            name: dbProfile?.name ?? null,
            email: dbProfile?.email ?? (uid === user.id ? (user.email ?? '') : ''),
            role: (row?.role as Role) ?? null,
          };
        })
      );
    };

    fetch();
  }, [currentTeam?.id, user?.id]);

  // Always reflect the auth store's profile for the current user (no race condition)
  return rawMembers.map(m =>
    m.id === user?.id && profile
      ? { ...m, name: profile.name ?? null, email: profile.email }
      : m
  );
}
