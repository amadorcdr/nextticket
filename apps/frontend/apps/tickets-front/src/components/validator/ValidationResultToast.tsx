// Los 3 resultados de validación (éxito/rechazado/inválido) son la misma
// tarjeta con distinto tono, ícono y contenido — un componente parametrizado
// en vez de 3 archivos casi idénticos. Se muestra como toast (no bloquea la
// pantalla) porque el validador necesita seguir escaneando boletos rápido.
// El mensaje siempre es una sola línea (con truncate) para que el toast mida
// siempre lo mismo, sin importar el resultado.
import { useEffect, useState } from 'react';
import { successTicketData, rejectedTicketData, type ValidationResultType } from './data';

const AUTO_DISMISS_MS = 4000;

type Tone = Exclude<ValidationResultType, null>;

const TONE_STYLES: Record<Tone, { border: string; iconBg: string; iconText: string; title: string }> = {
  success: { border: 'border-green-500', iconBg: 'bg-green-500', iconText: 'text-black', title: 'text-green-400' },
  rejected: { border: 'border-red-500', iconBg: 'bg-red-500', iconText: 'text-white', title: 'text-red-400' },
  invalid: { border: 'border-yellow-500', iconBg: 'bg-yellow-500', iconText: 'text-black', title: 'text-yellow-500' },
};

const TITLES: Record<Tone, string> = {
  success: 'Acceso permitido',
  rejected: 'Boleto ya usado',
  invalid: 'Folio no encontrado',
};

const ICONS: Record<Tone, string> = {
  success: '✓',
  rejected: '×',
  invalid: '!',
};

const MESSAGES: Record<Tone, string> = {
  success: `${successTicketData.assistant} · ${successTicketData.zone} · ${successTicketData.folio}`,
  rejected: `${rejectedTicketData.message} Ubicación: ${rejectedTicketData.location}`,
  invalid: 'Verifica los dígitos ingresados e intenta de nuevo.',
};

export function ValidationResultToast({ result, onReset }: { result: ValidationResultType; onReset: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!result) return;

    setVisible(false);
    const showTimer = window.setTimeout(() => setVisible(true), 10);
    const dismissTimer = window.setTimeout(onReset, AUTO_DISMISS_MS);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (!result) return null;

  const s = TONE_STYLES[result];

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <div
        className={`flex h-14 w-72 items-center gap-2.5 rounded-lg border ${s.border} bg-surface-container-low px-3 shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${s.iconBg} ${s.iconText} text-xs font-bold`}>
          {ICONS[result]}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-xs font-extrabold leading-tight ${s.title}`}>{TITLES[result]}</p>
          <div className="overflow-hidden">
            <div className="validator-toast-marquee flex w-max gap-12">
              <span className="text-[11px] leading-tight text-on-surface-variant whitespace-nowrap">{MESSAGES[result]}</span>
              <span className="text-[11px] leading-tight text-on-surface-variant whitespace-nowrap" aria-hidden="true">{MESSAGES[result]}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          aria-label="Cerrar notificación"
          className="flex-shrink-0 text-xs text-on-surface-faint transition-colors hover:text-on-surface-variant"
        >
          ✕
        </button>
      </div>

      <style>{`
        @keyframes validator-toast-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .validator-toast-marquee {
          animation: validator-toast-marquee 5s linear infinite;
        }
      `}</style>
    </div>
  );
}
