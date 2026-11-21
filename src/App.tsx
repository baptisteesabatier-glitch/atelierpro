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

export default function App() {
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
              transition={reduce ? { duration: 0.16 } : { type: 'spring', bounce: 0, duration: 0.4 }}
            >
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/reparations" element={<Repairs />} />
                <Route path="/clients" element={<Clients />} />
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
  );
}
