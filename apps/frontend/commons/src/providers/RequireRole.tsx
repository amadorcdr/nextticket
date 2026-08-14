import { Navigate, Outlet } from "react-router-dom";
import { HOME_BY_ROLE, SessionRole, useSession } from "./SessionProvider";

interface RequireRoleProps {
    /** Si se omite, solo exige sesión activa (cualquier rol autenticado). */
    roles?: SessionRole[];
}

/**
 * Protege un grupo de rutas hijas (via <Outlet/>): sin sesión manda a
 * /sign-in, y con sesión pero rol no autorizado manda a la pantalla propia
 * de ese rol (HOME_BY_ROLE), en vez de dejarlo entrar a una sección ajena.
 */
export function RequireRole({ roles }: RequireRoleProps) {
    const { user, isAuthenticated } = useSession();

    if (!isAuthenticated || !user) {
        return <Navigate to="/sign-in" replace />;
    }

    if (roles && !roles.includes(user.role)) {
        return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
    }

    return <Outlet />;
}
