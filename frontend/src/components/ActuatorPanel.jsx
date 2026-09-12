import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ActuatorCard from './ActuatorCard';
import { useActuators } from '../hooks/useActuators';

export default function ActuatorPanel({ clientId, excludeIds = [] }) {
  const { actuators, execute, setMode, acquireLock, releaseLock } = useActuators();
  const visibleActuators = actuators.filter((a) => !excludeIds.includes(a.id));
  const ref = useRef(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="actuator-card"]', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.08,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleExecute = async (id, action, reason) => {
    await acquireLock(id, clientId);
    const result = await execute(id, action, reason);
    await releaseLock(id, clientId);
    setFeedback(
      result.ok
        ? { ok: true, message: `${id} → ${action}` }
        : { ok: false, message: result.reason || 'No se pudo ejecutar' },
    );
  };

  const handleMode = async (id, mode) => {
    const result = await setMode(id, mode);
    setFeedback(
      result.ok
        ? { ok: true, message: `${id} → modo ${mode}` }
        : { ok: false, message: result.reason || 'No se pudo cambiar modo' },
    );
  };

  return (
    <div ref={ref} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {visibleActuators.map((a) => (
          <ActuatorCard
            key={a.id}
            actuator={a}
            clientId={clientId}
            onExecute={handleExecute}
            onModeChange={handleMode}
          />
        ))}
      </div>
      {feedback && (
        <div
          className={
            'text-sm px-3 py-2 rounded-md border ' +
            (feedback.ok
              ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
              : 'bg-accent-red/10 text-accent-red border-accent-red/30')
          }
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
