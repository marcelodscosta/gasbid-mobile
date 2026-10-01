import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator, Animated, ScrollView, TextInput, Platform, Alert, FlatList, Vibration, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Flame, ChevronRight, Package, Search, CreditCard, Clock, Calendar, MapPin as MapPinIcon, XCircle, Trophy, MessageSquare, Send, Zap } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';
import { mobileAudioService } from '../utils/sound';

const { width, height } = Dimensions.get('window');

const PAYMENT_METHODS = ['Pix', 'Dinheiro', 'Crédito', 'Débito'];

export default function HomeScreen({ navigation }: any) {
  const [requestState, setRequestState] = useState<'idle' | 'requesting' | 'searching'>('idle');
  const [userData, setUserData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [activeRequest, setActiveRequest] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nearbySuppliers, setNearbySuppliers] = useState<any[]>([]);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  
  // Rating Modal state
  const [ratingOrder, setRatingOrder] = useState<any>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Chat Modal state
  const [chatOrder, setChatOrder] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const { darkMode, colors } = useTheme();

  const webviewRef = useRef<WebView>(null);

  // Saved preferences & last order
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [autoAcceptBestPrice, setAutoAcceptBestPrice] = useState(true);

  // Form options
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<Date>(() => {
    const t = new Date();
    t.setHours(t.getHours() + 1);
    return t;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('');

  // Load saved preferences on mount
  useEffect(() => {
    AsyncStorage.getItem('@gasbid:last_payment_method').then(pm => {
      if (pm && PAYMENT_METHODS.includes(pm)) setPaymentMethod(pm);
    });
    AsyncStorage.getItem('@gasbid:last_order').then(raw => {
      if (raw) {
        try { setLastOrder(JSON.parse(raw)); } catch (e) {}
      }
    });
    AsyncStorage.getItem('@gasbid:auto_accept').then(val => {
      if (val !== null) setAutoAcceptBestPrice(val === 'true');
    });
  }, []);

  // Animation values for "searching"
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const markerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Always keep markers slightly pulsating
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    Animated.spring(markerAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true
    }).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          const logErr = (label: string, err: any) => {
            if (err.response?.status !== 401) {
              console.warn(`${label} failed:`, err.response?.status || err.message || err);
            }
          };

          const [meRes, productsRes, requestsRes, ordersRes, suppliersRes] = await Promise.all([
            api.get('/me').catch(err => { logErr('Me', err); return { data: null }; }),
            api.get('/products').catch(err => { logErr('Products', err); return { data: [] }; }),
            api.get('/buyer-requests?limit=10').catch(err => { logErr('Requests', err); return { data: { data: [] } }; }),
            api.get('/orders?limit=10').catch(err => { logErr('Orders', err); return { data: { data: [] } }; }),
            api.get('/suppliers/nearby').catch(err => { logErr('Suppliers', err); return { data: [] }; })
          ]);
          
          if (meRes.data) setUserData(meRes.data);
          setProducts(productsRes.data || []);
          setNearbySuppliers(Array.isArray(suppliersRes.data) ? suppliersRes.data : []);
          
          const activeReq = requestsRes.data?.data?.find((req: any) => 
            req.status === 'OPEN' || req.status === 'UNDER_REVIEW'
          );
          
          if (activeReq) {
            try {
              const fullRequest = await api.get(`/buyer-requests/${activeReq.id}`);
              setActiveRequest(fullRequest.data);
              setRequestState('searching');
            } catch (e) {
              console.warn('Failed to fetch full request', e);
            }
          }

          const ongoingOrder = ordersRes.data?.data?.find((o: any) => ['CREATED', 'CONFIRMED', 'IN_DELIVERY'].includes(o.status));
          if (ongoingOrder) {
            setActiveOrder(ongoingOrder);
          }

          // Populate lastOrder with full product names summary from latest API request
          const prevRequests = requestsRes.data?.data;
          if (prevRequests && prevRequests.length > 0) {
            const lastReq = prevRequests[0];
            if (lastReq && lastReq.items && lastReq.items.length > 0) {
              const reqItemsPayload = lastReq.items.map((i: any) => ({
                productId: i.productId || i.product?.id,
                quantity: i.quantity
              }));
              const reqProductsSummary = lastReq.items.map((i: any) => {
                const pName = i.product?.name || (productsRes.data || []).find((p: any) => p.id === (i.productId || i.product?.id))?.name || 'Gás';
                return `${i.quantity}x ${pName}`;
              }).join(' + ');
              const reqTotalQty = lastReq.items.reduce((acc: number, i: any) => acc + (i.quantity || 1), 0);
              const pmMatch = lastReq.observations?.match(/Pagamento:\s*([^\n\r]+)/i);
              const pm = pmMatch ? pmMatch[1].trim() : 'Pix';

              const latestOrderSummary = {
                items: reqItemsPayload,
                paymentMethod: pm,
                productsSummary: reqProductsSummary,
                qty: reqTotalQty,
              };
              setLastOrder(latestOrderSummary);
              AsyncStorage.setItem('@gasbid:last_order', JSON.stringify(latestOrderSummary));
            }
          }

        } catch (error) {
          console.error("Error fetching home data:", error);
        }
      };
      
      fetchData();
    }, [])
  );

  // Track previous proposal count to emit audio & haptic alert
  const prevProposalsCountRef = useRef(0);
  const isAutoAcceptingRef = useRef(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (requestState === 'searching' && activeRequest?.id) {
      interval = setInterval(async () => {
        try {
          const res = await api.get(`/buyer-requests/${activeRequest.id}`);
          const newProposalsCount = res.data?.proposals?.length || 0;
          if (newProposalsCount > prevProposalsCountRef.current) {
            mobileAudioService.notifyNewProposal();
            try { Vibration.vibrate(120); } catch (e) {}
          }
          prevProposalsCountRef.current = newProposalsCount;
          setActiveRequest(res.data);

          // Auto-aceite cego desabilitado. A decisão de escolher o vencedor agora é estritamente manual ou tratada de forma segura no backend (SLA).
          /* 
          const isExpired = res.data?.expiresAt && new Date(res.data.expiresAt).getTime() <= Date.now();
          if (isExpired && autoAcceptBestPrice && res.data?.proposals?.length > 0 && !isAutoAcceptingRef.current) {
            // ... (código antigo)
          }
          */
        } catch (e) {}
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [requestState, activeRequest?.id, autoAcceptBestPrice]);

  // Polling for activeOrder status updates (CREATED -> CONFIRMED -> IN_DELIVERY)
  useEffect(() => {
    let orderInterval: ReturnType<typeof setInterval>;
    if (activeOrder?.id) {
      orderInterval = setInterval(async () => {
        try {
          const res = await api.get(`/orders/${activeOrder.id}`);
          if (res.data) {
            if (res.data.status === 'DELIVERED' || res.data.status === 'CANCELLED') {
              setActiveOrder(null);
            } else {
              setActiveOrder(res.data);
            }
          }
        } catch (e) {}
      }, 5000);
    }
    return () => clearInterval(orderInterval);
  }, [activeOrder?.id]);

  const fetchMessages = async (orderId: string) => {
    try {
      const response = await api.get(`/orders/${orderId}/messages`);
      setChatMessages(response.data || []);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setChatMessages([]);
      } else {
        console.warn('Erro ao buscar mensagens:', error.response?.data?.message || error.message);
      }
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (chatOrder?.id) {
      fetchMessages(chatOrder.id);
      interval = setInterval(() => fetchMessages(chatOrder.id), 3000);
    }
    return () => clearInterval(interval);
  }, [chatOrder?.id]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !chatOrder?.id) return;
    setIsSendingMessage(true);
    try {
      await api.post(`/orders/${chatOrder.id}/messages`, { content: messageInput });
      setMessageInput('');
      fetchMessages(chatOrder.id);
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
      const msg = error.response?.data?.message || error.message || 'Erro ao enviar mensagem';
      alert(msg);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const handleRequestClick = () => {
    if (activeOrder) {
      alert('Você possui um pedido em andamento! Aguarde a conclusão da entrega para realizar uma nova cotação.');
      return;
    }
    if (activeRequest) {
      setRequestState('searching');
    } else {
      // Default to TODAY ASAP (Current time + 1 hour)
      const now = new Date();
      setSelectedDate(now);
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const hh = String(Math.min(23, now.getHours() + 1)).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      setDeadlineDate(`${dd}/${mm}/${yyyy}`);
      setDeadlineTime(`${hh}:${min}`);
      setRequestState('requesting');
    }
  };

  const handleExpressReorder = async () => {
    if (!lastOrder?.items?.length) return;
    if (activeOrder) {
      return alert('Você possui um pedido em andamento! Aguarde a conclusão da entrega.');
    }
    const addressId = userData?.company?.addresses?.[0]?.id;
    if (!addressId) {
      return alert('Endereço não encontrado no seu perfil.');
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      now.setHours(now.getHours() + 2);
      const res = await api.post('/buyer-requests', {
        addressId,
        items: lastOrder.items,
        deadline: now.toISOString(),
        observations: `Pedido Express (1-Clique) · Pagamento: ${lastOrder.paymentMethod || paymentMethod}`,
      });

      const fullRequest = await api.get(`/buyer-requests/${res.data.id}`);
      setActiveRequest(fullRequest.data);
      setRequestState('searching');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Erro ao realizar pedido express.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (text: string) => {
    let val = text.replace(/\D/g, '');
    if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
    if (val.length > 5) val = val.substring(0, 5) + '/' + val.substring(5, 9);
    setDeadlineDate(val);
  };
  
  const handleTimeChange = (text: string) => {
    let val = text.replace(/\D/g, '');
    if (val.length > 2) val = val.substring(0, 2) + ':' + val.substring(2, 4);
    setDeadlineTime(val);
  };

  const handleConfirm = async () => {
    const items = Object.entries(quantities)
      .filter(([_, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));

    if (items.length === 0) {
      return alert('Adicione pelo menos um produto.');
    }

    if (deadlineDate.length < 10 || deadlineTime.length < 5) {
      return alert('Preencha a data e hora da entrega corretamente.');
    }

    const addressId = userData?.company?.addresses?.[0]?.id;
    if (!addressId) {
      return alert('Endereço não encontrado no seu perfil.');
    }

    setIsSubmitting(true);
    try {
      const [dd, mm, yyyy] = deadlineDate.split('/');
      // Convert to local time string and parse properly
      const finalDeadlineDate = new Date(`${yyyy}-${mm}-${dd}T${deadlineTime}:00.000-03:00`).toISOString();
      const res = await api.post('/buyer-requests', {
        addressId,
        items,
        deadline: finalDeadlineDate,
        observations: `Pagamento: ${paymentMethod}`,
      });

      // Save preferences & last order
      AsyncStorage.setItem('@gasbid:last_payment_method', paymentMethod);
      const itemsSummary = items.map(i => {
        const prod = products.find(p => p.id === i.productId);
        return `${i.quantity}x ${prod?.name || 'Gás'}`;
      }).join(' + ');
      const totalQty = items.reduce((a, b) => a + b.quantity, 0);
      const orderSummary = {
        items,
        paymentMethod,
        productsSummary: itemsSummary,
        qty: totalQty,
      };
      AsyncStorage.setItem('@gasbid:last_order', JSON.stringify(orderSummary));
      setLastOrder(orderSummary);

      const fullRequest = await api.get(`/buyer-requests/${res.data.id}`);
      setActiveRequest(fullRequest.data);
      setRequestState('searching');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Erro ao criar pedido.';
      alert(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const res = await api.post(`/proposals/${proposalId}/accept`);
      alert('Proposta aceita! O pedido foi gerado e o fornecedor já foi notificado.');
      setRequestState('idle');
      setActiveRequest(null);
      
      // Load generated order for live delivery tracking on Home
      if (res.data?.id) {
        setActiveOrder(res.data);
      } else {
        // Fallback fetch ongoing order
        const ordersRes = await api.get('/orders?limit=5');
        const ongoing = ordersRes.data?.data?.find((o: any) => ['CREATED', 'CONFIRMED', 'IN_DELIVERY'].includes(o.status));
        if (ongoing) setActiveOrder(ongoing);
      }
    } catch (e) {
      alert('Erro ao aceitar proposta.');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      await api.post(`/proposals/${proposalId}/reject`);
      alert('Proposta recusada.');
      const res = await api.get(`/buyer-requests/${activeRequest.id}`);
      setActiveRequest(res.data);
    } catch (e) {
      alert('Erro ao recusar proposta.');
    }
  };

  const handleCancelOrder = () => {
    if (!activeOrder?.id) return;
    Alert.alert(
      'Cancelar Pedido',
      'Deseja realmente cancelar este pedido em andamento?',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.patch(`/orders/${activeOrder.id}/status`, { status: 'CANCELLED', notes: 'Cancelado pelo cliente' });
              alert('Pedido cancelado com sucesso.');
              setActiveOrder(null);
              setRequestState('idle');
            } catch (e: any) {
              alert(e.response?.data?.message || 'Erro ao cancelar pedido.');
            }
          }
        }
      ]
    );
  };

  const handleMarkDelivered = async () => {
    if (!activeOrder?.id) return;
    if (activeOrder.status === 'CREATED') {
      return alert('O fornecedor ainda está preparando o pedido para despacho.');
    }
    try {
      await api.patch(`/orders/${activeOrder.id}/status`, { status: 'DELIVERED', notes: 'Entregue pelo app mobile' });
      setRatingOrder(activeOrder);
      setActiveOrder(null);
      setRequestState('idle');
    } catch (e) {
      alert('Erro ao marcar pedido como entregue.');
    }
  };

  const handleRateOrder = async () => {
    if (!ratingOrder?.id) return;
    setIsSubmittingRating(true);
    try {
      await api.post(`/orders/${ratingOrder.id}/rate`, { stars, comment });
      alert(`Obrigado! Sua avaliação de ${stars} ★ foi enviada para ${ratingOrder.supplierCompany?.name || 'a distribuidora'}.`);
      setRatingOrder(null);
      setComment('');
      setStars(5);

      // Refresh requests and nearby suppliers to immediately reflect updated ratings
      const [requestsRes, suppliersRes] = await Promise.all([
        api.get('/buyer-requests?limit=10').catch(() => ({ data: { data: [] } })),
        api.get('/suppliers/nearby').catch(() => ({ data: [] }))
      ]);

      if (Array.isArray(suppliersRes.data)) {
        setNearbySuppliers(suppliersRes.data);
      }

      if (activeRequest?.id) {
        const fullReq = await api.get(`/buyer-requests/${activeRequest.id}`).catch(() => null);
        if (fullReq?.data) setActiveRequest(fullReq.data);
      }
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao enviar avaliação');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleStopSearch = async () => {
    try {
      await api.patch(`/buyer-requests/${activeRequest.id}/status`, { status: 'UNDER_REVIEW' });
      alert('Busca finalizada! Agora você pode escolher entre as propostas recebidas.');
      const res = await api.get(`/buyer-requests/${activeRequest.id}`);
      setActiveRequest(res.data);
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message;
      alert(`Erro ao finalizar busca: ${msg}`);
      console.error('Stop Search Error:', e.response?.data || e.message);
    }
  };

  const handleCancelRequest = async () => {
    try {
      await api.post(`/buyer-requests/${activeRequest.id}/cancel`);
      alert('Solicitação cancelada.');
      setRequestState('idle');
      setActiveRequest(null);
    } catch (e) {
      alert('Erro ao cancelar solicitação.');
    }
  };

  const firstName = userData?.name ? userData.name.split(' ')[0] : '...';
  const companyName = userData?.company?.name || 'Restaurante Sabor & Cia';
  
  const proposals = activeRequest?.proposals?.filter((p: any) => p.status !== 'REJECTED') || [];
  const proposalsCount = proposals.length;
  
  // Logic to show markers: Merge buyer location, nearbySuppliers, and suppliers from active proposals
  const supplierIdsWithProposals = proposals.map((p: any) => p.supplierCompanyId);

  const markersMap = new Map<string, any>();

  // 0. Buyer company location (User's location pin)
  const buyerMainAddr = userData?.company?.addresses?.find((a: any) => a.isMain) || userData?.company?.addresses?.[0];
  if (buyerMainAddr?.latitude && buyerMainAddr?.longitude) {
    const lat = Number(buyerMainAddr.latitude);
    const lng = Number(buyerMainAddr.longitude);
    if (!isNaN(lat) && !isNaN(lng)) {
      markersMap.set('buyer_user_location', {
        id: 'buyer_user_location',
        name: userData?.company?.name || 'Sua Localização',
        latitude: lat,
        longitude: lng,
        isBuyer: true,
      });
    }
  }

  // 1. Add all nearby suppliers
  nearbySuppliers.forEach((s: any) => {
    const mainAddr = s.addresses?.find((a: any) => a.isMain) || s.addresses?.[0];
    const lat = mainAddr?.latitude ? Number(mainAddr.latitude) : null;
    const lng = mainAddr?.longitude ? Number(mainAddr.longitude) : null;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      markersMap.set(s.id, {
        id: s.id,
        name: s.name,
        supplierId: s.id,
        latitude: lat,
        longitude: lng,
        hasProposal: supplierIdsWithProposals.includes(s.id),
        active: supplierIdsWithProposals.includes(s.id)
      });
    }
  });

  // 2. Add any proposal suppliers that might not be in nearby list
  proposals.forEach((p: any) => {
    const s = p.supplierCompany;
    if (s && !markersMap.has(s.id)) {
      const mainAddr = s.addresses?.find((a: any) => a.isMain) || s.addresses?.[0];
      const lat = mainAddr?.latitude ? Number(mainAddr.latitude) : null;
      const lng = mainAddr?.longitude ? Number(mainAddr.longitude) : null;
      if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
        markersMap.set(s.id, {
          id: s.id,
          name: s.name,
          supplierId: s.id,
          latitude: lat,
          longitude: lng,
          hasProposal: true,
          active: true
        });
      }
    }
  });

  const markersToShow = Array.from(markersMap.values());

  const webviewMarkers = useMemo(() => markersToShow.map((m: any) => ({
    name: m.name,
    latitude: m.latitude,
    longitude: m.longitude,
    isBuyer: !!m.isBuyer,
    hasProposal: !!m.hasProposal,
    isAcceptedWinner: activeOrder && m.supplierId === activeOrder.supplierCompanyId
  })), [markersToShow, activeOrder?.supplierCompanyId]);

  const staticMapSource = useMemo(() => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { padding: 0; margin: 0; background-color: ${darkMode ? '#111827' : '#FAFAFA'}; }
          html, body, #map { height: 100%; width: 100vw; }
          .leaflet-control-attribution { display: none; }
          ${darkMode ? `
            .leaflet-layer,
            .leaflet-control-zoom-in,
            .leaflet-control-zoom-out,
            .leaflet-control-attribution {
              filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
            }
          ` : ''}
          .leaflet-popup-content-wrapper {
            background: ${darkMode ? '#1F2937' : '#FFFFFF'} !important;
            color: ${darkMode ? '#F9FAFB' : '#111827'} !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            padding: 4px !important;
          }
          .leaflet-popup-tip {
            background: ${darkMode ? '#1F2937' : '#FFFFFF'} !important;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map, mapMarkers = [];
          window.pendingMarkers = ${JSON.stringify(webviewMarkers)};

          function initMap() {
            if (typeof L === 'undefined') {
              setTimeout(initMap, 100);
              return;
            }
            if (map) return;
            map = L.map('map', { zoomControl: false }).setView([-9.389000, -40.502000], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

            if (window.pendingMarkers) {
              window.renderMarkers(window.pendingMarkers);
            }
          }

          window.renderMarkers = function(markers) {
            if (!map || typeof L === 'undefined') {
              window.pendingMarkers = markers;
              return;
            }
            
            mapMarkers.forEach(function(m) { map.removeLayer(m); });
            mapMarkers = [];

            if (!markers || !markers.length) return;

            var bounds = [];
            markers.forEach(function(m) {
              if (typeof m.latitude !== 'number' || typeof m.longitude !== 'number') return;

              var color, size, border, text, zIndex;

              if (m.isBuyer) {
                color = '#8B5CF6';
                size = 26;
                border = 3;
                text = '🏠';
                zIndex = 1000;
              } else if (m.isAcceptedWinner) {
                color = '#22C55E';
                size = 28;
                border = 3;
                text = '✓';
                zIndex = 990;
              } else if (m.hasProposal) {
                color = '#3B82F6';
                size = 24;
                border = 3;
                text = 'R$';
                zIndex = 950;
              } else {
                color = '#F97316';
                size = 20;
                border = 2;
                text = '';
                zIndex = 900;
              }

              var html = '<div style="background-color: ' + color + '; width: ' + size + 'px; height: ' + size + 'px; border-radius: 50%; border: ' + border + 'px solid white; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 10px; font-family: sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">' + text + '</div>';
              
              var icon = L.divIcon({
                html: html,
                className: '',
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2]
              });

              var marker = L.marker([m.latitude, m.longitude], { icon: icon, zIndexOffset: zIndex }).addTo(map);
              if (m.name) {
                marker.bindPopup('<strong style="font-size:12px; font-family: sans-serif;">' + m.name + '</strong>');
              }
              mapMarkers.push(marker);
              bounds.push([m.latitude, m.longitude]);
            });

            if (bounds.length > 1) {
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            } else if (bounds.length === 1) {
              map.setView(bounds[0], 14);
            }
          };

          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initMap();
          } else {
            document.addEventListener('DOMContentLoaded', initMap);
          }
        </script>
      </body>
      </html>
    `;

    return { html };
  }, [darkMode]);

  useEffect(() => {
    if (!webviewRef.current || !isMapLoaded) return;
    
    const injection = `
      if (typeof window.renderMarkers === 'function') {
        window.renderMarkers(${JSON.stringify(webviewMarkers)});
      } else {
        window.pendingMarkers = ${JSON.stringify(webviewMarkers)};
      }
      true;
    `;
    
    webviewRef.current.injectJavaScript(injection);
  }, [JSON.stringify(webviewMarkers), isMapLoaded]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background Map using WebView and Leaflet for reliable cross-platform rendering without API keys */}
      <View style={styles.map}>
        <WebView 
          ref={webviewRef}
          source={staticMapSource}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          style={{ flex: 1 }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          onLoadEnd={() => setIsMapLoaded(true)}
          onMessage={(event) => console.log('WebView Message:', event.nativeEvent.data)}
        />
      </View>

      <SafeAreaView style={styles.content} pointerEvents="box-none">
        {/* Header Dashboard */}
        <View style={[styles.header, { backgroundColor: darkMode ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)' }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>Olá, {firstName}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{companyName}</Text>
          </View>
          <View style={styles.avatar}>
            <Flame color="white" size={20} />
          </View>
        </View>

        {/* Active Order Tracker (Delivery Flow Banner) */}
        {activeOrder && activeOrder.status !== 'DELIVERED' && activeOrder.status !== 'CANCELLED' && (
          <View style={[styles.activeOrderCard, { backgroundColor: darkMode ? '#2C2C2E' : '#FFF3E0', borderColor: '#FFE0B2', flexDirection: 'column', gap: 10 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={styles.orderInfo}>
                  <View style={[styles.orderStatusDot, { backgroundColor: activeOrder.status === 'IN_DELIVERY' ? '#2196F3' : '#FF9800' }]} />
                  <Text style={styles.orderStatusText}>
                    {activeOrder.status === 'CREATED' && 'Pedido Aceito · Aguardando Despacho'}
                    {activeOrder.status === 'CONFIRMED' && 'Confirmado pelo Fornecedor'}
                    {activeOrder.status === 'IN_DELIVERY' && '🚚 Saiu para Entrega!'}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  Fornecedor: <Text style={{ fontWeight: 'bold', color: colors.text }}>{activeOrder.supplierCompany?.name || 'Distribuidora'}</Text>
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleCancelOrder}
                style={{
                  backgroundColor: '#FFEBEE',
                  borderColor: '#FFCDD2',
                  borderWidth: 1,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <XCircle size={14} color="#D32F2F" />
                <Text style={{ color: '#D32F2F', fontSize: 12, fontWeight: 'bold' }}>Cancelar Pedido</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#F3E5F5',
                  borderColor: '#CE93D8',
                  borderWidth: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
                onPress={() => setChatOrder(activeOrder)}
              >
                <MessageSquare size={16} color="#9C27B0" />
                <Text style={{ color: '#9C27B0', fontSize: 13, fontWeight: 'bold' }}>Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                disabled={activeOrder.status === 'CREATED'}
                style={[
                  styles.confirmReceiptButton, 
                  { 
                    flex: 1,
                    marginHorizontal: 0,
                    backgroundColor: activeOrder.status === 'IN_DELIVERY' ? '#4CAF50' : activeOrder.status === 'CONFIRMED' ? '#FF9800' : '#B0BEC5',
                    opacity: activeOrder.status === 'CREATED' ? 0.5 : 1
                  }
                ]} 
                onPress={handleMarkDelivered}
              >
                <Text style={styles.confirmReceiptText}>
                  {activeOrder.status === 'CREATED' ? 'Aguardando Despacho...' : 'Confirmar Recebimento'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[
          styles.bottomSheet, 
          requestState !== 'idle' && (expandedProposalId ? styles.bottomSheetFullyExpanded : styles.bottomSheetExpanded), 
          { backgroundColor: requestState === 'searching' ? colors.card : (darkMode ? 'rgba(15,15,18,0.85)' : 'rgba(255,255,255,0.9)') }
        ]}>
          {requestState === 'idle' && (
            <View style={styles.idleContainer}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Precisa de gás para hoje?</Text>
              
              {lastOrder && !activeOrder && (
                <TouchableOpacity 
                  style={{
                    backgroundColor: darkMode ? '#2C2C2E' : '#FFF3E0',
                    borderWidth: 1,
                    borderColor: '#FFE0B2',
                    padding: 12,
                    borderRadius: 14,
                    marginBottom: 12,
                    width: '100%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onPress={handleExpressReorder}
                  disabled={isSubmitting}
                >
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Zap size={14} color="#FF5722" />
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#FF5722' }}>Repetir Último Pedido</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }} numberOfLines={2}>
                      {lastOrder.productsSummary || lastOrder.productName || 'Gás'}
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                      Pagamento: {lastOrder.paymentMethod || 'Pix'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#FF5722', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}>
                    {isSubmitting ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Pedir 1-Clique ➔</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}

              {!activeOrder && (
                <TouchableOpacity style={styles.requestButton} onPress={handleRequestClick}>
                  <Text style={styles.requestButtonText}>Nova Solicitação</Text>
                  <ChevronRight color="white" size={20} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {requestState === 'requesting' && (
            <ScrollView style={styles.requestForm}>
              <View style={styles.formHeader}>
                <Text style={[styles.formTitle, { color: colors.text }]}>O que você precisa?</Text>
                <TouchableOpacity onPress={() => setRequestState('idle')}>
                  <Text style={[styles.closeText, { color: colors.textSecondary }]}>Fechar</Text>
                </TouchableOpacity>
              </View>

              {products.map(product => (
                <View key={product.id} style={[styles.productRow, { backgroundColor: darkMode ? '#252525' : '#f9f9f9' }]}>
                  <View style={styles.productInfo}>
                    <Package size={20} color={colors.textSecondary} />
                    <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                  </View>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity onPress={() => handleQuantityChange(product.id, -1)} style={[styles.qBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={styles.qBtnText}>-</Text>
                    </TouchableOpacity>
                    <Text style={[styles.quantity, { color: colors.text }]}>{quantities[product.id] || 0}</Text>
                    <TouchableOpacity onPress={() => handleQuantityChange(product.id, 1)} style={[styles.qBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={styles.qBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View style={styles.deliverySection}>
                <View style={styles.optionHeader}>
                  <Clock size={18} color="#FF5722" />
                  <Text style={styles.optionTitle}>Previsão de Entrega (Hoje)</Text>
                </View>
                <View style={styles.dateTimeRow}>
                  {/* Botão Seletor de Data Visual */}
                  <TouchableOpacity 
                    style={[
                      styles.input, 
                      { 
                        flex: 2, 
                        marginRight: 10, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: darkMode ? '#252525' : '#FAFAFA'
                      }
                    ]} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {deadlineDate || 'Hoje'}
                    </Text>
                    <Calendar size={18} color="#FF5722" />
                  </TouchableOpacity>

                  {/* Botão Seletor de Horário Visual */}
                  <TouchableOpacity 
                    style={[
                      styles.input, 
                      { 
                        flex: 1, 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        backgroundColor: darkMode ? '#252525' : '#FAFAFA'
                      }
                    ]} 
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>
                      {deadlineTime || 'ASAP'}
                    </Text>
                    <Clock size={16} color="#FF5722" />
                  </TouchableOpacity>
                </View>

                {/* Seletor de Data Nativo */}
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onValueChange={(event, date) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (date) {
                        setSelectedDate(date);
                        const dd = String(date.getDate()).padStart(2, '0');
                        const mm = String(date.getMonth() + 1).padStart(2, '0');
                        const yyyy = date.getFullYear();
                        setDeadlineDate(`${dd}/${mm}/${yyyy}`);
                      }
                    }}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                )}

                {/* Seletor de Horário Nativo */}
                {showTimePicker && (
                  <DateTimePicker
                    value={selectedTime}
                    mode="time"
                    is24Hour={true}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onValueChange={(event, time) => {
                      setShowTimePicker(Platform.OS === 'ios');
                      if (time) {
                        setSelectedTime(time);
                        const hh = String(time.getHours()).padStart(2, '0');
                        const min = String(time.getMinutes()).padStart(2, '0');
                        setDeadlineTime(`${hh}:${min}`);
                      }
                    }}
                    onDismiss={() => setShowTimePicker(false)}
                  />
                )}
              </View>

              <View style={styles.optionsSection}>
                <View style={styles.optionHeader}>
                  <CreditCard size={18} color="#FF5722" />
                  <Text style={styles.optionTitle}>Forma de Pagamento</Text>
                </View>
                <View style={styles.chipsContainer}>
                  {PAYMENT_METHODS.map(m => (
                    <TouchableOpacity 
                      key={m} 
                      style={[styles.chip, paymentMethod === m && styles.chipActive]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text style={[styles.chipText, paymentMethod === m && styles.chipTextActive]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Chave de Auto-Aceite da Melhor Oferta */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12, padding: 12, backgroundColor: darkMode ? '#252525' : '#F5F5F5', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text }}>Auto-Aceite pelo Menor Preço</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Aceita automaticamente a proposta mais barata ao encerrar o tempo</Text>
                </View>
                <Switch
                  value={autoAcceptBestPrice}
                  onValueChange={(val) => {
                    setAutoAcceptBestPrice(val);
                    AsyncStorage.setItem('@gasbid:auto_accept', String(val));
                  }}
                  trackColor={{ false: '#767577', true: '#FF5722' }}
                />
              </View>

              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar Pedido</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.cancelButton} onPress={() => setRequestState('idle')} disabled={isSubmitting}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {requestState === 'searching' && (
            <View style={styles.searchingContainer}>
              {proposalsCount === 0 ? (
                <View style={{ alignItems: 'center' }}>
                  <Animated.View style={[styles.radarCircle, { transform: [{ scale: pulseAnim }] }]}>
                    <Search color="white" size={32} />
                  </Animated.View>
                  <Text style={styles.greeting}>Buscando fornecedores...</Text>
                  <Text style={styles.subtitle}>Enviamos seu pedido para a rede em tempo real.</Text>
                  
                  {activeRequest?.expiresAt && (
                    <View style={{ marginTop: 12 }}>
                      <MobileCountdownTimer expiresAt={activeRequest.expiresAt} />
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ width: '100%', flex: 1 }}>
                  <View style={styles.proposalsHeader}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={[styles.greeting, { color: colors.text }]}>
                          {activeRequest?.status === 'UNDER_REVIEW' ? 'Busca Encerrada' : `${proposalsCount} Proposta${proposalsCount > 1 ? 's' : ''} Encontrada${proposalsCount > 1 ? 's' : ''}`}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                          {activeRequest?.status === 'UNDER_REVIEW' ? 'Escolha a melhor oferta abaixo' : 'Revendas próximas estão respondendo'}
                        </Text>
                      </View>

                      {/* Cronômetro da Janela de Ofertas em Tempo Real */}
                      {activeRequest?.status === 'OPEN' && activeRequest?.expiresAt && (
                        <MobileCountdownTimer expiresAt={activeRequest.expiresAt} />
                      )}
                    </View>
                  </View>
                  
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.proposalsScroll}>
                    {proposals.map((prop: any) => {
                      const itemsTotal = prop.items?.reduce((acc: number, i: any) => {
                        const q = activeRequest.items?.find((ri: any) => ri.id === i.buyerRequestItemId)?.quantity || 1;
                        return acc + (i.unitPrice * q);
                      }, 0) || 0;
                      const grandTotal = itemsTotal + (prop.freightPrice || 0);

                      const allTotals = proposals.map((p: any) => {
                        const pItemsTotal = p.items?.reduce((acc: number, i: any) => {
                          const q = activeRequest.items?.find((ri: any) => ri.id === i.buyerRequestItemId)?.quantity || 1;
                          return acc + (i.unitPrice * q);
                        }, 0) || 0;
                        return pItemsTotal + (p.freightPrice || 0);
                      });
                      const minTotal = allTotals.length > 0 ? Math.min(...allTotals) : Infinity;
                      const isBestPrice = grandTotal === minTotal;

                      const matchedSupplier = nearbySuppliers.find((s: any) => s.id === prop.supplierCompanyId);
                      const ratings = prop.supplierCompany?.ratingsReceived?.length > 0 
                        ? prop.supplierCompany.ratingsReceived 
                        : matchedSupplier?.ratingsReceived || [];
                      
                      const starsAvg = ratings.length > 0
                        ? (ratings.reduce((acc: number, r: any) => acc + r.stars, 0) / ratings.length).toFixed(1)
                        : null;

                      const isExpanded = expandedProposalId === prop.id;

                        // Calculate real distance using coordinates
                        let displayDistance = prop.distanceKm;
                        if ((displayDistance === null || displayDistance === undefined) && activeRequest?.address && prop.supplierCompany?.addresses?.[0]) {
                          const lat1 = activeRequest.address.latitude;
                          const lon1 = activeRequest.address.longitude;
                          const lat2 = prop.supplierCompany.addresses[0].latitude;
                          const lon2 = prop.supplierCompany.addresses[0].longitude;

                          if (lat1 && lon1 && lat2 && lon2) {
                            const R = 6371; // Radius of earth in km
                            const dLat = (lat2 - lat1) * (Math.PI / 180);
                            const dLon = (lon2 - lon1) * (Math.PI / 180);
                            const a = 
                              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
                              Math.sin(dLon / 2) * Math.sin(dLon / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            displayDistance = R * c;
                          }
                        }

                        return (
                          <View 
                            key={prop.id} 
                            style={[
                              styles.proposalCard, 
                              { 
                                backgroundColor: colors.card, 
                                borderColor: isBestPrice ? '#4CAF50' : colors.border, 
                                borderWidth: isBestPrice ? 2 : 1,
                                marginBottom: 12, 
                                padding: 14 
                              }
                            ]}
                          >
                            {/* Badge do Troféu de Melhor Oferta */}
                            {isBestPrice && (
                              <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: '#E8F5E9',
                                alignSelf: 'flex-start',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 6,
                                marginBottom: 8,
                                borderWidth: 1,
                                borderColor: '#C8E6C9'
                              }}>
                                <Trophy size={14} color="#2E7D32" />
                                <Text style={{ color: '#2E7D32', fontSize: 11, fontWeight: 'bold' }}>
                                  MELHOR OFERTA (MENOR PREÇO)
                                </Text>
                              </View>
                            )}
                            
                            {/* VISÃO RESUMIDA (SEMPRE VISÍVEL) */}
                            <TouchableOpacity 
                              activeOpacity={0.7}
                              onPress={() => setExpandedProposalId(isExpanded ? null : prop.id)}
                              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                            <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text style={[styles.propSupplier, { color: colors.text, fontSize: 15 }]} numberOfLines={1}>
                                {prop.supplierCompany?.name || 'Fornecedor'}
                              </Text>
                              
                              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                                <View style={{ backgroundColor: '#FFF8E1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center' }}>
                                  <Text style={{ color: '#FF9800', fontSize: 11, fontWeight: 'bold' }}>
                                    {starsAvg ? `★ ${starsAvg}` : '★ Novo'}
                                  </Text>
                                </View>
                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                  📍 {displayDistance !== null && displayDistance !== undefined ? `${Number(displayDistance).toFixed(1)} km` : '--'}
                                </Text>
                              </View>
                            </View>

                            {/* Total Geral em Destaque no Card Resumido */}
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold' }}>Total</Text>
                              <Text style={{ fontSize: 16, fontWeight: '900', color: '#FF5722' }}>
                                R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </Text>
                              <Text style={{ fontSize: 11, color: '#FF5722', fontWeight: 'bold', marginTop: 2 }}>
                                {isExpanded ? '▲ Ocultar' : '▼ Detalhes'}
                              </Text>
                            </View>
                          </TouchableOpacity>

                          {/* CONTEÚDO EXPANDIDO (EXIBIDO AO CLICAR EM DETALHES) */}
                          {isExpanded && (
                            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: darkMode ? '#3A3A3C' : '#E5E7EB' }}>
                              
                              {/* Lista de Itens com Preço Unitário, Quantidade e Subtotal */}
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' }}>
                                Itens da Oferta:
                              </Text>
                              
                              <View style={{ padding: 10, backgroundColor: darkMode ? '#2C2C2E' : '#F9FAFB', borderRadius: 10, marginBottom: 10 }}>
                                {prop.items?.map((item: any) => {
                                  const requestItem = activeRequest.items?.find((ri: any) => ri.id === item.buyerRequestItemId);
                                  const productName = requestItem?.product?.name || item.buyerRequestItem?.product?.name || 'Produto';
                                  const qty = requestItem?.quantity || item.buyerRequestItem?.quantity || 1;
                                  const unitPrice = item.unitPrice || 0;
                                  const subtotal = qty * unitPrice;
                                  
                                  return (
                                    <View key={item.id} style={{ marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: darkMode ? '#3A3A3C' : '#E5E7EB' }}>
                                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{productName}</Text>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text }}>
                                          R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </Text>
                                      </View>
                                      <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 1 }}>
                                        {qty} un. × R$ {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                                      </Text>
                                    </View>
                                  );
                                })}

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Frete:</Text>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>
                                    {prop.freightPrice ? `R$ ${prop.freightPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Grátis'}
                                  </Text>
                                </View>
                              </View>

                              {/* Previsão de Entrega */}
                              {prop.deliveryDeadline && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                  <Clock size={14} color="#FF9800" style={{ marginRight: 6 }} />
                                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                                    Previsão: <Text style={{ fontWeight: 'bold', color: colors.text }}>{new Date(prop.deliveryDeadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
                                  </Text>
                                </View>
                              )}

                              {/* Observações */}
                              {prop.observations ? (
                                <View style={{ backgroundColor: darkMode ? '#3A3A3C' : '#FFF8E1', padding: 8, borderRadius: 8, marginBottom: 12 }}>
                                  <Text style={{ fontSize: 11, fontStyle: 'italic', color: darkMode ? '#DDD' : '#F57F17' }}>
                                    💬 "{prop.observations}"
                                  </Text>
                                </View>
                              ) : null}

                              {/* Botões de Ação */}
                              <View style={styles.propActions}>
                                <TouchableOpacity 
                                  style={[styles.acceptButton, { flex: 1, marginRight: 8, alignItems: 'center' }]} 
                                  onPress={() => handleAcceptProposal(prop.id)}
                                >
                                  <Text style={styles.acceptButtonText}>Aceitar Oferta</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                  style={[styles.rejectButton, { paddingHorizontal: 14, alignItems: 'center' }]} 
                                  onPress={() => handleRejectProposal(prop.id)}
                                >
                                  <Text style={styles.rejectButtonText}>Recusar</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View style={[styles.searchingActions, { flexDirection: 'row', gap: 10 }]}>
                {activeRequest?.status === 'OPEN' && proposalsCount > 0 && (
                  <TouchableOpacity style={[styles.stopButton, { flex: 2, backgroundColor: '#4F46E5', marginBottom: 0, borderColor: '#4F46E5', borderWidth: 1 }]} onPress={handleStopSearch}>
                    <Text style={[styles.stopButtonText, { color: '#FFF', fontSize: 14 }]}>Finalizar e Escolher</Text>
                  </TouchableOpacity>
                )}
                {activeRequest?.status === 'OPEN' && (
                  <TouchableOpacity style={[styles.stopButton, { flex: 1, backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, marginBottom: 0 }]} onPress={handleCancelRequest}>
                    <Text style={[styles.stopButtonText, { color: '#DC2626', fontSize: 14 }]}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                {activeRequest?.status === 'UNDER_REVIEW' && (
                  <TouchableOpacity style={[styles.stopButton, { flex: 1, backgroundColor: '#F3F4F6', marginBottom: 0 }]} onPress={handleCancelRequest}>
                    <Text style={[styles.stopButtonText, { color: '#6B7280', fontSize: 14 }]}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Modal de Avaliação pós-entrega (5 Estrelas + Comentário Opcional) */}
      {ratingOrder && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000
        }}>
          <View style={{
            backgroundColor: colors.card, width: '100%', borderRadius: 24,
            padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
              Avaliar Fornecedor
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 16, textAlign: 'center' }}>
              Como foi sua experiência com a entrega da <Text style={{ fontWeight: 'bold', color: colors.text }}>{ratingOrder.supplierCompany?.name || 'Distribuidora'}</Text>?
            </Text>

            {/* Estrelas Clicáveis (1 a 5) */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((starNumber) => (
                <TouchableOpacity
                  key={starNumber}
                  onPress={() => setStars(starNumber)}
                  style={{ padding: 4 }}
                >
                  <Text style={{ fontSize: 36, color: starNumber <= stars ? '#FFB800' : '#DDD' }}>
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Campo de Comentário Opcional */}
            <TextInput
              style={{
                width: '100%',
                backgroundColor: darkMode ? '#2C2C2E' : '#F9FAFB',
                color: colors.text,
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                borderWidth: 1,
                borderColor: colors.border,
                marginBottom: 20,
                minHeight: 60,
                textAlignVertical: 'top'
              }}
              placeholder="Escreva um comentário opcional (ex: Entrega super rápida!)..."
              placeholderTextColor={colors.textSecondary}
              multiline
              value={comment}
              onChangeText={setComment}
            />

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.border }}
                onPress={() => setRatingOrder(null)}
              >
                <Text style={{ fontWeight: 'bold', color: colors.text }}>Pular</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#FF5722' }}
                onPress={handleRateOrder}
                disabled={isSubmittingRating}
              >
                {isSubmittingRating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={{ fontWeight: 'bold', color: 'white' }}>Enviar {stars} ★</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Chat Modal */}
      {chatOrder && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000
        }}>
          <View style={{
            backgroundColor: colors.card, width: '100%', height: '80%', borderRadius: 24,
            borderWidth: 1, borderColor: colors.border, display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text }}>Chat com Fornecedor</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{chatOrder.supplierCompany?.name || 'Distribuidora'}</Text>
              </View>
              <TouchableOpacity onPress={() => setChatOrder(null)} style={{ padding: 6 }}>
                <Text style={{ fontSize: 24, color: '#999', lineHeight: 24 }}>×</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={chatMessages}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              inverted={false}
              renderItem={({ item: msg }) => {
                const isMe = msg.sender.companyId === (userData?.companyId || userData?.company?.id);
                return (
                  <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 12 }}>
                    {!isMe && <Text style={{ fontSize: 11, color: '#888', marginBottom: 2, marginLeft: 4 }}>{msg.sender.name}</Text>}
                    <View style={{
                      backgroundColor: isMe ? '#FF5722' : (darkMode ? '#3A3A3C' : '#F5F5F5'),
                      padding: 12,
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                    }}>
                      <Text style={{ color: isMe ? 'white' : colors.text, fontSize: 14 }}>{msg.content}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>Nenhuma mensagem ainda. Digite abaixo para conversar!</Text>
              }
            />

            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ flex: 1, backgroundColor: darkMode ? '#2C2C2E' : '#F5F5F5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, color: colors.text }}
                placeholder="Digite sua mensagem..."
                placeholderTextColor={colors.textSecondary}
                value={messageInput}
                onChangeText={setMessageInput}
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity
                style={{ backgroundColor: '#FF5722', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }}
                onPress={handleSendMessage}
                disabled={isSendingMessage || !messageInput.trim()}
              >
                {isSendingMessage ? <ActivityIndicator color="white" size="small" /> : <Send size={20} color="white" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function MobileCountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Finalizado');
        setIsExpired(true);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <View style={{
      backgroundColor: isExpired ? '#FFEEEA' : '#1A1200',
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 2,
      borderColor: isExpired ? '#FF3D00' : '#FF9800',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'center',
      marginTop: 4,
    }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: isExpired ? '#FF3D00' : '#FF9800', letterSpacing: 2, fontVariant: ['tabular-nums'] }}>
        ⏱ {timeLeft}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { position: 'absolute', top: 0, left: 0, width: width, height: height },
  content: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  greeting: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF5722', justifyContent: 'center', alignItems: 'center' },
  
  activeOrderCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF3E0', margin: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FFE0B2' },
  orderInfo: { flexDirection: 'row', alignItems: 'center' },
  orderStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 8 },
  orderStatusText: { fontSize: 14, fontWeight: '600', color: '#E65100' },
  confirmReceiptButton: { backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  confirmReceiptText: { color: 'white', fontSize: 12, fontWeight: 'bold' },

  bottomSheet: { 
    position: 'absolute', 
    bottom: 0, 
    width: '100%', 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: 20, 
    paddingBottom: 30, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: -6 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 16, 
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  bottomSheetExpanded: { height: height * 0.58 },
  bottomSheetFullyExpanded: { height: height * 0.75 },
  idleContainer: { paddingVertical: 10 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  requestButton: { backgroundColor: '#FF5722', borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  requestButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  requestForm: { flex: 1 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  formTitle: { fontSize: 20, fontWeight: 'bold' },
  closeText: { fontWeight: '600' },
  productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: 16, borderRadius: 16 },
  productInfo: { flexDirection: 'row', alignItems: 'center' },
  productName: { fontSize: 16, fontWeight: '600', marginLeft: 12 },
  quantityControls: { flexDirection: 'row', alignItems: 'center' },
  qBtn: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  qBtnText: { fontSize: 18, fontWeight: 'bold', color: '#FF5722' },
  quantity: { fontSize: 16, fontWeight: 'bold', marginHorizontal: 16, minWidth: 20, textAlign: 'center' },
  
  deliverySection: { marginTop: 8 },
  optionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  optionTitle: { fontSize: 15, fontWeight: 'bold', marginLeft: 8 },
  dateTimeRow: { flexDirection: 'row', marginBottom: 20 },
  input: { borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1 },
  
  optionsSection: { marginBottom: 24 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 8, borderWidth: 1 },
  chipActive: { backgroundColor: '#FF5722', borderColor: '#FF5722' },
  chipText: { fontWeight: '600' },
  chipTextActive: { color: 'white' },
  
  confirmButton: { backgroundColor: '#FF5722', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 10 },
  confirmButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { padding: 16, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { color: '#888', fontSize: 15, fontWeight: '600' },
  
  searchingContainer: { padding: 24, alignItems: 'center', height: '100%' },
  radarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF5722', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  proposalsHeader: { width: '100%', marginBottom: 20 },
  proposalsScroll: { width: '100%', marginBottom: 20 },
  proposalCard: { width: '100%', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  
  searchingActions: { width: '100%', marginTop: 'auto', paddingBottom: 20 },
  stopButton: { backgroundColor: '#FF5722', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  stopButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cancelLink: { paddingVertical: 10, alignItems: 'center' },
  cancelLinkText: { color: '#FF5722', fontSize: 14, fontWeight: '600' },

  supplierMarker: { backgroundColor: 'rgba(255, 87, 34, 0.4)', width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  propHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  propSupplier: { fontWeight: 'bold', fontSize: 16, flex: 1, marginRight: 8 },
  propDistance: { fontSize: 13, color: '#FF5722', fontWeight: 'bold', backgroundColor: '#FF572215', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  propItemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  propItemText: { fontSize: 14 },
  propItemPrice: { fontSize: 14, fontWeight: '600' },
  propActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  acceptButton: { backgroundColor: '#FF5722', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 12 },
  acceptButtonText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
  rejectButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  rejectButtonText: { fontSize: 14, fontWeight: 'bold' },

  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  scoreTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagFast: { backgroundColor: '#1565C033' },
  tagRated: { backgroundColor: '#2E7D3233' },
  scoreTagText: { fontSize: 10, fontWeight: 'bold', color: '#aaa' }
});

const darkMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] }
];
