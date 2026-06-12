import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
import { Icon } from './Icon';
import { apiConfig } from '../config/api';

const STORAGE_KEY = 'aquaponic-demo-notice-dismissed';

/**
 * Aviso que se muestra al cargar la página: informa que los datos del panel
 * son simulados con fines de demostración. Se recuerda la decisión durante la
 * sesión del navegador (sessionStorage) para no repetirlo en cada navegación.
 */
export default function DemoNoticeModal() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!apiConfig.demoMode) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      dismissed = false;
    }
    if (!dismissed) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: 'power2.out' }
      );
      tl.fromTo(
        cardRef.current,
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.4)',
          clearProps: 'opacity,transform',
        },
        '-=0.1'
      );
    }, overlayRef);

    const onKey = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      ctx.revert();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const handleClose = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // sin persistencia: el aviso volverá a mostrarse, no es crítico
    }
    const tl = gsap.timeline({ onComplete: () => setOpen(false) });
    tl.to(cardRef.current, {
      opacity: 0,
      y: 20,
      scale: 0.97,
      duration: 0.2,
      ease: 'power2.in',
    });
    tl.to(
      overlayRef.current,
      { opacity: 0, duration: 0.2, ease: 'power2.in' },
      '-=0.15'
    );
  };

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-notice-title"
    >
      <div
        ref={cardRef}
        className="bg-paper rounded-2xl border border-black/10 shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-start gap-4 p-6 border-b border-black/5">
          <div className="device-circle !w-14 !h-14 shrink-0 !bg-accent-amber/15">
            <Icon.Alert className="w-7 h-7 text-accent-amber" />
          </div>
          <div>
            <h2
              id="demo-notice-title"
              className="font-display font-bold text-xl leading-tight"
            >
              Modo demostración
            </h2>
            <p className="mt-1 text-sm font-medium text-ink/60">
              Datos simulados en tiempo real
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-ink/75 leading-relaxed">
            Los valores que verás en este panel{' '}
            <strong className="text-ink">no provienen de sensores reales</strong>.
            Se generan de forma automática con fines de{' '}
            <strong className="text-ink">demostración</strong> para mostrar el
            funcionamiento del sistema acuapónico.
          </p>
          <p className="text-ink/75 leading-relaxed text-sm">
            Las lecturas, alertas y el control de la bomba reflejan el
            comportamiento de la plataforma, pero los datos son ficticios.
          </p>

          <button
            onClick={handleClose}
            className="btn-outline w-full justify-center !bg-ink !text-white hover:!bg-ink/85"
          >
            Entendido, continuar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
