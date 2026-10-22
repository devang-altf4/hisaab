import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const TOKEN_KEY = 'hisaab_jwt_token';
const DEVICE_ID_KEY = 'hisaab_device_id';

// expo-secure-store has no web implementation — fall back to localStorage there
// so the app can be demoed/tested in a browser.
const store = {
  get: async (key: string): Promise<string | null> =>
    Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key),
  set: async (key: string, value: string): Promise<void> =>
    Platform.OS === 'web' ? globalThis.localStorage?.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: async (key: string): Promise<void> =>
    Platform.OS === 'web' ? globalThis.localStorage?.removeItem(key) : SecureStore.deleteItemAsync(key),
};

let deviceIdPromise: Promise<string> | null = null;

/**
 * Fresh guest key for "Get Started". A key that later got an email + password must never be
 * reused for a new guest, so every new guest session starts from a new one.
 */
export async function newDeviceId(): Promise<string> {
  const id = Crypto.randomUUID();
  await store.set(DEVICE_ID_KEY, id);
  deviceIdPromise = Promise.resolve(id);
  return id;
}

/** Current guest key. Memoized so concurrent callers can't generate two different ids. */
export function getDeviceId(): Promise<string> {
  deviceIdPromise ??= (async () => {
    let id = await store.get(DEVICE_ID_KEY);
    if (!id) {
      id = Crypto.randomUUID();
      await store.set(DEVICE_ID_KEY, id);
    }
    return id;
  })().catch((err) => {
    deviceIdPromise = null;
    throw err;
  });
  return deviceIdPromise;
}

export async function getToken(): Promise<string | null> {
  try {
    return await store.get(TOKEN_KEY);
  } catch (err) {
    console.warn('[authStorage] getToken error:', err);
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    await store.set(TOKEN_KEY, token);
  } catch (err) {
    console.warn('[authStorage] saveToken error:', err);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await store.remove(TOKEN_KEY);
  } catch (err) {
    console.warn('[authStorage] clearToken error:', err);
  }
}

// The API client tells the auth context when the server rejects the saved token
// (expired, or the account was deleted), so the app can go back to the welcome screen.
type Listener = () => void;
const expiredListeners = new Set<Listener>();

export function onSessionExpired(cb: Listener): () => void {
  expiredListeners.add(cb);
  return () => expiredListeners.delete(cb);
}

export function emitSessionExpired() {
  for (const cb of expiredListeners) cb();
}
