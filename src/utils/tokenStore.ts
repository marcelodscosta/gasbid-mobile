import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Armazenamento dos tokens de autenticação no Keychain (iOS) / Keystore (Android).
 * Chaves do SecureStore só aceitam [A-Za-z0-9._-], por isso diferem das legadas do AsyncStorage.
 * Instalações antigas são migradas automaticamente na primeira leitura.
 * Na web (sem SecureStore) mantém o AsyncStorage.
 */
const TOKEN_KEY = 'gasbid_token';
const REFRESH_KEY = 'gasbid_refresh';
const LEGACY_TOKEN = '@gasbid:token';
const LEGACY_REFRESH = '@gasbid:refresh';

const secure = Platform.OS !== 'web';

async function read(key: string, legacy: string): Promise<string | null> {
  if (!secure) return AsyncStorage.getItem(legacy);
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;
  } catch {
    /* cai para a migração/legado */
  }
  const old = await AsyncStorage.getItem(legacy);
  if (old) {
    try {
      await SecureStore.setItemAsync(key, old);
      await AsyncStorage.removeItem(legacy);
    } catch {
      /* mantém no legado se o SecureStore falhar */
    }
  }
  return old;
}

export const tokenStore = {
  getToken: () => read(TOKEN_KEY, LEGACY_TOKEN),
  getRefresh: () => read(REFRESH_KEY, LEGACY_REFRESH),

  async setTokens(token: string, refresh: string) {
    if (!secure) {
      await AsyncStorage.multiSet([[LEGACY_TOKEN, token], [LEGACY_REFRESH, refresh]]);
      return;
    }
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
    await AsyncStorage.multiRemove([LEGACY_TOKEN, LEGACY_REFRESH]); // garante que não sobra cópia em texto puro
  },

  async clear() {
    await AsyncStorage.multiRemove([LEGACY_TOKEN, LEGACY_REFRESH]);
    if (!secure) return;
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
      SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {}),
    ]);
  },
};
