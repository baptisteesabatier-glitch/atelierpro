import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import MobileNav from './components/MobileNav';
import CommandPalette from './components/CommandPalette';
import Toaster from './components/Toaster';
import Dashboard from './pages/Dashboard';
import Repairs from './pages/Repairs';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Login from './pages/Login';
import TrackingPage from './pages/Tracking';
import { useAuth } from './lib/auth';
import { WorkspaceProvider } from './lib/workspace';

function Splash() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <span className="splash__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
          <path
            d="M7 22.5V13a9 9 0 0 1 18 0v9.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M7 22.5h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="17.4" r="2.1" fill="currentColor" />
        </svg>
      </span>
      <p className="splash__text">Ouverture de l’atelier…</p>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <WorkspaceProvider>
      <div className="app">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="app__main">
          <TopBar
            onOpenNav={() => setNavOpen(true)}
            onOpenSearch={() => setPaletteOpen(true)}
          />

          <main className="view" id="contenu">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={location.pathname}
                className="view__inner"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={
                  reduce ? { duration: 0.16 } : { type: 'spring', bounce: 0, duration: 0.4 }
                }
              >
                <Routes location={location}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/reparations" element={<Repairs />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/utilisateurs" element={<Users />} />
                  <Route path="/parametres" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </motion.div>
            </AnimatePresence>
          </main>

          <MobileNav />
        </div>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <Toaster />
      </div>
    </WorkspaceProvider>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;

  return (
    <>
      <Routes>
        <Route path="/suivi/:token" element={<TrackingPage />} />
        <Route path="*" element={user ? <Shell /> : <Login />} />
      </Routes>
      {!user && <Toaster />}
    </>
  );
}
