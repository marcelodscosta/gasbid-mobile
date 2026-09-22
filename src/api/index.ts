import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração do servidor backend (Produção no Render)
const BASE_URL = 'https://gasbid-backend-zh4b.onrender.com';
type UnauthCallback = () => void;
const listeners = new Set<UnauthCallback>();

export const authEvents = {
  onUnauthenticated(cb: UnauthCallback) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  emitUnauthenticated() {
    listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.warn('Error in unauthenticated listener:', e);
      }
    });
  }
};

export const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('@gasbid:token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = await AsyncStorage.getItem('@gasbid:refresh');
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await AsyncStorage.setItem('@gasbid:token', data.token);
        await AsyncStorage.setItem('@gasbid:refresh', data.refreshToken);
        
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (err) {
        await AsyncStorage.removeItem('@gasbid:token');
        await AsyncStorage.removeItem('@gasbid:refresh');
        authEvents.emitUnauthenticated();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
