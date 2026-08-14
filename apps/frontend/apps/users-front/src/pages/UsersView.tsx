import { useEffect, useMemo, useState } from "react";
import { ApiError, Button, Icon, Pagination, toast, useApi } from "@nextticket-frontend/commons";
import { UserTable } from "../components/UserTable";
import { UserFilters, type StatusFilter } from "../components/UserFilters";
import { UserFormModal, type UserFormMode, type UserFormValues } from "../components/UserFormModal";
import { ModalDeleteUser } from "../components/ModalDeleteUser";
import { ROLE_ID_BY_ROLE, toAdminUser, type AdminUser, type AdminUserRole, type ApiUser } from "../types/user";

const PAGE_SIZE = 10;
// El backend no soporta busqueda/filtro por rol en la query todavia (solo
// page/limit): se trae una sola pagina grande y se filtra en el cliente.
const FETCH_LIMIT = 100;

interface UsersListResponse {
    data: ApiUser[];
}

export function UsersView() {
    const api = useApi();

    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<AdminUserRole | "all">("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<UserFormMode>("create");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
    const [saving, setSaving] = useState(false);

    const [toggleOpen, setToggleOpen] = useState(false);
    const [userToToggle, setUserToToggle] = useState<AdminUser | null>(null);

    const loadUsers = () => {
        setLoading(true);
        api
            .get<UsersListResponse>(`/users?page=1&limit=${FETCH_LIMIT}`)
            .then((res) => setUsers(res.data.map(toAdminUser)))
            .catch((err) => toast.danger(err instanceof ApiError ? err.message : "No se pudieron cargar los usuarios"))
            .finally(() => setLoading(false));
    };

    useEffect(loadUsers, []);

    const filtered = useMemo(() => {
        return users.filter((u) => {
            const matchesRole = roleFilter === "all" || u.role === roleFilter;
            const matchesStatus =
                statusFilter === "all" || (statusFilter === "active" ? u.status : !u.status);
            const query = search.toLowerCase();
            const matchesSearch = !query || u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query);
            return matchesRole && matchesStatus && matchesSearch;
        });
    }, [users, roleFilter, statusFilter, search]);

    useEffect(() => setPage(1), [search, roleFilter, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const openEdit = (user: AdminUser) => {
        setSelectedUser(user);
        setModalMode("edit");
        setModalOpen(true);
    };
    const openCreate = () => {
        setSelectedUser(null);
        setModalMode("create");
        setModalOpen(true);
    };

    const openToggleStatus = (user: AdminUser) => {
        setUserToToggle(user);
        setToggleOpen(true);
    };

    const confirmToggleStatus = () => {
        if (!userToToggle) return;
        const nextStatus = !userToToggle.status;

        api
            .patch<ApiUser>(`/users/${userToToggle.id}`, { status: nextStatus })
            .then((updated) => {
                setUsers((prev) => prev.map((u) => (u.id === userToToggle.id ? toAdminUser(updated) : u)));
                toast.success(nextStatus ? "Usuario activado" : "Usuario desactivado");
            })
            .catch((err) => toast.danger(err instanceof ApiError ? err.message : "No se pudo actualizar el estado"));
    };

    const handleSave = async (data: UserFormValues) => {
        setSaving(true);
        try {
            if (modalMode === "create") {
                const created = await api.post<ApiUser>("/users", {
                    name: data.name,
                    email: data.email,
                    roleId: ROLE_ID_BY_ROLE[data.role],
                });
                setUsers((prev) => [toAdminUser(created), ...prev]);
                toast.success(
                    `Usuario registrado correctamente. Se envió un correo a ${created.email} para que active su cuenta y establezca su contraseña.`,
                );
            } else if (selectedUser) {
                const updated = await api.patch<ApiUser>(`/users/${selectedUser.id}`, {
                    name: data.name,
                    email: data.email,
                    ...(data.password ? { password: data.password } : {}),
                });

                let finalUser = updated;
                if (data.role !== selectedUser.role) {
                    finalUser = await api.patch<ApiUser>(`/users/${selectedUser.id}/role`, {
                        roleId: ROLE_ID_BY_ROLE[data.role],
                    });
                }

                setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? toAdminUser(finalUser) : u)));
                toast.success("Usuario actualizado");
            }
            setModalOpen(false);
        } catch (err) {
            toast.danger(err instanceof ApiError ? err.message : "No se pudo guardar el usuario");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-3 animate-in fade-in duration-500">
            <div className="flex justify-between items-end flex-wrap gap-3">
                <div>
                    <h3>Usuarios</h3>
                    <p className="text-muted text-xs mt-0.5">Consulta y administra las cuentas registradas en la plataforma.</p>
                </div>
                <Button size="sm" onPress={openCreate}>
                    <Icon.Plus />
                    Crear usuario
                </Button>
            </div>

            <UserFilters
                search={search}
                onSearchChange={setSearch}
                roleFilter={roleFilter}
                onRoleFilterChange={setRoleFilter}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
            />

            {loading ? (
                <p className="text-muted text-xs py-8 text-center">Cargando usuarios...</p>
            ) : (
                <>
                    <UserTable users={paginated} onEdit={openEdit} onToggleStatus={openToggleStatus} />

                    <div className="flex justify-end">
                        <Pagination size="sm" style={{ justifyContent: "flex-end" }}>
                            <Pagination.Content>
                                <Pagination.Item>
                                    <Pagination.Previous isDisabled={currentPage <= 1} onPress={() => setPage((p) => p - 1)}>
                                        <Pagination.PreviousIcon />
                                    </Pagination.Previous>
                                </Pagination.Item>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <Pagination.Item key={p}>
                                        <Pagination.Link isActive={p === currentPage} onPress={() => setPage(p)}>
                                            {p}
                                        </Pagination.Link>
                                    </Pagination.Item>
                                ))}
                                <Pagination.Item>
                                    <Pagination.Next isDisabled={currentPage >= totalPages} onPress={() => setPage((p) => p + 1)}>
                                        <Pagination.NextIcon />
                                    </Pagination.Next>
                                </Pagination.Item>
                            </Pagination.Content>
                        </Pagination>
                    </div>
                </>
            )}

            <UserFormModal
                open={modalOpen}
                mode={modalMode}
                user={selectedUser}
                saving={saving}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
            />

            <ModalDeleteUser
                open={toggleOpen}
                onClose={() => setToggleOpen(false)}
                onConfirm={confirmToggleStatus}
                userName={userToToggle?.name}
                isActive={userToToggle?.status}
            />
        </div>
    );
}
