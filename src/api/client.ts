import { HisaabApiClient } from './hisaabApi';
import { getDeviceId, getToken, saveToken } from '../auth/authStorage';
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
  onUnauthorized: async () => {
    try {
      const deviceId = await getDeviceId();
      const res = await fetch(`${api.getBaseUrl()}/api/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        const json = (await res.json()) as { token: string };
        if (json.token) {
          await saveToken(json.token);
          return json.token;
        }
      }
    } catch (e) {
      console.warn('[api client] onUnauthorized token refresh failed:', e);
    }
    return null;
  },
});

