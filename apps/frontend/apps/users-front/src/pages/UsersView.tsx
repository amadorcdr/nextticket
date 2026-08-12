import { useEffect, useMemo, useState } from "react";
import { Button, Icon, Pagination } from "@nextticket-frontend/commons";
import { UserTable } from "../components/UserTable";
import { UserFilters } from "../components/UserFilters";
import { UserFormModal, type UserFormMode } from "../components/UserFormModal";
import { ADMIN_USERS } from "../mocks/users";
import type { AdminUser, AdminUserRole } from "../types/user";

const PAGE_SIZE = 8;

export function UsersView() {
    const [users, setUsers] = useState<AdminUser[]>(ADMIN_USERS);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState<AdminUserRole | "all">("all");
    const [page, setPage] = useState(1);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<UserFormMode>("view");
    const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

    const filtered = useMemo(() => {
        return users.filter((u) => {
            const matchesRole = roleFilter === "all" || u.role === roleFilter;
            const query = search.toLowerCase();
            const matchesSearch =
                !query ||
                `${u.firstName} ${u.lastName}`.toLowerCase().includes(query) ||
                u.email.toLowerCase().includes(query);
            return matchesRole && matchesSearch;
        });
    }, [users, roleFilter, search]);

    useEffect(() => setPage(1), [search, roleFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const openView = (user: AdminUser) => {
        setSelectedUser(user);
        setModalMode("view");
        setModalOpen(true);
    };
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
    const toggleStatus = (user: AdminUser) => {
        setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u))
        );
    };

    const handleSave = (data: Omit<AdminUser, "id" | "createdAt">) => {
        if (modalMode === "create") {
            const newUser: AdminUser = {
                ...data,
                id: `usr-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString().slice(0, 10),
            };
            setUsers((prev) => [newUser, ...prev]);
            return;
        }
        if (selectedUser) {
            setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...data } : u)));
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

            <UserFilters search={search} onSearchChange={setSearch} roleFilter={roleFilter} onRoleFilterChange={setRoleFilter} />

            <UserTable users={paginated} onView={openView} onEdit={openEdit} onToggleStatus={toggleStatus} />

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

            <UserFormModal open={modalOpen} mode={modalMode} user={selectedUser} onClose={() => setModalOpen(false)} onSave={handleSave} />
        </div>
    );
}
