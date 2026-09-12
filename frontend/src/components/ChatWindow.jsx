import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useAssistant } from '../hooks/useAssistant';

export default function ChatWindow() {
  const { status, messages, pending, send, reset } = useAssistant();
  const [input, setInput] = useState('');
  const messagesRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, pending]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    send(input);
    setInput('');
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-black/10 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-black/5 bg-paper">
        <div className="flex items-center gap-2">
          <span
            className={
              'w-2 h-2 rounded-full ' +
              (status.connected ? 'bg-accent-green animate-pulse' : 'bg-accent-amber')
            }
          />
          <span className="text-xs font-medium text-ink/70">
            {status.connected ? 'Asistente conectado' : status.error || 'Desconectado'}
          </span>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-ink/50 hover:text-ink"
        >
          Nueva conversación
        </button>
      </div>

      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-paper/40"
        style={{ minHeight: '320px', maxHeight: '480px' }}
      >
        {messages.length === 0 && (
          <div className="text-sm text-ink/50 italic">
            Pregúntale al asistente: "¿Está todo bien en el sistema?", "Enciende el aireador", "Reprograma el dispensador a las 9, 14 y 19 horas".
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-xs text-ink/50 pl-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink/40 animate-pulse" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink/40 animate-pulse" style={{ animationDelay: '0.15s' }} />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink/40 animate-pulse" style={{ animationDelay: '0.3s' }} />
            pensando…
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-black/5 p-2 flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta o solicitud..."
          className="flex-1 border border-black/10 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
        />
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 rounded-md bg-ink text-white text-sm font-semibold disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }) {
  if (message.role === 'system') {
    return (
      <div className="text-center text-xs text-ink/50 italic">
        {message.content}
      </div>
    );
  }
  const isAssistant = message.role === 'assistant';
  return (
    <div className={'flex ' + (isAssistant ? 'justify-start' : 'justify-end')}>
      <div
        className={
          'max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ' +
          (isAssistant
            ? 'bg-white border-l-2 border-accent-blue shadow-sm'
            : 'bg-ink text-white')
        }
      >
        {message.content}
        {Array.isArray(message.toolCalls) && message.toolCalls.length > 0 && (
          <div className="mt-2 pt-2 border-t border-black/10 text-[11px] text-ink/60 font-mono">
            {message.toolCalls.map((t, i) => (
              <div key={i}>
                → {t.name}{' '}
                <span className={t.ok ? 'text-accent-green' : 'text-accent-red'}>
                  {t.ok ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
