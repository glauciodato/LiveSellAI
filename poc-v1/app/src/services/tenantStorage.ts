import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tenant } from '../types/tenant';

/**
 * Armazenamento local/mock do tenant atual.
 *
 * Nesta POC não existe backend de autenticação nem banco de dados de
 * contas: o e-mail informado pelo usuário é salvo no dispositivo
 * (AsyncStorage, funciona em Web/iOS/Android) e passa a identificar o
 * tenant em todas as chamadas subsequentes (ex: caminho do blob no Azure
 * Storage). Numa versão futura isso será substituído por um cadastro e
 * autenticação reais no backend.
 */
const TENANT_STORAGE_KEY = '@livesellai/tenant';

export async function getStoredTenant(): Promise<Tenant | null> {
  const raw = await AsyncStorage.getItem(TENANT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string') {
      return { email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveTenant(email: string): Promise<Tenant> {
  const tenant: Tenant = { email: email.trim().toLowerCase() };
  await AsyncStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant));
  return tenant;
}

export async function clearTenant(): Promise<void> {
  await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}
