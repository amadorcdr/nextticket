import type { SessionRole } from "@nextticket-frontend/commons";

const API_BASE_URL = "http://localhost:3001";

type BackendRole = "CLIENT" | "ORGANIZER" | "VALIDATOR" | "ADMIN";

/** El rol que devuelve auth-service no coincide 1:1 con las claves de HOME_BY_ROLE. */
const ROLE_BY_BACKEND_NAME: Record<BackendRole, SessionRole> = {
  CLIENT: "usuario",
  ORGANIZER: "organizador",
  VALIDATOR: "validador",
  ADMIN: "admin",
};

export class InvalidCredentialsError extends Error {}
export class AccountDisabledError extends Error {}

interface LoginApiResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: { name: BackendRole };
  };
}

export interface LoginResult {
  token: string;
  id: string;
  name: string;
  email: string;
  role: SessionRole;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (response.status === 401) {
    throw new InvalidCredentialsError("Correo o contraseña incorrectos");
  }

  if (response.status === 403) {
    const body = await response.json().catch(() => null);
    throw new AccountDisabledError(body?.message || "Tu cuenta está deshabilitada. Contacta a un administrador.");
  }

  if (!response.ok) {
    throw new Error("No se pudo iniciar sesión. Intenta de nuevo más tarde.");
  }

  const data: LoginApiResponse = await response.json();

  return {
    token: data.token,
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    role: ROLE_BY_BACKEND_NAME[data.user.role.name] ?? "usuario",
  };
}
