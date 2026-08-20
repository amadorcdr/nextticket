import { useEffect, useState } from "react";
import { Button, Description, Input, Label, TextField, toast } from "@heroui/react";
import { Check, Mail, Pencil } from "lucide-react";
import { ThemeSwitcher } from "../molecules/ThemeSwitcher";
import { useSession, type SessionRole } from "../../providers/SessionProvider";
import { API_BASE_URL, ApiError, useApi } from "../../providers/api";

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

/**
 * Página de perfil compartida por los 4 roles: cada shell la monta bajo su
 * propia ruta (/dashboard aparte para Admin, /organizer/profile, etc.) y le
 * agrega su propio breadcrumb — esta pieza es agnóstica de rol salvo por el
 * chip de rol que muestra.
 */
export function ProfilePage() {
    const { user, signIn } = useSession();
    const api = useApi();

    const initial: ProfileData = user ? { ...splitName(user.name), email: user.email } : { nombre: "", apellido: "", email: "" };

    const [data, setData] = useState<ProfileData>(initial);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState<ProfileData>(initial);
    const [saving, setSaving] = useState(false);

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Si cambia el usuario de la sesión, refleja lo último guardado.
    useEffect(() => {
        if (!user) return;
        const next = { ...splitName(user.name), email: user.email };
        setData(next);
        setDraft(next);
    }, [user]);

    const startEdit = () => {
        setDraft(data);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setEditing(true);
    };

    const cancelEdit = () => {
        setEditing(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
    };

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

        // El cambio de contraseña es opcional dentro de este mismo botón de
        // Guardar: solo se valida/aplica si el usuario tocó alguno de los tres
        // campos de la sección Seguridad.
        const wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);
        if (wantsPasswordChange) {
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
        }

        setSaving(true);
        try {
            if (wantsPasswordChange) {
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
                    setSaving(false);
                    return;
                }
                if (!verifyRes.ok) {
                    toast.danger("No se pudo verificar tu contraseña actual.");
                    setSaving(false);
                    return;
                }
            }

            await api.patch(`/users/${user.id}`, {
                name,
                email: draft.email.trim(),
                ...(wantsPasswordChange ? { password: newPassword } : {}),
            });

            setData(draft);
            setEditing(false);
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            signIn({ ...user, name, email: draft.email.trim() });
            toast.success(wantsPasswordChange ? "Perfil y contraseña actualizados" : "Perfil actualizado");
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo actualizar el perfil");
        } finally {
            setSaving(false);
        }
    };

    if (!user) return null;

    const initials = `${data.nombre.charAt(0)}${data.apellido.charAt(0)}`.toUpperCase();
    const roleLabel = ROLE_LABELS[user.role];

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            <div className="flex justify-between items-start flex-wrap gap-3">
                <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground text-xl font-black select-none shrink-0">
                        {initials}
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3>
                                {data.nombre} {data.apellido}
                            </h3>
                            <span className="uppercase text-[10px] font-semibold px-2 py-0.5 rounded-full bg-default text-muted">
                                {roleLabel}
                            </span>
                        </div>
                        <p className="text-muted text-xs flex items-center gap-1.5">
                            <Mail className="size-3.5" />
                            {data.email}
                        </p>
                    </div>
                </div>

                {!editing && (
                    <Button size="sm" variant="secondary" onPress={startEdit}>
                        <Pencil className="size-3.5" />
                        Editar perfil
                    </Button>
                )}
            </div>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <p className="text-foreground font-bold text-sm">Datos personales</p>
                <div className="grid sm:grid-cols-2 gap-3.5">
                    <TextField isDisabled={!editing}>
                        <Label>Nombre</Label>
                        <Input value={editing ? draft.nombre : data.nombre} onChange={set("nombre")} />
                    </TextField>
                    <TextField isDisabled={!editing}>
                        <Label>Apellido</Label>
                        <Input value={editing ? draft.apellido : data.apellido} onChange={set("apellido")} />
                    </TextField>
                    <TextField isDisabled={!editing} className="sm:col-span-2">
                        <Label>Correo electrónico</Label>
                        <Input type="email" value={editing ? draft.email : data.email} onChange={set("email")} />
                    </TextField>
                </div>
            </section>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <div>
                    <p className="text-foreground font-bold text-sm">Apariencia</p>
                    <Description>Elige cómo se ve Nextticket en tu sesión</Description>
                </div>
                <ThemeSwitcher />
            </section>

            <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                <div>
                    <p className="text-foreground font-bold text-sm">Seguridad</p>
                    <Description>
                        {editing ? "Deja estos campos vacíos si no quieres cambiar tu contraseña." : "Actualiza la contraseña de tu cuenta"}
                    </Description>
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
                        <TextField isDisabled={!editing} className="sm:col-span-2">
                            <Label>Contraseña actual</Label>
                            <Input
                                type="password"
                                autoComplete="current-password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </TextField>
                        <TextField isDisabled={!editing}>
                            <Label>Nueva contraseña</Label>
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </TextField>
                        <TextField isDisabled={!editing}>
                            <Label>Confirmar contraseña</Label>
                            <Input
                                type="password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </TextField>
                    </div>
                </form>
            </section>

            {editing && (
                <div className="flex gap-2 justify-end border-t border-border pt-3 pb-1">
                    <Button size="sm" variant="secondary" onPress={cancelEdit} isDisabled={saving}>
                        Cancelar
                    </Button>
                    <Button size="sm" onPress={saveEdit} isDisabled={saving}>
                        <Check className="size-3.5" />
                        {saving ? "Guardando..." : "Guardar"}
                    </Button>
                </div>
            )}
        </div>
    );
}
