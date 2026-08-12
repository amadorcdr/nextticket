export type AdminUserRole = "usuario" | "organizador" | "admin" | "validador";

export const ROLE_LABELS: Record<AdminUserRole, string> = {
    usuario: "Cliente",
    organizador: "Organizador",
    admin: "Administrador",
    validador: "Validador",
};

export type AdminUserStatus = "active" | "inactive";

export interface AdminUser {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: AdminUserRole;
    status: AdminUserStatus;
    createdAt: string;
}
