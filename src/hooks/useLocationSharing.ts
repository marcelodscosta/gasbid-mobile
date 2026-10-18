import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api';

/** Intervalo mínimo entre envios ao servidor (ms). */
const SEND_INTERVAL_MS = 8000;

/**
 * Compartilha a posição do fornecedor com o backend enquanto `active` for true
 * e o usuário tiver ligado o compartilhamento. Ao desligar/desmontar, marca offline.
 *
 * Observação: usa localização em primeiro plano (a tela precisa estar aberta).
 */
export function useLocationSharing(active: boolean) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);

  const stopWatching = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
  }, []);

  const stop = useCallback(async () => {
    stopWatching();
    setSharing(false);
    try {
      await api.post('/tracking/offline');
    } catch {
      /* o backend também considera a posição velha como offline */
    }
  }, [stopWatching]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permissão de localização negada.');
        Alert.alert('Localização', 'Ative a permissão de localização nas configurações para compartilhar sua rota.');
        return;
      }

      await api.put('/tracking/settings', { enabled: true });

      stopWatching();
      subRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: SEND_INTERVAL_MS },
        (pos) => {
          const now = Date.now();
          if (now - lastSentRef.current < SEND_INTERVAL_MS) return;
          lastSentRef.current = now;
          const { latitude, longitude, heading, speed } = pos.coords;
          api
            .post('/tracking/location', {
              latitude,
              longitude,
              heading: heading != null && heading >= 0 ? heading : null,
              speed: speed != null && speed >= 0 ? speed : null,
            })
            .catch((e) => console.warn('Erro ao enviar localização:', e.response?.data?.message || e.message));
        },
      );
      setSharing(true);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Não foi possível iniciar o compartilhamento.');
      setSharing(false);
    }
  }, [stopWatching]);

  const toggle = useCallback(() => (sharing ? stop() : start()), [sharing, start, stop]);

  // Pedido saiu de IN_DELIVERY (entregue/cancelado) → encerra sozinho
  useEffect(() => {
    if (!active && sharing) stop();
  }, [active, sharing, stop]);

  // Ao sair da tela, para o GPS
  useEffect(() => () => stopWatching(), [stopWatching]);

  return { sharing, error, toggle };
}
