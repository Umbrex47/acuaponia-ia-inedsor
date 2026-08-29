import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import ActuatorPanel from '../components/ActuatorPanel';
import AiReportPanel from '../components/AiReportPanel';
import ChatWindow from '../components/ChatWindow';
import FeederEditor from '../components/FeederEditor';
import ProposalPanel from '../components/ProposalPanel';
import { getOrCreateClientId } from '../hooks/useAssistant';

export default function Assistant() {
  const ref = useRef(null);
  const [clientId] = useState(getOrCreateClientId());
  const [proposalsCollapsed, setProposalsCollapsed] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('[data-anim="assistant-title"]', {
        opacity: 0,
        y: -10,
        duration: 0.5,
        ease: 'power2.out',
      });
      gsap.from('[data-anim="assistant-block"]', {
        opacity: 0,
        y: 14,
        duration: 0.5,
        ease: 'power2.out',
        stagger: 0.1,
        delay: 0.1,
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="space-y-6">
      <div data-anim="assistant-title" className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl">Asistente AquaGia</h1>
        <p className="text-xs text-ink/50 font-mono">client: {clientId.slice(0, 16)}…</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4" data-anim="assistant-block">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-ink/60">
            Chat
          </h2>
          <ChatWindow />
        </div>

        <div className="lg:col-span-1" data-anim="assistant-block">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-ink/60 mb-2">
            Cola de propuestas
          </h2>
          <ProposalPanel
            collapsed={proposalsCollapsed}
            onToggle={() => setProposalsCollapsed((v) => !v)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3" data-anim="assistant-block">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-ink/60">
            Actuadores
          </h2>
          <ActuatorPanel clientId={clientId} excludeIds={['dispensador_comida']} />
        </div>
        <div className="lg:col-span-1" data-anim="assistant-block">
          <h2 className="font-display font-semibold text-sm uppercase tracking-wider text-ink/60 mb-2">
            Dispensador
          </h2>
          <FeederEditor />
        </div>
      </div>

      <div data-anim="assistant-block">
        <AiReportPanel />
      </div>
    </div>
  );
}
