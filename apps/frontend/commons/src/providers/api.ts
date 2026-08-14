import { useCallback } from "react";
import { useSession } from "./SessionProvider";

export const API_BASE_URL = "http://localhost:3001";

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

/**
 * Cliente HTTP compartido: adjunta el JWT de la sesión activa en cada
 * request y cierra sesión sola si el token ya expiró (401). Cualquier
 * microfrontend que necesite hablar con el gateway usa esto en vez de un
 * `fetch` suelto, para no repetir el manejo de headers/errores en cada uno.
 */
export function useApi() {
    const { user, signOut } = useSession();

    const request = useCallback(
        async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
            const response = await fetch(`${API_BASE_URL}${path}`, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
                    ...options.headers,
                },
            });

            if (response.status === 401) {
                signOut();
                throw new ApiError(401, "Tu sesión expiró, vuelve a iniciar sesión");
            }

            if (!response.ok) {
                const body = await response.json().catch(() => null);
                const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
                throw new ApiError(response.status, message || "Ocurrió un error inesperado");
            }

            if (response.status === 204) return undefined as T;
            return response.json();
        },
        [user?.token, signOut],
    );

    return {
        get: <T,>(path: string) => request<T>(path),
        post: <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
        patch: <T,>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
        del: <T,>(path: string) => request<T>(path, { method: "DELETE" }),
    };
}
