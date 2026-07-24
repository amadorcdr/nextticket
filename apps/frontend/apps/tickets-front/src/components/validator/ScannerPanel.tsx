// Las 3 piezas del flujo de escaneo manual: el visor decorativo, el form de
// folio y los botones de simulación. Siempre se usan juntas, en secuencia, en
// una sola página — no hacía falta un archivo por cada una.
import type { FormEvent } from 'react';
import type { ValidationResultType } from './data';

export function TicketScanner() {
  return (
    <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface-container-high shadow-[0_12px_32px_rgba(0,0,0,0.28)]">
      <div className="validator-scanner-line absolute inset-x-0 z-20" />

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

      <div className="absolute inset-0 opacity-45">
        <div className="h-full w-full bg-[radial-gradient(circle_at_center,_rgba(124,58,237,0.45),_rgba(16,20,21,0.95)_65%)]" />
      </div>

      <div className="absolute left-5 top-5 z-30 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-primary" />
      <div className="absolute right-5 top-5 z-30 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-primary" />
      <div className="absolute bottom-5 left-5 z-30 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-primary" />
      <div className="absolute bottom-5 right-5 z-30 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-primary" />

      <div className="z-30 flex flex-col items-center gap-1.5 rounded-full bg-black/50 px-6 py-3 text-primary backdrop-blur-md">
        <span className="text-xl">▣</span>
        <span className="text-xs font-semibold uppercase tracking-[0.25em]">
          Escaneando...
        </span>
      </div>
    </div>
  );
}

interface ManualFolioFormProps {
  folio: string;
  onFolioChange: (value: string) => void;
  onValidate: () => void;
}

export function ManualFolioForm({ folio, onFolioChange, onValidate }: ManualFolioFormProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onValidate();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative h-64 w-full rounded-xl overflow-hidden border border-white/10 bg-surface-card bg-gradient-to-br from-newsletter-from/15 via-newsletter-via/25 to-surface-card/95 p-6 flex flex-col justify-center gap-4"
    >
      <div className="z-10">
        <h2 className="font-bold text-base text-white mb-1">
          Validación manual
        </h2>

        <p className="text-newsletter-text text-xs leading-relaxed">
          Ingresa el folio del boleto para validar el acceso sin escanear el código QR.
        </p>
      </div>

      <div className="z-10 flex flex-col gap-2.5">
        <input
          id="folio-input"
          type="text"
          placeholder="Ej: EVT-2024-99XJ"
          value={folio}
          onChange={(event) => onFolioChange(event.target.value)}
          className="w-full bg-white/8 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/60 focus:ring-2 focus:ring-primary-container/70 outline-none font-mono"
        />

        <button
          type="submit"
          className="bg-primary-container text-white font-semibold px-3.5 py-2 rounded-lg hover:brightness-110 transition-all text-sm active:scale-95"
        >
          Validar boleto
        </button>
      </div>
    </form>
  );
}

export function SimulationControls({ onSimulate }: { onSimulate: (result: ValidationResultType) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border-t border-outline-variant pt-3 md:flex-row">
      <p className="text-xs font-semibold text-outline">
        Simular Escaneo:
      </p>

      <button
        type="button"
        onClick={() => onSimulate('success')}
        className="rounded border border-green-400/30 px-3.5 py-1.5 text-xs font-bold text-green-400 transition-colors hover:bg-green-400/10"
      >
        ÉXITO
      </button>

      <button
        type="button"
        onClick={() => onSimulate('rejected')}
        className="rounded border border-red-400/30 px-3.5 py-1.5 text-xs font-bold text-red-400 transition-colors hover:bg-red-400/10"
      >
        YA USADO
      </button>

      <button
        type="button"
        onClick={() => onSimulate('invalid')}
        className="rounded border border-yellow-400/30 px-3.5 py-1.5 text-xs font-bold text-yellow-400 transition-colors hover:bg-yellow-400/10"
      >
        INVÁLIDO
      </button>
    </div>
  );
}
