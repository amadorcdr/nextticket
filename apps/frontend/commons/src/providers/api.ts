import { useCallback } from "react";
import { useSession } from "./SessionProvider";

/**
 * Dónde vive el api-gateway.
 *
 * En desarrollo no hace falta configurar nada: cae en localhost. Para desplegar
 * se define VITE_API_URL al compilar, porque el servidor está en otra máquina:
 *
 *   VITE_API_URL=http://54.x.x.x:3001 npm run build
 *
 * Vite reemplaza el valor en tiempo de compilación, así que el sitio ya sale
 * apuntando al servidor correcto.
 */
export const API_BASE_URL =
    import.meta.env.VITE_API_URL ?? "http://localhost:3001";

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

/**
 * Descarga un recurso binario protegido (ej. la imagen PNG del QR de un
 * boleto) y lo expone como object URL. Un <img src> normal no puede mandar
 * el header Authorization, así que esto hace el fetch a mano y arma el blob.
 * Quien la use debe revocar la URL (`URL.revokeObjectURL`) al desmontar.
 */
export async function fetchAuthenticatedBlobUrl(path: string, token: string | undefined): Promise<string> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
        throw new ApiError(response.status, "No se pudo cargar el código QR");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
}
