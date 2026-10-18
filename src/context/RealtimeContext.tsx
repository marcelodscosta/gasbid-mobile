import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { BASE_URL } from '../api';
import { tokenStore } from '../utils/tokenStore';

type Handler = (event: string, payload: any) => void;

interface RealtimeContextValue {
  /** true enquanto o WebSocket está aberto. */
  connected: boolean;
  /** Recebe todos os eventos do servidor. Retorna a função de cancelamento. */
  subscribe: (handler: Handler) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  subscribe: () => () => {},
});

/**
 * Mantém uma única conexão com `/ws` para o app inteiro, com reconexão exponencial
 * e reconexão imediata ao voltar para o primeiro plano.
 * Os eventos são distribuídos para quem se inscreve via `subscribe`.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const handlers = useRef(new Set<Handler>());

  const subscribe = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let ws: WebSocket | null = null;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      if (stopped) return;
      const token = await tokenStore.getToken(); // sempre o token mais recente (pode ter sido renovado)
      if (!token || stopped) return;

      const socket = new WebSocket(`${BASE_URL.replace(/^http/, 'ws')}/ws?token=${encodeURIComponent(token)}`);
      ws = socket;

      socket.onopen = () => {
        retry = 0;
        setConnected(true);
      };
      socket.onmessage = (e) => {
        try {
          const { event, payload } = JSON.parse(String(e.data));
          handlers.current.forEach((h) => {
            try { h(event, payload); } catch { /* um assinante não derruba os outros */ }
          });
        } catch { /* mensagem inválida */ }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (ws === socket) setConnected(false);
        if (stopped) return;
        const delay = Math.min(30_000, 1000 * 2 ** retry++);
        timer = setTimeout(connect, delay);
      };
    };

    connect();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active' && (!ws || ws.readyState !== WebSocket.OPEN)) {
        if (timer) clearTimeout(timer);
        retry = 0;
        connect();
      }
    });

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      appState.remove();
      const socket = ws;
      ws = null;
      socket?.close();
      setConnected(false);
    };
  }, []);

  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
