import type { SessionRole } from "@nextticket-frontend/commons";

export type AdminUserRole = SessionRole;

export const ROLE_LABELS: Record<AdminUserRole, string> = {
    usuario: "Cliente",
    organizador: "Organizador",
    admin: "Administrador",
    validador: "Validador",
};

/** roleId es fijo en auth-service (se siembra una sola vez al arrancar). */
export const ROLE_ID_BY_ROLE: Record<AdminUserRole, string> = {
    usuario: "11111111-1111-4111-8111-111111111111",
    organizador: "22222222-2222-4222-8222-222222222222",
    validador: "33333333-3333-4333-8333-333333333333",
    admin: "44444444-4444-4444-8444-444444444444",
};

type BackendRoleName = "CLIENT" | "ORGANIZER" | "VALIDATOR" | "ADMIN";

const ROLE_BY_BACKEND_NAME: Record<BackendRoleName, AdminUserRole> = {
    CLIENT: "usuario",
    ORGANIZER: "organizador",
    VALIDATOR: "validador",
    ADMIN: "admin",
};

/** Forma real que devuelve GET /users del auth-service. */
export interface ApiUser {
    id: string;
    name: string;
    email: string;
    status: boolean;
    createdAt: string;
    role: { id: string; name: BackendRoleName };
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: AdminUserRole;
    status: boolean;
    createdAt: string;
}

export function toAdminUser(apiUser: ApiUser): AdminUser {
    return {
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        role: ROLE_BY_BACKEND_NAME[apiUser.role.name] ?? "usuario",
        status: apiUser.status,
        createdAt: apiUser.createdAt,
    };
}
