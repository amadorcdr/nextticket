import { useEffect, useState } from "react";
import { ApiError, Button, Icon, Input, InputGroup, Label, Router, TextField, Tooltip, toast, useApi } from "@nextticket-frontend/commons";
import { ROLE_ID_BY_ROLE, ROLE_LABELS, toAdminUser, type AdminUserRole, type ApiUser } from "../types/user";

const ROLE_OPTIONS: AdminUserRole[] = ["usuario", "organizador", "admin", "validador"];

interface Draft {
    name: string;
    email: string;
    role: AdminUserRole;
    password: string;
}

const EMPTY: Draft = { name: "", email: "", role: "usuario", password: "" };

export function UserFormPage() {
    const { id } = Router.useParams<{ id: string }>();
    const navigate = Router.useNavigate();
    const api = useApi();
    const isCreate = !id;

    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [originalRole, setOriginalRole] = useState<AdminUserRole>("usuario");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(!isCreate);
    const [notFound, setNotFound] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isCreate || !id) return;
        setLoading(true);
        setNotFound(false);
        api
            .get<ApiUser>(`/users/${id}`)
            .then((res) => {
                const user = toAdminUser(res);
                setDraft({ name: user.name, email: user.email, role: user.role, password: "" });
                setOriginalRole(user.role);
            })
            .catch((err) => {
                if (err instanceof ApiError && err.status === 404) setNotFound(true);
                else toast.danger(err instanceof ApiError ? err.message : "No se pudo cargar el usuario");
            })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const set = (k: "name" | "email" | "password") => (e: React.ChangeEvent<HTMLInputElement>) =>
        setDraft((p) => ({ ...p, [k]: e.target.value }));

    const canSave = draft.name.trim() && draft.email.trim() && (isCreate || !draft.password.trim() || draft.password.trim().length >= 8);

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            if (isCreate) {
                const created = await api.post<ApiUser>("/users", {
                    name: draft.name,
                    email: draft.email,
                    roleId: ROLE_ID_BY_ROLE[draft.role],
                });
                toast.success(
                    `Usuario registrado correctamente. Se envió un correo a ${created.email} para que active su cuenta y establezca su contraseña.`,
                );
            } else if (id) {
                await api.patch<ApiUser>(`/users/${id}`, {
                    name: draft.name,
                    email: draft.email,
                    ...(draft.password.trim() ? { password: draft.password } : {}),
                });

                if (draft.role !== originalRole) {
                    await api.patch<ApiUser>(`/users/${id}/role`, { roleId: ROLE_ID_BY_ROLE[draft.role] });
                }

                toast.success("Usuario actualizado");
            }
            navigate("/users");
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo guardar el usuario");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <p className="text-muted text-xs py-16 text-center">Cargando usuario...</p>;
    }

    if (notFound) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <p className="text-foreground font-semibold">Usuario no encontrado</p>
                <p className="text-muted text-xs">Usa las migas de pan de arriba para volver a Usuarios.</p>
            </div>
        );
    }

    const title = isCreate ? "Crear Usuario" : "Editar Usuario";
    const subtitle = isCreate
        ? "Se enviará un correo para que la persona active su cuenta y establezca su contraseña."
        : "Modifica los datos de la cuenta.";

    return (
        <div className="flex flex-col gap-4 animate-in fade-in duration-500">
            <div>
                <h3>{title}</h3>
                <p className="text-muted text-xs mt-0.5">{subtitle}</p>
            </div>

            {/* Formulario propio: sin esto, Chrome trata todos los inputs de la
                página como un solo formulario implícito y, al ver un campo de
                contraseña, autocompleta el campo de texto más cercano con una
                credencial guardada del sitio. */}
            <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
                <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
                    <p className="text-foreground font-bold text-sm">Información de la cuenta</p>
                    <div className="grid sm:grid-cols-2 gap-3">
                        <TextField isRequired name="nombre" className="sm:col-span-2">
                            <Label>Nombre completo</Label>
                            <Input placeholder="Ej: Juan Pérez" autoComplete="off" value={draft.name} onChange={set("name")} />
                        </TextField>

                        <TextField isRequired name="email" type="email" className="sm:col-span-2">
                            <Label>Correo electrónico</Label>
                            <Input placeholder="nombre@ejemplo.com" autoComplete="off" value={draft.email} onChange={set("email")} />
                        </TextField>

                        {isCreate ? (
                            <div className="sm:col-span-2 flex items-start gap-2 text-xs text-muted bg-accent/5 border border-accent/15 rounded-[10px] px-3 py-2">
                                <Icon.Mail className="size-4 shrink-0 mt-0.5 text-accent" />
                                <span>
                                    La persona recibirá un correo con un enlace para activar su cuenta y establecer su
                                    propia contraseña.
                                </span>
                            </div>
                        ) : (
                            <TextField name="password" className="sm:col-span-2">
                                <div className="flex items-center gap-1">
                                    <Label>Nueva contraseña (opcional)</Label>
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
                                        autoComplete="new-password"
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
                        )}

                        <div className="sm:col-span-2">
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
                </section>
            </form>

            <div className="flex gap-2 justify-end border-t border-border pt-3 pb-1">
                <Button size="sm" variant="secondary" onPress={() => navigate("/users")} isDisabled={saving}>
                    Cancelar
                </Button>
                <Button size="sm" onPress={handleSave} isDisabled={!canSave || saving}>
                    <Icon.Check />
                    {saving ? "Guardando..." : isCreate ? "Crear Usuario" : "Guardar Cambios"}
                </Button>
            </div>
        </div>
    );
}
