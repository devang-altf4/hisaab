import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { clearToken, getToken, newDeviceId, onSessionExpired, saveToken } from './authStorage';
import { cancelScheduledReminders } from '../notifications/notificationService';
import type { Profile, Targets, User } from '../api/hisaabApi';

/**
 * Sessions:
 *  - signed out: no token → welcome screen (Get Started / Sign in)
 *  - guest: "Get Started" creates a guest account so onboarding can save the profile
 *  - account: the guest adds an email + password at the end of onboarding (register),
 *    or an existing account signs in. Signing out drops the token and every cached screen.
 */
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isOnboarded: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  startGuest: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (profile: Profile) => Promise<User>;
  updateTargets: (targets: Targets | { reset: true }) => Promise<User>;
  refreshUser: () => Promise<User | null>;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback(
    async (res: { token: string; user: User }) => {
      await saveToken(res.token);
      queryClient.clear(); // never show the previous account's screens
      setToken(res.token);
      setUser(res.user);
    },
    [queryClient],
  );

  const endSession = useCallback(() => {
    queryClient.clear();
    setToken(null);
    setUser(null);
  }, [queryClient]);

  const bootstrap = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const savedToken = await getToken();
      if (!savedToken) {
        endSession();
        return;
      }
      setToken(savedToken);
      try {
        const meRes = await api.me.get();
        setUser(meRes.user);
      } catch (meErr: any) {
        // 401: the API client already cleared the token → welcome screen. Anything else = server unreachable.
        if (meErr?.status === 401) endSession();
        else throw meErr;
      }
    } catch (err: any) {
      console.error('[AuthProvider] bootstrap error:', err);
      setError(err?.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }, [endSession]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Token rejected mid-use (expired, account deleted): back to the welcome screen.
  useEffect(() => onSessionExpired(endSession), [endSession]);

  const startGuest = useCallback(async () => {
    if (user) return;
    // A brand-new guest key every time, so a key that already has an account is never reused.
    const res = await api.auth.guest({ deviceId: await newDeviceId() });
    await startSession(res);
  }, [user, startSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await startSession(await api.auth.login({ email: email.trim(), password }));
    },
    [startSession],
  );

  const register = useCallback(async (email: string, password: string) => {
    // Same account, now with an email: keep the cache, just swap in the new token.
    const res = await api.auth.register({ email: email.trim(), password });
    await saveToken(res.token);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await cancelScheduledReminders();
    await clearToken();
    endSession();
  }, [endSession]);

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

  const isOnboarded = user !== null && user.profile !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isOnboarded,
        error,
        bootstrap,
        startGuest,
        signIn,
        register,
        signOut,
        updateProfile,
        updateTargets,
        refreshUser,
        setUser,
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
