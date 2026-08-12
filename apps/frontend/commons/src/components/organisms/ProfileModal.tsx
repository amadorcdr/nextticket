import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Description, Input, Label, TextField } from "@heroui/react";
import { Check, KeyRound, Mail, Pencil, X } from "lucide-react";
import { ThemeSwitcher } from "../molecules/ThemeSwitcher";
import { useSession, type SessionRole } from "../../providers/SessionProvider";

export interface ProfileModalProps {
    open: boolean;
    onClose: () => void;
}

interface ProfileData {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
}

const ROLE_LABELS: Record<SessionRole, string> = {
    usuario: "Cliente",
    organizador: "Organizador",
    admin: "Administrador",
    validador: "Validador",
};

function splitName(fullName: string): { nombre: string; apellido: string } {
    const [nombre = "", ...rest] = fullName.trim().split(/\s+/);
    return { nombre, apellido: rest.join(" ") };
}

export function ProfileModal({ open, onClose }: ProfileModalProps) {
    const { user } = useSession();

    const initial: ProfileData = user
        ? { ...splitName(user.name), email: user.email, telefono: "" }
        : { nombre: "", apellido: "", email: "", telefono: "" };

    const [data, setData] = useState<ProfileData>(initial);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<ProfileData>(initial);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const startEdit = () => {
        setDraft(data);
        setEditing(true);
    };
    const saveEdit = () => {
        setData(draft);
        setEditing(false);
    };
    const cancelEdit = () => setEditing(false);

    const set = (k: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft((p) => ({ ...p, [k]: e.target.value }));

    const updatePassword = () => {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

    if (!open || !user) return null;

    const initials = `${data.nombre.charAt(0)}${data.apellido.charAt(0)}`.toUpperCase();
    const roleLabel = ROLE_LABELS[user.role];

    return createPortal(
        <>
            {/* Backdrop */}
            <div onClick={onClose} className="fixed inset-0 z-90 backdrop-blur-md" style={{ background: "var(--backdrop)" }} />

            {/* Modal */}
            <div className="fixed inset-0 z-91 flex items-center justify-center p-5 pointer-events-none">
                <div className="w-full max-w-130 max-h-[90vh] overflow-y-auto rounded-[20px] bg-surface border border-border shadow-overlay pointer-events-auto">
                    {/* Header */}
                    <div className="px-7 pt-6 border-b border-border">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3.5">
                                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground text-xl font-black select-none shrink-0">
                                    {initials}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-foreground font-bold text-lg">
                                            {data.nombre} {data.apellido}
                                        </p>
                                        <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded-full bg-default text-muted">
                                            {roleLabel}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {!editing ? (
                                    <Button size="sm" variant="secondary" onPress={startEdit}>
                                        <Pencil />
                                        Editar perfil
                                    </Button>
                                ) : (
                                    <>
                                        <Button size="sm" variant="ghost" onPress={cancelEdit}>
                                            Cancelar
                                        </Button>
                                        <Button size="sm" onPress={saveEdit}>
                                            <Check />
                                            Guardar
                                        </Button>
                                    </>
                                )}
                                <Button size="sm" variant="ghost" isIconOnly onPress={onClose}>
                                    <X />
                                </Button>
                            </div>
                        </div>

                        {/* Meta */}
                        <div className="flex gap-4 flex-wrap pb-4 text-muted text-xs">
                            <span className="flex items-center gap-1.5">
                                <Mail className="size-3.5" />
                                {data.email}
                            </span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="px-7 py-5 flex flex-col gap-6">
                        <div className="flex flex-col gap-3.5">
                            <p className="text-foreground font-bold text-sm">Datos personales</p>

                            <div className="grid grid-cols-2 gap-3.5">
                                <TextField isDisabled={!editing}>
                                    <Label>Nombre</Label>
                                    <Input value={editing ? draft.nombre : data.nombre} onChange={set("nombre")} />
                                </TextField>
                                <TextField isDisabled={!editing}>
                                    <Label>Apellido</Label>
                                    <Input value={editing ? draft.apellido : data.apellido} onChange={set("apellido")} />
                                </TextField>
                                <TextField isDisabled={!editing}>
                                    <Label>Correo electrónico</Label>
                                    <Input type="email" value={editing ? draft.email : data.email} onChange={set("email")} />
                                </TextField>
                                <TextField isDisabled={!editing}>
                                    <Label>Teléfono</Label>
                                    <Input value={editing ? draft.telefono : data.telefono} onChange={set("telefono")} />
                                </TextField>
                            </div>
                        </div>

                        <div className="w-full h-px bg-border" />

                        <div className="flex flex-col gap-3.5">
                            <div>
                                <p className="text-foreground font-bold text-sm">Apariencia</p>
                                <Description>Elige cómo se ve Nextticket en tu sesión</Description>
                            </div>
                            <ThemeSwitcher />
                        </div>

                        <div className="w-full h-px bg-border" />

                        <div className="flex flex-col gap-3.5">
                            <div>
                                <p className="text-foreground font-bold text-sm">Seguridad</p>
                                <Description>Actualiza la contraseña de tu cuenta</Description>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <TextField className="sm:col-span-2">
                                    <Label>Contraseña actual</Label>
                                    <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                                </TextField>
                                <TextField>
                                    <Label>Nueva contraseña</Label>
                                    <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                </TextField>
                                <TextField>
                                    <Label>Confirmar contraseña</Label>
                                    <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </TextField>
                            </div>
                            <div className="flex justify-end">
                                <Button size="sm" variant="secondary" onPress={updatePassword}>
                                    <KeyRound />
                                    Actualizar contraseña
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
