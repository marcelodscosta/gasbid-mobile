import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { unregisterPushToken } from '../hooks/usePushNotifications';
import { tokenStore } from '../utils/tokenStore';

export type UserRole = 'BUYER' | 'SUPPLIER' | 'ADMIN' | null;

interface UserContextType {
  role: UserRole;
  userId: string | null;
  setRole: (role: UserRole) => void;
  setUserId: (id: string | null) => void;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  role: null,
  userId: null,
  setRole: () => {},
  setUserId: () => {},
  logout: async () => {},
});

export function UserProvider({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) {
  const [role, setRole] = useState<UserRole>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const logout = useCallback(async () => {
    // Desregistrar push token antes de limpar credenciais
    await unregisterPushToken();
    await tokenStore.clear();
    await AsyncStorage.multiRemove([
      '@gasbid:role',
      '@gasbid:last_order',
      '@gasbid:last_payment_method',
      '@gasbid:auto_accept',
    ]);
    setRole(null);
    setUserId(null);
    onLogout();
  }, [onLogout]);

  return (
    <UserContext.Provider value={{ role, setRole, userId, setUserId, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
