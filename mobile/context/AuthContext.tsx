import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';

interface User {
  _id: string;
  username: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string, userData: User & { token?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

function profileFromPayload(data: User & { token?: string }): User {
  const { token: _t, ...profile } = data as User & { token?: string };
  return profile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (!storedToken) return;

      const storedUser = await AsyncStorage.getItem(USER_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      try {
        const res = await authAPI.getMe();
        if (res.data?.success && res.data.data) {
          const profile = profileFromPayload(res.data.data);
          if (profile.role !== 'parent') {
            await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
            setUser(null);
            return;
          }
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
          setUser(profile);
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          setUser(null);
        }
        // شبكة ضعيفة: الإبقاء على الجلسة المحفوظة
      }
    } catch (e) {
      console.error('Failed to restore session', e);
    } finally {
      setLoading(false);
    }
  };

  const login = async (token: string, userData: User & { token?: string }) => {
    const profile = profileFromPayload(userData);
    await AsyncStorage.setItem(TOKEN_KEY, token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
    setUser(profile);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setUser(null);
  };

  const updateUser = async (userData: User) => {
    const profile = profileFromPayload(userData);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
    setUser(profile);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
