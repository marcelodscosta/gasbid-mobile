import axios from 'axios';
import { tokenStore } from '../utils/tokenStore';

// Configuração do servidor backend (Produção no Render)
export const BASE_URL = 'https://gasbid-backend-zh4b.onrender.com';
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
  const token = await tokenStore.getToken();
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
        const refreshToken = await tokenStore.getRefresh();
        if (!refreshToken) throw new Error('No refresh token available');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        await tokenStore.setTokens(data.token, data.refreshToken);
        
        original.headers.Authorization = `Bearer ${data.token}`;
        return api(original);
      } catch (err) {
        await tokenStore.clear();
        authEvents.emitUnauthenticated();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
