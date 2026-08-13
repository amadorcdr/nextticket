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
    name: string;
    email: string;
    role: { name: BackendRole };
  };
}

export interface LoginResult {
  token: string;
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
    name: data.user.name,
    email: data.user.email,
    role: ROLE_BY_BACKEND_NAME[data.user.role.name] ?? "usuario",
  };
}

async function readErrorMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  const message = Array.isArray(body?.message) ? body.message.join(", ") : body?.message;
  return message || fallback;
}

export interface RegisterResult {
  message: string;
  email: string;
}

/**
 * Autorregistro de Cliente: ya no manda contraseña. La cuenta queda
 * pendiente y la contraseña se establece al activarla (ver activateAccount).
 */
export async function register(name: string, email: string): Promise<RegisterResult> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "No se pudo completar el registro. Intenta de nuevo."));
  }

  return response.json();
}

/**
 * Único mecanismo de activación: lo usa tanto el autorregistro de Cliente
 * como el alta de Organizador/Validador desde el panel de Administración.
 */
export async function activateAccount(
  token: string,
  password: string,
  confirmPassword: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password, confirmPassword }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "No se pudo activar la cuenta. Intenta de nuevo más tarde."),
    );
  }

  return response.json();
}

export async function resendActivation(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/resend-activation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "No se pudo reenviar el correo de activación."));
  }

  return response.json();
}
