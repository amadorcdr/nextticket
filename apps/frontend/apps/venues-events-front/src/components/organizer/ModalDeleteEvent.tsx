import { IcoTrash } from './icons';
import { colors } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalDeleteEventProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModalDeleteEvent({ open, onClose, onConfirm, eventName }: ModalDeleteEventProps) {

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(11,15,16,0.75)',
          backdropFilter: 'blur(6px)',
          transition: 'opacity 0.25s ease',
          opacity: open ? 1 : 0,
        }}
      />

      {/* Dialog — centered */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 70,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 16px',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            background: colors.surfaceContainerLow,
            border: `1px solid ${colors.outlineVariant}`,
            borderRadius: 16,
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            pointerEvents: 'auto',
            transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            opacity: open ? 1 : 0,
            transform: open ? 'scale(1)' : 'scale(0.94)',
          }}
        >
          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 28 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: 'rgba(255,180,171,0.1)',
                border: '1px solid rgba(255,180,171,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.error,
              }}
            >
              <IcoTrash className="w-6 h-6" />
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: '16px 28px 24px', textAlign: 'center' }}>
            <h3 style={{ color: colors.white, fontWeight: 800, fontSize: 18, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              ¿Eliminar evento?
            </h3>
            <p style={{ color: colors.onSurfaceVariant, fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              Estás a punto de eliminar{' '}
              {eventName
                ? <strong style={{ color: colors.white }}>&ldquo;{eventName}&rdquo;</strong>
                : 'este evento'
              }
              . Esta acción no se puede deshacer.
            </p>
          </div>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: '0 24px 24px',
            }}
          >
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 10,
                background: 'none',
                border: `1px solid ${colors.outlineVariant}`,
                color: colors.onSurfaceVariant,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceContainerHigh)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              Cancelar
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              style={{
                flex: 1,
                padding: '9px 0',
                borderRadius: 10,
                background: `linear-gradient(135deg,${colors.errorContainer} 0%,${colors.errorContainerBright} 100%)`,
                border: 'none',
                color: colors.white,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(147,0,10,0.35)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
            >
              Sí, eliminar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
