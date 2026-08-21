import { useEffect, useState, FormEvent } from "react";
import { Button, Input, Label, TextField, FieldError, Form, toast, Avatar, Description, Surface } from "@heroui/react";
import { Check, Pencil } from "lucide-react";
import { ThemeSwitcher } from "../molecules/ThemeSwitcher";
import { useSession } from "../../providers/SessionProvider";
import { API_BASE_URL, ApiError, useApi } from "../../providers/api";

interface ProfileData {
    nombre: string;
    apellido: string;
    email: string;
}

function splitName(fullName: string): { nombre: string; apellido: string } {
    const [nombre = "", ...rest] = fullName.trim().split(/\s+/);
    return { nombre, apellido: rest.join(" ") };
}

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

    const handleDraftChange = (k: keyof ProfileData, val: string) =>
        setDraft((p) => ({ ...p, [k]: val }));

    const saveEdit = async (e?: FormEvent) => {
        if (e) e.preventDefault();

        if (!user?.id) {
            toast.danger("Tu sesión no tiene un id válido.");
            return;
        }
        const name = `${draft.nombre.trim()} ${draft.apellido.trim()}`.trim();
        if (!name || !draft.email.trim()) {
            toast.danger("Nombre y correo son obligatorios.");
            return;
        }

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

    return (
        <div className="flex-1 w-full h-full p-4 md:p-8 lg:p-12 overflow-y-auto animate-in fade-in duration-500">
            <div className="w-full max-w-6xl mx-auto flex flex-col md:flex-row gap-6 lg:gap-8">

                {/* Panel lateral / Info general */}
                <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-6">
                    <Surface className="flex flex-col items-center text-center gap-5 bg-background shadow-overlay rounded-[10px] p-8 pointer-events-auto">
                        <Avatar className="w-32 h-32 rounded-full border-[4px] border-background shadow-sm text-4xl font-black shrink-0">
                            <Avatar.Fallback className="bg-default text-muted text-2xl">{initials}</Avatar.Fallback>
                        </Avatar>

                        <div className="flex flex-col items-center gap-2">
                            <h2>Perfil</h2>
                        </div>
                    </Surface>

                    <Surface className="flex flex-col gap-4 bg-background shadow-overlay rounded-[10px] p-6 pointer-events-auto">
                        <div className="flex flex-col gap-1">
                            <h2 className="font-bold text-foreground">Apariencia</h2>
                            <p className="text-xs text-muted">Elige el aspecto visual de tu sesión</p>
                        </div>
                        <div className="flex items-center justify-between bg-surface-secondary/50 p-3 rounded-lg border border-border/50">
                            <Label className="text-sm font-semibold text-foreground m-0">Tema visual</Label>
                            <ThemeSwitcher />
                        </div>
                    </Surface>
                </div>

                {/* Formulario Principal */}
                <Surface className="flex-1 flex flex-col bg-background shadow-overlay rounded-[10px] p-8 sm:p-10 pointer-events-auto">
                    <Form className="flex flex-col gap-8 w-full" onSubmit={saveEdit}>

                        {/* Acciones */}
                        <div className="flex justify-end gap-3 pb-2 mb-2">
                            {!editing ? (
                                <Button variant="tertiary" onPress={startEdit} className="w-full sm:w-auto px-8">
                                    <Pencil className="size-4" /> Editar información
                                </Button>
                            ) : (
                                <>
                                    <Button variant="tertiary" onPress={cancelEdit} isDisabled={saving} className="w-full sm:w-auto">
                                        Cancelar
                                    </Button>
                                    <Button type="submit" isDisabled={saving} className="w-full sm:w-auto px-8">
                                        <Check className="size-4" /> {saving ? "Guardando..." : "Guardar cambios"}
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Datos Personales */}
                        <div className="flex flex-col gap-5">
                            <div className="pb-2 border-b border-border/50">
                                <h2 className="text-lg font-bold text-foreground">Datos Personales</h2>
                                <p className="text-sm text-muted">Administra tu información básica de contacto.</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-5">
                                <TextField
                                    isDisabled={!editing}
                                    name="nombre"
                                    value={editing ? draft.nombre : data.nombre}
                                    onChange={(e: any) => handleDraftChange("nombre", e.target ? e.target.value : e)}
                                >
                                    <Label>Nombres</Label>
                                    <Input placeholder="Juan" />
                                    <FieldError />
                                </TextField>

                                <TextField
                                    isDisabled={!editing}
                                    name="apellido"
                                    value={editing ? draft.apellido : data.apellido}
                                    onChange={(e: any) => handleDraftChange("apellido", e.target ? e.target.value : e)}
                                >
                                    <Label>Apellidos</Label>
                                    <Input placeholder="Pérez" />
                                    <FieldError />
                                </TextField>
                            </div>

                            <TextField
                                isDisabled={!editing}
                                name="email"
                                type="email"
                                value={editing ? draft.email : data.email}
                                onChange={(e: any) => handleDraftChange("email", e.target ? e.target.value : e)}
                                validate={(value) => {
                                    if (editing && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
                                        return "Por favor ingresa un correo electrónico válido.";
                                    }
                                    return null;
                                }}
                            >
                                <Label>Correo electrónico</Label>
                                <Input placeholder="juan@ejemplo.com" />
                                <FieldError />
                            </TextField>
                        </div>

                        {/* Seguridad */}
                        <div className="flex flex-col gap-5">
                            <div className="pb-2 border-b border-border/50">
                                <h2 className="text-lg font-bold text-foreground">Seguridad</h2>
                                <p className="text-sm text-muted">Administra la contraseña de tu cuenta.</p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-5">
                                <TextField
                                    isDisabled={!editing}
                                    name="current_password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e: any) => setCurrentPassword(e.target ? e.target.value : e)}
                                    className="md:col-span-2 max-w-sm"
                                >
                                    <Label>Contraseña actual</Label>
                                    <Input autoComplete="current-password" placeholder="••••••••" />
                                    <FieldError />
                                </TextField>

                                <TextField
                                    isDisabled={!editing}
                                    name="new_password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e: any) => setNewPassword(e.target ? e.target.value : e)}
                                >
                                    <Label>Nueva contraseña</Label>
                                    <Input autoComplete="new-password" placeholder="••••••••" />
                                    <FieldError />
                                </TextField>

                                <TextField
                                    isDisabled={!editing}
                                    name="confirm_password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e: any) => setConfirmPassword(e.target ? e.target.value : e)}
                                >
                                    <Label>Confirmar contraseña</Label>
                                    <Input autoComplete="new-password" placeholder="••••••••" />
                                    <FieldError />
                                </TextField>
                            </div>
                        </div>

                    </Form>
                </Surface>
            </div>
        </div>
    );
}
