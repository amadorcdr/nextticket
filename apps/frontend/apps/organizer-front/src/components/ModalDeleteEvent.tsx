import { createPortal } from "react-dom";
import { Button, Icon } from "@nextticket-frontend/commons";

interface ModalDeleteEventProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  eventName?: string;
}

export function ModalDeleteEvent({ open, onClose, onConfirm, eventName }: ModalDeleteEventProps) {
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
              <Icon.Trash2 className="size-6" />
            </div>
          </div>

          {/* Content */}
          <div className="px-7 pb-6 pt-4 text-center">
            <h3 className="text-foreground font-bold text-lg mb-2">¿Eliminar evento?</h3>
            <p className="text-muted text-sm leading-relaxed">
              Estás a punto de eliminar {eventName ? <strong className="text-foreground">"{eventName}"</strong> : "este evento"}
              . Esta acción no se puede deshacer.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2.5 px-6 pb-6">
            <Button variant="secondary" fullWidth onPress={onClose}>
              Cancelar
            </Button>
            <Button
              fullWidth
              color="danger"
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              Sí, eliminar
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
