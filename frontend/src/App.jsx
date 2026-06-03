import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ConnectionStatus from './components/ConnectionStatus';
import Dashboard from './pages/Dashboard';
import Parameters from './pages/Parameters';
import Sensors from './pages/Sensors';
import Plants from './pages/Plants';
import Fish from './pages/Fish';

const SCREENS = {
  dashboard: { title: 'Dashboard', component: Dashboard },
  parameters: { title: 'Parámetros', component: Parameters },
  sensors: { title: 'Estado de sensores', component: Sensors },
  plants: { title: 'Información de plantas', component: Plants },
  fish: { title: 'Información de peces', component: Fish },
};

export default function App() {
  const [route, setRoute] = useState('dashboard');
  const pageRef = useRef(null);

  const navigate = (next) => {
    if (next === route) return;
    gsap.to(pageRef.current, {
      opacity: 0,
      y: -10,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => setRoute(next),
    });
  };

  useEffect(() => {
    if (!pageRef.current) return;
    gsap.fromTo(
      pageRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
    );
  }, [route]);

  const ScreenComponent = SCREENS[route].component;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-4 sm:px-8 py-5 flex items-center justify-between gap-4 max-w-6xl mx-auto w-full">
        <nav className="hidden md:flex items-center gap-1 bg-white border border-black/10 rounded-full p-1 shadow-sm">
          {Object.keys(SCREENS).map((key) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={
                'px-4 py-1.5 rounded-full text-sm font-medium transition-all ' +
                (route === key
                  ? 'bg-ink text-white'
                  : 'text-ink/70 hover:text-ink')
              }
            >
              {SCREENS[key].title}
            </button>
          ))}
        </nav>

        <ConnectionStatus />
      </header>

      <main className="px-4 sm:px-8 pb-12 flex-1 w-full max-w-6xl mx-auto">
        <div ref={pageRef} className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 sm:p-10">
          <ScreenComponent navigate={navigate} />
        </div>
      </main>

      <footer className="text-center text-xs text-ink/50 pb-6">
        © 2026
      </footer>
    </div>
  );
}
