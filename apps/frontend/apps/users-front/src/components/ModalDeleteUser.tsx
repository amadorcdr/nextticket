import { createPortal } from "react-dom";
import { Button, Icon } from "@nextticket-frontend/commons";

interface ModalToggleUserStatusProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    userName?: string;
    /** Estado actual del usuario: si está activo, esta acción lo desactiva y viceversa. */
    isActive?: boolean;
}

export function ModalDeleteUser({ open, onClose, onConfirm, userName, isActive }: ModalToggleUserStatusProps) {
    if (!open) return null;

    const tone = isActive ? "danger" : "success";
    const title = isActive ? "¿Desactivar usuario?" : "¿Activar usuario?";
    const action = isActive ? "desactivar" : "activar";
    const confirmLabel = isActive ? "Sí, desactivar" : "Sí, activar";

    return createPortal(
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                className="fixed inset-0 z-90 backdrop-blur-md transition-opacity duration-200"
                style={{ background: "var(--backdrop)", opacity: open ? 1 : 0 }}
            />

            {/* Dialog — centered */}
            <div className="fixed inset-0 z-91 flex items-center justify-center px-4 pointer-events-none">
                <div
                    className="w-full max-w-100 rounded-2xl pointer-events-auto transition-all duration-200 bg-surface border border-border shadow-overlay"
                    style={{ opacity: open ? 1 : 0, transform: open ? "scale(1)" : "scale(0.94)" }}
                >
                    {/* Icon */}
                    <div className="flex justify-center pt-7">
                        <div
                            className={
                                isActive
                                    ? "w-14 h-14 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger"
                                    : "w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center text-success"
                            }
                        >
                            {isActive ? <Icon.UserX className="size-6" /> : <Icon.UserCheck className="size-6" />}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="px-7 pb-6 pt-4 text-center">
                        <h3 className="text-foreground font-bold text-lg mb-2">{title}</h3>
                        <p className="text-muted text-sm leading-relaxed">
                            Estás a punto de {action} a {userName ? <strong className="text-foreground">"{userName}"</strong> : "este usuario"}
                            . {isActive ? "No podrá iniciar sesión hasta que lo reactives." : "Podrá volver a iniciar sesión normalmente."}
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-2.5 px-6 pb-6">
                        <Button variant="secondary" fullWidth onPress={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            fullWidth
                            color={tone}
                            onPress={() => {
                                onConfirm();
                                onClose();
                            }}
                        >
                            {confirmLabel}
                        </Button>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
