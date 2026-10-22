import { HisaabApiClient } from './hisaabApi';
import { clearToken, emitSessionExpired, getDeviceId, getToken } from '../auth/authStorage';
import Constants from 'expo-constants';

function resolveDefaultApiUrl(): string {
  // 1. Env variable takes precedence
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }

  // 2. Try expo host IP if running in Expo Go on physical device or simulator
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    if (ip) {
      return `http://${ip}:4000`;
    }
  }

  // 3. Fallback to localhost
  return 'http://localhost:4000';
}

export const API_BASE_URL = resolveDefaultApiUrl();

export const api = new HisaabApiClient({
  baseUrl: API_BASE_URL,
  getToken: async () => {
    return await getToken();
  },
  getDeviceId: async () => {
    return await getDeviceId();
  },
  // Saved token rejected: drop it and send the user to the welcome screen (never a silent new guest,
  // which would hide their real account behind an empty one).
  onUnauthorized: async () => {
    await clearToken();
    emitSessionExpired();
    return null;
  },
});

