import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Icon, Input, Label, TextField } from "@nextticket-frontend/commons";
import { ROLE_LABELS, type AdminUser, type AdminUserRole, type AdminUserStatus } from "../types/user";

export type UserFormMode = "view" | "edit" | "create";

interface UserFormModalProps {
    open: boolean;
    mode: UserFormMode;
    user: AdminUser | null;
    onClose: () => void;
    onSave: (data: Omit<AdminUser, "id" | "createdAt">) => void;
}

const EMPTY: Omit<AdminUser, "id" | "createdAt"> = {
    firstName: "",
    lastName: "",
    email: "",
    role: "usuario",
    status: "active",
};

const ROLE_OPTIONS: AdminUserRole[] = ["usuario", "organizador", "admin", "validador"];

export function UserFormModal({ open, mode, user, onClose, onSave }: UserFormModalProps) {
    const [draft, setDraft] = useState<Omit<AdminUser, "id" | "createdAt">>(EMPTY);

    useEffect(() => {
        if (!open) return;
        setDraft(
            user
                ? { firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, status: user.status }
                : EMPTY
        );
    }, [open, user]);

    if (!open) return null;

    const isReadOnly = mode === "view";
    const title = mode === "create" ? "Crear usuario" : mode === "edit" ? "Editar usuario" : "Detalle de usuario";
    const initials = `${draft.firstName.charAt(0)}${draft.lastName.charAt(0)}`.toUpperCase() || "?";

    const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((p) => ({ ...p, [k]: e.target.value }));

    const handleSave = () => {
        onSave(draft);
        onClose();
    };

    return createPortal(
        <>
            <div onClick={onClose} className="fixed inset-0 z-90 backdrop-blur-md" style={{ background: "var(--backdrop)" }} />

            <div className="fixed inset-0 z-91 flex items-center justify-center p-5 pointer-events-none">
                <div className="w-full max-w-130 max-h-[90vh] overflow-y-auto rounded-[20px] bg-surface border border-border shadow-overlay pointer-events-auto">
                    <div className="px-7 pt-6 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground text-xl font-black select-none shrink-0">
                                    {initials}
                                </div>
                                <div>
                                    <p className="text-foreground font-bold text-lg">{title}</p>
                                    {user && <p className="text-muted text-xs mt-0.5">ID: {user.id}</p>}
                                </div>
                            </div>
                            <Button size="sm" variant="ghost" isIconOnly onPress={onClose}>
                                <Icon.X />
                            </Button>
                        </div>
                    </div>

                    <div className="px-7 py-5 flex flex-col gap-3.5">
                        <p className="text-foreground font-bold text-sm">Datos personales</p>

                        <div className="grid grid-cols-2 gap-3.5">
                            <TextField isDisabled={isReadOnly}>
                                <Label>Nombre</Label>
                                <Input value={draft.firstName} onChange={set("firstName")} />
                            </TextField>
                            <TextField isDisabled={isReadOnly}>
                                <Label>Apellidos</Label>
                                <Input value={draft.lastName} onChange={set("lastName")} />
                            </TextField>
                            <TextField isDisabled={isReadOnly} className="col-span-2">
                                <Label>Correo electrónico</Label>
                                <Input type="email" value={draft.email} onChange={set("email")} />
                            </TextField>

                            <div>
                                <Label>Rol</Label>
                                <select
                                    disabled={isReadOnly}
                                    value={draft.role}
                                    onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value as AdminUserRole }))}
                                    className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none disabled:opacity-60 cursor-pointer"
                                >
                                    {ROLE_OPTIONS.map((r) => (
                                        <option key={r} value={r}>
                                            {ROLE_LABELS[r]}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <Label>Estado</Label>
                                <select
                                    disabled={isReadOnly}
                                    value={draft.status}
                                    onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as AdminUserStatus }))}
                                    className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none disabled:opacity-60 cursor-pointer"
                                >
                                    <option value="active">Activo</option>
                                    <option value="inactive">Inactivo</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {!isReadOnly && (
                        <div className="flex gap-2 px-7 pb-6">
                            <Button size="sm" variant="secondary" fullWidth onPress={onClose}>
                                Cancelar
                            </Button>
                            <Button size="sm" fullWidth onPress={handleSave}>
                                {mode === "create" ? "Crear usuario" : "Guardar cambios"}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </>,
        document.body
    );
}
