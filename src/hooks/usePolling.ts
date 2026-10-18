import { useEffect, useRef } from 'react';
import { useRealtime } from '../context/RealtimeContext';

/** Eventos de alta frequência que não devem disparar refresh das telas. */
const IGNORED_EVENTS = new Set(['SUPPLIER_LOCATION', 'SUPPLIER_OFFLINE']);

/**
 * Substitui `setInterval` + fetch.
 *
 * - Sem WebSocket: faz polling a cada `intervalMs` (comportamento anterior).
 * - Com WebSocket conectado: o polling vira apenas rede de segurança (≥ 30 s)
 *   e qualquer evento do servidor dispara um refresh imediato (com debounce).
 *
 * Isso corta a maior parte das requisições periódicas sem perder reatividade.
 */
export function usePolling(callback: () => unknown, intervalMs: number, enabled = true) {
  const { connected, subscribe } = useRealtime();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const effectiveMs = connected ? Math.max(intervalMs * 8, 30_000) : intervalMs;

  useEffect(() => {
    if (!enabled) return;

    const run = () => {
      try {
        Promise.resolve(callbackRef.current()).catch(() => {});
      } catch { /* callback síncrono lançou */ }
    };

    const id = setInterval(run, effectiveMs);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe((event) => {
      if (IGNORED_EVENTS.has(event)) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(run, 250);
    });

    return () => {
      clearInterval(id);
      if (debounce) clearTimeout(debounce);
      unsubscribe();
    };
  }, [enabled, effectiveMs, subscribe]);
}
