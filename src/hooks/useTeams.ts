import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';
import { useTeamStore } from '../store/team';

export const useTeams = () => {
  const { user } = useAuthStore();
  const { currentTeam, setTeams, setCurrentTeam } = useTeamStore();

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setCurrentTeam(null);
      return;
    }

    const fetchTeams = async () => {
      const { data } = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setTeams(data);
        if (data.length > 0 && !currentTeam) {
          setCurrentTeam(data[0]);
        }
      }
    };

    fetchTeams();
  }, [user?.id]);
};
