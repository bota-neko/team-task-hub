import { create } from 'zustand';
import type { Database } from '../types/supabase';

type Team = Database['public']['Tables']['teams']['Row'];

interface TeamState {
  currentTeam: Team | null;
  teams: Team[];
  setCurrentTeam: (team: Team | null) => void;
  setTeams: (teams: Team[]) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  currentTeam: null,
  teams: [],
  setCurrentTeam: (team) => set({ currentTeam: team }),
  setTeams: (teams) => set({ teams }),
}));
