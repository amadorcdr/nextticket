import type { SessionRole } from "@nextticket-frontend/commons";

// Se reutiliza la de commons en vez de declarar otra: tener dos constantes con
// la misma dirección significaba que al desplegar solo se actualizaba una, y el
// login seguía apuntando a localhost mientras el resto de la app ya iba al
// servidor. Aquí solo se cambia una vez, con VITE_API_URL al compilar.
import { API_BASE_URL } from "@nextticket-frontend/commons";

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

/**
 * Recuperación de contraseña: mismo flujo para los 4 roles, la cuenta se
 * identifica solo por correo. La respuesta es siempre el mismo mensaje
 * genérico, exista o no la cuenta — no hay nada que distinguir aquí.
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "No se pudo procesar la solicitud. Intenta de nuevo más tarde."),
    );
  }

  return response.json();
}

export async function resetPassword(
  token: string,
  password: string,
  passwordConfirmation: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password, passwordConfirmation }),
  });

  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "No se pudo restablecer la contraseña. Intenta de nuevo más tarde."),
    );
  }

  return response.json();
}

/** El usuario dice "yo no pedí esto": invalida el token sin cambiar nada. */
export async function discardPasswordReset(token: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password/discard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "No se pudo descartar la solicitud."));
  }

  return response.json();
}
