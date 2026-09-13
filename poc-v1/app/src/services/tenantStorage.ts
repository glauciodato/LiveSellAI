import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Tenant } from '../types/tenant';

/**
 * Guarda no dispositivo (AsyncStorage, funciona em Web/iOS/Android) a conta
 * já autenticada de verdade no backend (cadastro/login com senha), pra não
 * pedir login a cada vez que o app abre.
 */
const TENANT_STORAGE_KEY = '@livesellai/tenant';

export async function getStoredTenant(): Promise<Tenant | null> {
  const raw = await AsyncStorage.getItem(TENANT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.id === 'number' &&
      typeof parsed.name === 'string' &&
      typeof parsed.email === 'string'
    ) {
      return { id: parsed.id, name: parsed.name, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveTenant(tenant: Tenant): Promise<void> {
  await AsyncStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant));
}

export async function clearTenant(): Promise<void> {
  await AsyncStorage.removeItem(TENANT_STORAGE_KEY);
}
