import { createPortal } from "react-dom";
import { Button, Icon } from "@nextticket-frontend/commons";

interface ModalCancelEventProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventName?: string;
  canceling?: boolean;
}

/**
 * Baja lógica del evento (PATCH status=CANCELED), no un DELETE físico.
 * Es de un solo sentido: el backend no permite salir de CANCELED una vez
 * cancelado (ver events.service.ts#validateStatusTransition), así que no
 * hay acción de "reactivar" — igual que en un sistema de boletos real.
 */
export function ModalCancelEvent({ open, onClose, onConfirm, eventName, canceling }: ModalCancelEventProps) {
  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-60 backdrop-blur-md transition-opacity duration-200"
        style={{ background: "var(--backdrop)", opacity: open ? 1 : 0 }}
      />

      {/* Dialog — centered */}
      <div className="fixed inset-0 z-70 flex items-center justify-center px-4 pointer-events-none">
        <div
          className="w-full max-w-100 rounded-2xl pointer-events-auto transition-all duration-200 bg-surface border border-border shadow-overlay"
          style={{ opacity: open ? 1 : 0, transform: open ? "scale(1)" : "scale(0.94)" }}
        >
          {/* Icon */}
          <div className="flex justify-center pt-7">
            <div className="w-14 h-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
              <Icon.CalendarX2 className="size-6" />
            </div>
          </div>

          {/* Content */}
          <div className="px-7 pb-6 pt-4 text-center">
            <h3 className="text-foreground font-bold text-lg mb-2">¿Cancelar evento?</h3>
            <p className="text-muted text-sm leading-relaxed">
              Estás a punto de cancelar {eventName ? <strong className="text-foreground">"{eventName}"</strong> : "este evento"}. Pasará a
              estado Inactivo y no se mostrará como disponible. Los boletos ya vendidos no se ven afectados, pero esta acción no se puede
              deshacer.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 px-6 pb-6">
            <Button variant="secondary" fullWidth onPress={onClose} isDisabled={canceling}>
              Volver
            </Button>
            <Button fullWidth color="danger" onPress={onConfirm} isDisabled={canceling}>
              {canceling ? "Cancelando..." : "Sí, cancelar evento"}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
