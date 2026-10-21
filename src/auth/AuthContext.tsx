import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import { clearToken, getDeviceId, getToken, saveToken } from './authStorage';
import type { Profile, Targets, User } from '../api/hisaabApi';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  deviceId: string | null;
  error: string | null;
  bootstrap: () => Promise<void>;
  updateProfile: (profile: Profile) => Promise<User>;
  updateTargets: (targets: Targets | { reset: true }) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const devId = await getDeviceId();
      setDeviceId(devId);

      let savedToken = await getToken();

      if (!savedToken) {
        // First launch or cleared: authenticate as guest
        const authRes = await api.auth.guest({ deviceId: devId });
        savedToken = authRes.token;
        await saveToken(savedToken);
        setToken(savedToken);
        setUser(authRes.user);
      } else {
        setToken(savedToken);
        try {
          const meRes = await api.me.get();
          setUser(meRes.user);
        } catch (meErr: any) {
          if (meErr?.status === 401) {
            // Re-authenticate guest
            const authRes = await api.auth.guest({ deviceId: devId });
            await saveToken(authRes.token);
            setToken(authRes.token);
            setUser(authRes.user);
          } else {
            console.warn('[AuthProvider] me.get() failed:', meErr);
            throw meErr;
          }
        }
      }
    } catch (err: any) {
      console.error('[AuthProvider] bootstrap error:', err);
      setError(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const updateProfile = useCallback(async (profile: Profile): Promise<User> => {
    const res = await api.me.updateProfile(profile);
    setUser(res.user);
    return res.user;
  }, []);

  const updateTargets = useCallback(async (targets: Targets | { reset: true }): Promise<User> => {
    const res = await api.me.updateTargets(targets);
    setUser(res.user);
    return res.user;
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const res = await api.me.get();
      setUser(res.user);
      return res.user;
    } catch (err) {
      console.warn('[AuthProvider] refreshUser failed:', err);
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setToken(null);
    setUser(null);
    await bootstrap();
  }, [bootstrap]);

  const isOnboarded = user !== null && user.profile !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isOnboarded,
        deviceId,
        error,
        bootstrap,
        updateProfile,
        updateTargets,
        refreshUser,
        setUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

