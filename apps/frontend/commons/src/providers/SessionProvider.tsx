import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from "react";

/** Mismos roles que ofrece el selector del login. */
export type SessionRole = "usuario" | "organizador" | "admin" | "validador";

export interface SessionUser {
    name: string;
    email: string;
    role: SessionRole;
    /** JWT emitido por auth-service. Ausente para sesiones que aún no se conectan al backend. */
    token?: string;
    /** UUID real del usuario en auth-service. Ausente para sesiones que aún no se conectan al backend. */
    id?: string;
}

interface SessionContextValue {
    user: SessionUser | null;
    isAuthenticated: boolean;
    signIn: (user: SessionUser) => void;
    signOut: () => void;
}

const STORAGE_KEY = "nextticket:session";

/** A dónde entra cada rol al iniciar sesión. */
export const HOME_BY_ROLE: Record<SessionRole, string> = {
    usuario: "/eventos",
    organizador: "/organizer/dashboard",
    validador: "/validator",
    admin: "/dashboard",
};

const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredSession(): SessionUser | null {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
        return null;
    }
}

/**
 * Guarda quién entró (y su JWT, si el login vino del backend) para que cada
 * layout sepa a quién le está hablando.
 *
 * Se persiste en localStorage a propósito: al recargar sigues dentro, que es
 * lo que se espera de una sesión de verdad.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(readStoredSession);

    const signIn = useCallback((nextUser: SessionUser) => {
        setUser(nextUser);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
        } catch {
            // Si el navegador bloquea el storage, la sesión dura lo que la pestaña.
        }
    }, []);

    const signOut = useCallback(() => {
        setUser(null);
        try {
            window.localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Sin storage no hay nada que limpiar.
        }
    }, []);

    const value = useMemo<SessionContextValue>(
        () => ({
            user,
            isAuthenticated: user !== null,
            signIn,
            signOut,
        }),
        [user, signIn, signOut],
    );

    return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
    const context = useContext(SessionContext);

    if (!context) {
        throw new Error("useSession debe usarse dentro de <SessionProvider>");
    }

    return context;
}

/** Iniciales para el avatar: "Juan Pérez" -> "JP". */
export function getInitials(name: string) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}
