import { BACKEND_URL } from '../config';
import type { Tenant } from '../types/tenant';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // resposta sem corpo JSON — usa a mensagem padrão
  }
  return fallback;
}

export interface RegisterParams {
  name: string;
  email: string;
  password: string;
}

/** Cadastra uma nova conta. Lança erro com mensagem amigável em caso de falha. */
export async function register({ name, email, password }: RegisterParams): Promise<Tenant> {
  const response = await fetch(`${BACKEND_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, `Falha ao cadastrar (HTTP ${response.status}).`)
    );
  }

  return (await response.json()) as Tenant;
}

export interface LoginParams {
  email: string;
  password: string;
}

/** Faz login com e-mail/senha. Lança erro com mensagem amigável em caso de falha. */
export async function login({ email, password }: LoginParams): Promise<Tenant> {
  const response = await fetch(`${BACKEND_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, `Falha ao entrar (HTTP ${response.status}).`)
    );
  }

  return (await response.json()) as Tenant;
}

/**
 * Autentica (ou cria a conta, na primeira vez) usando o ID token emitido
 * pelo Google Identity Services. Lança erro com mensagem amigável em caso
 * de falha.
 */
export async function loginWithGoogle(idToken: string): Promise<Tenant> {
  const response = await fetch(`${BACKEND_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, `Falha ao entrar com Google (HTTP ${response.status}).`)
    );
  }

  return (await response.json()) as Tenant;
}

export interface ChangePasswordParams {
  email: string;
  currentPassword: string;
  newPassword: string;
}

/** Troca a senha (exige a senha atual). Lança erro com mensagem amigável em caso de falha. */
export async function changePassword({
  email,
  currentPassword,
  newPassword,
}: ChangePasswordParams): Promise<Tenant> {
  const response = await fetch(`${BACKEND_URL}/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword, newPassword }),
  });

  if (!response.ok) {
    throw new Error(
      await extractErrorMessage(response, `Falha ao trocar a senha (HTTP ${response.status}).`)
    );
  }

  return (await response.json()) as Tenant;
}
