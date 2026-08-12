import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Icon, Input, InputGroup, Label, TextField, Tooltip } from "@nextticket-frontend/commons";
import { ROLE_LABELS, type AdminUser, type AdminUserRole } from "../types/user";

export type UserFormMode = "edit" | "create";

export interface UserFormValues {
    name: string;
    email: string;
    role: AdminUserRole;
    /** Solo se envía si se llenó: en editar es opcional, en crear es obligatorio. */
    password: string;
}

interface UserFormModalProps {
    open: boolean;
    mode: UserFormMode;
    user: AdminUser | null;
    saving: boolean;
    onClose: () => void;
    onSave: (data: UserFormValues) => void;
}

const EMPTY: UserFormValues = { name: "", email: "", role: "usuario", password: "" };

const ROLE_OPTIONS: AdminUserRole[] = ["usuario", "organizador", "admin", "validador"];

export function UserFormModal({ open, mode, user, saving, onClose, onSave }: UserFormModalProps) {
    const [draft, setDraft] = useState<UserFormValues>(EMPTY);
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (!open) return;
        setDraft(user ? { name: user.name, email: user.email, role: user.role, password: "" } : EMPTY);
        setShowPassword(false);
    }, [open, user]);

    if (!open) return null;

    const isCreate = mode === "create";
    const title = isCreate ? "Crear Usuario" : "Editar Usuario";
    const subtitle = isCreate ? "Da de alta una nueva cuenta en la plataforma." : "Modifica los datos de la cuenta.";

    const set = (k: "name" | "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((p) => ({ ...p, [k]: e.target.value }));

    const canSave = draft.name.trim() && draft.email.trim() && (!isCreate || draft.password.trim().length >= 8);

    const handleSave = () => {
        if (!canSave) return;
        onSave(draft);
    };

    return createPortal(
        <>
            {/* Backdrop */}
            <div onClick={onClose} className="fixed inset-0 z-90 backdrop-blur-md" style={{ background: "var(--backdrop)" }} />

            {/* Panel — slides in from right, altura completa */}
            <aside className="fixed top-0 right-0 h-full w-full max-w-100 z-91 flex flex-col bg-surface border-l border-border rounded-l-2xl shadow-overlay">
                {/* Header */}
                <div className="flex justify-between items-start px-5 py-4 border-b border-border shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                            {isCreate ? <Icon.UserPlus className="size-5" /> : <Icon.UserCog className="size-5" />}
                        </div>
                        <div>
                            <h4 className="text-foreground font-bold">{title}</h4>
                            <p className="text-muted text-xs mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" isIconOnly onPress={onClose}>
                        <Icon.X />
                    </Button>
                </div>

                {/* Form body — centrado verticalmente para no dejar un hueco muerto al fondo */}
                <div className="relative flex-1 overflow-y-auto">
                    <div className="relative z-10 px-6 py-4 flex flex-col justify-center gap-5 min-h-full">
                        <TextField isRequired name="nombre">
                            <Label>Nombre completo</Label>
                            <Input placeholder="Ej: Juan Pérez" value={draft.name} onChange={set("name")} />
                        </TextField>

                        <TextField isRequired name="email" type="email">
                            <Label>Correo electrónico</Label>
                            <Input placeholder="nombre@ejemplo.com" value={draft.email} onChange={set("email")} />
                        </TextField>

                        <TextField name="password">
                            <div className="flex items-center gap-1">
                                <Label>{isCreate ? "Contraseña" : "Nueva contraseña (opcional)"}</Label>
                                <Tooltip>
                                    <Tooltip.Trigger>
                                        <Icon.Info className="size-3.5 text-muted" />
                                    </Tooltip.Trigger>
                                    <Tooltip.Content>Mínimo 8 caracteres</Tooltip.Content>
                                </Tooltip>
                            </div>
                            <InputGroup>
                                <InputGroup.Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={draft.password}
                                    onChange={set("password")}
                                />
                                <InputGroup.Suffix>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="text-muted hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <Icon.EyeOff className="size-4" /> : <Icon.Eye className="size-4" />}
                                    </button>
                                </InputGroup.Suffix>
                            </InputGroup>
                        </TextField>

                        <div>
                            <Label>Rol</Label>
                            <select
                                value={draft.role}
                                onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value as AdminUserRole }))}
                                className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
                            >
                                {ROLE_OPTIONS.map((r) => (
                                    <option key={r} value={r}>
                                        {ROLE_LABELS[r]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 py-3 border-t border-border shrink-0">
                    <Button size="sm" variant="secondary" fullWidth onPress={onClose} isDisabled={saving}>
                        Cancelar
                    </Button>
                    <Button size="sm" fullWidth onPress={handleSave} isDisabled={!canSave || saving}>
                        {saving ? "Guardando..." : isCreate ? "Crear Usuario" : "Guardar Cambios"}
                    </Button>
                </div>
            </aside>
        </>,
        document.body
    );
}
