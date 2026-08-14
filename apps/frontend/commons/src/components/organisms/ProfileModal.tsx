import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Description, Input, Label, TextField, toast } from "@heroui/react";
import { Check, KeyRound, Mail, Pencil, X } from "lucide-react";
import { ThemeSwitcher } from "../molecules/ThemeSwitcher";
import { useSession, type SessionRole } from "../../providers/SessionProvider";
import { API_BASE_URL, ApiError, useApi } from "../../providers/api";

export interface ProfileModalProps {
    open: boolean;
    onClose: () => void;
}

interface ProfileData {
    nombre: string;
    apellido: string;
    email: string;
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
    const { user, signIn } = useSession();
    const api = useApi();

    const initial: ProfileData = user ? { ...splitName(user.name), email: user.email } : { nombre: "", apellido: "", email: "" };

    const [data, setData] = useState<ProfileData>(initial);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<ProfileData>(initial);
    const [savingProfile, setSavingProfile] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPassword, setSavingPassword] = useState(false);

    // Si cambia el usuario de la sesión (o se reabre el modal), refleja lo último guardado.
    useEffect(() => {
        if (!user) return;
        const next = { ...splitName(user.name), email: user.email };
        setData(next);
        setDraft(next);
    }, [user, open]);

    const startEdit = () => {
        setDraft(data);
        setEditing(true);
    };
    const cancelEdit = () => setEditing(false);

    const set = (k: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft((p) => ({ ...p, [k]: e.target.value }));

    const saveEdit = async () => {
        if (!user?.id) {
            toast.danger("Tu sesión no tiene un id válido. Cierra sesión y vuelve a iniciarla.");
            return;
        }
        const name = `${draft.nombre.trim()} ${draft.apellido.trim()}`.trim();
        if (!name || !draft.email.trim()) {
            toast.danger("Nombre y correo son obligatorios.");
            return;
        }

        setSavingProfile(true);
        try {
            await api.patch(`/users/${user.id}`, { name, email: draft.email.trim() });
            setData(draft);
            setEditing(false);
            signIn({ ...user, name, email: draft.email.trim() });
            toast.success("Perfil actualizado");
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo actualizar el perfil");
        } finally {
            setSavingProfile(false);
        }
    };

    const updatePassword = async () => {
        if (!user?.id) {
            toast.danger("Tu sesión no tiene un id válido. Cierra sesión y vuelve a iniciarla.");
            return;
        }
        if (!currentPassword) {
            toast.danger("Ingresa tu contraseña actual.");
            return;
        }
        if (newPassword.length < 8) {
            toast.danger("La nueva contraseña debe tener al menos 8 caracteres.");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.danger("La confirmación no coincide con la nueva contraseña.");
            return;
        }

        setSavingPassword(true);
        try {
            // Verifica la contraseña actual llamando a /auth/login directo (sin
            // useApi): si se usara useApi y la contraseña actual estuviera mal,
            // el 401 dispararía su signOut() automático y cerraría la sesión
            // válida que ya tenía el usuario — justo lo que no queremos aquí.
            const verifyRes = await fetch(`${API_BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: user.email, password: currentPassword }),
            });
            if (verifyRes.status === 401) {
                toast.danger("Tu contraseña actual no es correcta.");
                return;
            }
            if (!verifyRes.ok) {
                toast.danger("No se pudo verificar tu contraseña actual.");
                return;
            }

            await api.patch(`/users/${user.id}`, { password: newPassword });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            toast.success("Contraseña actualizada");
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo actualizar la contraseña");
        } finally {
            setSavingPassword(false);
        }
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

                            <div className="flex items-center gap-1.5">
                                {!editing ? (
                                    <Button size="sm" variant="secondary" className="h-7 px-2.5 text-xs gap-1.5" onPress={startEdit}>
                                        <Pencil className="size-3.5" />
                                        Editar perfil
                                    </Button>
                                ) : (
                                    <>
                                        <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onPress={cancelEdit} isDisabled={savingProfile}>
                                            Cancelar
                                        </Button>
                                        <Button size="sm" className="h-7 px-2.5 text-xs gap-1.5" onPress={saveEdit} isDisabled={savingProfile}>
                                            <Check className="size-3.5" />
                                            {savingProfile ? "Guardando..." : "Guardar"}
                                        </Button>
                                    </>
                                )}
                                <Button size="sm" variant="ghost" isIconOnly className="size-7" onPress={onClose}>
                                    <X className="size-3.5" />
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
                                <TextField isDisabled={!editing} className="col-span-2">
                                    <Label>Correo electrónico</Label>
                                    <Input type="email" value={editing ? draft.email : data.email} onChange={set("email")} />
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
                            {/*
                                autoComplete="off" en el <form> es necesario: sin un formulario
                                propio, el navegador trata todos los inputs de la página como uno
                                solo y, al ver un campo type="password", autocompleta el texto más
                                cercano (p. ej. la barra de búsqueda de Eventos) con una credencial
                                guardada del sitio.
                            */}
                            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                    <TextField className="sm:col-span-2">
                                        <Label>Contraseña actual</Label>
                                        <Input
                                            type="password"
                                            autoComplete="current-password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                        />
                                    </TextField>
                                    <TextField>
                                        <Label>Nueva contraseña</Label>
                                        <Input
                                            type="password"
                                            autoComplete="new-password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                    </TextField>
                                    <TextField>
                                        <Label>Confirmar contraseña</Label>
                                        <Input
                                            type="password"
                                            autoComplete="new-password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </TextField>
                                </div>
                                <div className="flex justify-end mt-3.5">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-7 px-2.5 text-xs gap-1.5"
                                        onPress={updatePassword}
                                        isDisabled={savingPassword}
                                    >
                                        <KeyRound className="size-3.5" />
                                        {savingPassword ? "Actualizando..." : "Actualizar contraseña"}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
