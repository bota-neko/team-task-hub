import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/auth';
import { useProfile } from './hooks/useProfile';
import { useTeams } from './hooks/useTeams';

import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { Kanban } from './pages/Kanban';
import { Templates } from './pages/Templates';
import { TaskList } from './pages/TaskList';
import { TeamSettings } from './pages/TeamSettings';
import { InviteAccept } from './pages/InviteAccept';

function AppInner() {
  useProfile();
  useTeams();
  return null;
}

function App() {
  const { setUser, setLoading, loading } = useAuthStore();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Supabase connection error:', err);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <Router>
      <AppInner />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/invite/:token" element={<InviteAccept />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<Kanban />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="templates" element={<Templates />} />
          <Route path="team-settings" element={<TeamSettings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
