import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api';

const POLL_MS = 5000;

interface Props {
  orderId: string;
  destination?: { latitude?: number | null; longitude?: number | null } | null;
  textColor?: string;
  mutedColor?: string;
}

/** Posição ao vivo do fornecedor para um pedido em entrega. */
export default function LiveTrackingMap({ orderId, destination, textColor = '#111', mutedColor = '#666' }: Props) {
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'online' | 'offline' | 'disabled'>('offline');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const lastPos = useRef<{ latitude: number; longitude: number; heading?: number | null } | null>(null);

  const destLat = destination?.latitude;
  const destLng = destination?.longitude;

  const html = useMemo(
    () => `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body,html,#map{margin:0;padding:0;width:100%;height:100%;}
      .truck{font-size:26px;line-height:26px;text-align:center}</style>
    </head><body><div id="map"></div><script>
      var map = L.map('map',{zoomControl:false}).setView([${destLat ?? -9.39},${destLng ?? -40.5}],14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      ${destLat != null && destLng != null ? `L.marker([${destLat},${destLng}]).addTo(map).bindPopup('Seu endereço');` : ''}
      var truck = null, fitted = false;
      window.setTruck = function(lat, lng) {
        var ll = [lat, lng];
        if (!truck) {
          truck = L.marker(ll, {icon: L.divIcon({className:'truck', html:'🚚', iconSize:[28,28]})}).addTo(map);
        } else { truck.setLatLng(ll); }
        ${destLat != null && destLng != null
          ? `if (!fitted) { map.fitBounds([ll,[${destLat},${destLng}]], {padding:[40,40]}); fitted = true; }`
          : 'map.setView(ll, 15);'}
      };
      window.clearTruck = function() { if (truck) { map.removeLayer(truck); truck = null; } };
    </script></body></html>`,
    [destLat, destLng],
  );

  const pushToMap = (pos: { latitude: number; longitude: number } | null) => {
    webRef.current?.injectJavaScript(
      pos ? `window.setTruck(${pos.latitude},${pos.longitude});true;` : 'window.clearTruck();true;',
    );
  };

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await api.get(`/orders/${orderId}/tracking`);
        if (!alive) return;
        if (!data.trackingEnabled) {
          setStatus('disabled');
          lastPos.current = null;
        } else if (data.location) {
          lastPos.current = data.location;
          setUpdatedAt(new Date(data.location.updatedAt));
          setStatus(data.online ? 'online' : 'offline');
        } else {
          setStatus('offline');
        }
      } catch {
        /* mantém o último estado; tenta de novo no próximo ciclo */
      } finally {
        if (alive) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [orderId]);

  // Reflete a última posição no mapa (inclusive quando o WebView termina de carregar)
  useEffect(() => {
    if (!ready) return;
    pushToMap(status === 'disabled' ? null : lastPos.current);
  }, [ready, status, updatedAt]);

  const label =
    status === 'online'
      ? 'Entregador a caminho — posição ao vivo'
      : status === 'disabled'
      ? 'O fornecedor não compartilha a localização deste pedido.'
      : updatedAt
      ? `Sinal perdido. Última posição às ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Aguardando o fornecedor compartilhar a localização...';

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: status === 'online' ? '#22C55E' : '#9CA3AF',
          }}
        />
        <Text style={{ flex: 1, fontSize: 12, fontWeight: '600', color: status === 'online' ? textColor : mutedColor }}>
          {label}
        </Text>
        {loading && <ActivityIndicator size="small" />}
      </View>
      <View style={{ height: 200, borderRadius: 12, overflow: 'hidden' }}>
        <WebView
          ref={webRef}
          source={{ html }}
          style={{ flex: 1 }}
          scrollEnabled={false}
          javaScriptEnabled
          onLoadEnd={() => setReady(true)}
        />
      </View>
    </View>
  );
}
