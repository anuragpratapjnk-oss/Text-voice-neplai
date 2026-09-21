import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, LoginCredentials } from '../types';

const TOKEN_STORAGE_KEY = 'gemini_tts_auth_token_v1';
const USER_STORAGE_KEY = 'gemini_tts_auth_user_v1';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  getAuthHeaders: () => Record<string, string>;
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem(USER_STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Helper to create auth headers
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const currentToken = token || localStorage.getItem(TOKEN_STORAGE_KEY);
    if (currentToken) {
      return {
        Authorization: `Bearer ${currentToken}`,
      };
    }
    return {};
  }, [token]);

  // Authenticated fetch wrapper
  const fetchWithAuth = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(options.headers || {});
      const currentToken = token || localStorage.getItem(TOKEN_STORAGE_KEY);
      
      if (currentToken && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${currentToken}`);
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Token expired or invalidated
        logout();
      }

      return response;
    },
    [token]
  );

  // Validate existing token with server on initial mount
  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setIsCheckingAuth(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && isMounted) {
            setUser(data.user);
            setToken(storedToken);
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
          } else if (isMounted) {
            logout();
          }
        } else if (isMounted) {
          logout();
        }
      } catch (err) {
        console.error('Session validation error:', err);
        // If offline or transient network issue, keep stored session if present
      } finally {
        if (isMounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'Invalid username or password.',
        };
      }

      // Store token and user
      setToken(data.token);
      setUser(data.user);
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      } catch (e) {
        console.warn('Could not save to localStorage', e);
      }

      return { success: true };
    } catch (err: any) {
      console.error('Login network error:', err);
      return {
        success: false,
        error: 'Unable to connect to the authentication server. Please try again.',
      };
    }
  };

  const logout = useCallback(async () => {
    try {
      if (token) {
        fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      setToken(null);
      setUser(null);
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch (e) {
        console.warn('Error clearing localStorage', e);
      }
    }
  }, [token]);

  const changePassword = async (currentPass: string, newPass: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetchWithAuth('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to update password.' };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating password.' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isCheckingAuth,
        login,
        logout,
        changePassword,
        getAuthHeaders,
        fetchWithAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
