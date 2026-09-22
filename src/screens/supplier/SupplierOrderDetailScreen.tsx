import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, FlatList, Modal, KeyboardAvoidingView, Platform, Vibration
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, Package, MapPin, Truck, CheckCircle, Clock, MessageSquare, Send } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../api';
import { useTheme } from '../../context/ThemeContext';

const timelineLabels: Record<string, string> = {
  CREATED: 'Pedido Gerado',
  CONFIRMED: 'Confirmado',
  IN_DELIVERY: 'Em Entrega',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
};

export default function SupplierOrderDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { order: initialOrder, openChat } = route.params;
  const { colors, darkMode } = useTheme();

  const [order, setOrder] = useState<any>(initialOrder);
  const [isUpdating, setIsUpdating] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showChat, setShowChat] = useState(!!openChat);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevTotalRef = React.useRef(order._count?.messages || 0);

  useEffect(() => {
    const checkUnread = async () => {
      try {
        const lastSeen = await AsyncStorage.getItem(`lastSeenMessages_${order.id}`);
        const seenCount = parseInt(lastSeen || '0', 10);
        const total = order._count?.messages || 0;
        
        if (total > prevTotalRef.current && total > seenCount && !showChat) {
          Vibration.vibrate([0, 250, 200, 250]);
        }
        prevTotalRef.current = total;

        if (total > seenCount) {
          setUnreadCount(total - seenCount);
        } else {
          setUnreadCount(0);
        }
      } catch (e) {}
    };
    checkUnread();
  }, [order._count?.messages, order.id, showChat]);

  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
      const currentTotal = Math.max(order._count?.messages || 0, chatMessages.length);
      AsyncStorage.setItem(`lastSeenMessages_${order.id}`, currentTotal.toString()).catch(() => {});
    }
  }, [showChat, chatMessages.length, order._count?.messages, order.id]);

  const fetchOrder = async () => {
    try {
      const res = await api.get(`/orders/${order.id}`);
      setOrder(res.data);
    } catch (e) {}
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/orders/${order.id}/messages`);
      setChatMessages(res.data || []);
    } catch (e: any) {
      if (e.response?.status === 404) setChatMessages([]);
      else console.warn('Erro fetchMessages Fornecedor:', e.response?.data || e.message);
    }
  };

  useEffect(() => {
    fetchOrder();
    const orderInterval = setInterval(fetchOrder, 6000);
    return () => clearInterval(orderInterval);
  }, [order.id]);

  useEffect(() => {
    if (!showChat) return;
    fetchMessages();
    const chatInterval = setInterval(fetchMessages, 3000);
    return () => clearInterval(chatInterval);
  }, [showChat, order.id]);

  const scrollViewRef = React.useRef<ScrollView>(null);
  useEffect(() => {
    if (chatMessages.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatMessages]);

  const handleUpdateStatus = async (newStatus: 'CONFIRMED' | 'IN_DELIVERY') => {
    const actionLabel = newStatus === 'CONFIRMED' ? 'confirmar' : 'despachar para entrega';
    Alert.alert(
      'Confirmação',
      `Deseja ${actionLabel} este pedido?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await api.patch(`/orders/${order.id}/status`, {
                status: newStatus,
                notes: newStatus === 'CONFIRMED' ? 'Confirmado pelo fornecedor' : 'Pedido despachado para entrega',
              });
              await fetchOrder();
            } catch (e: any) {
              Alert.alert('Erro', e.response?.data?.message || 'Não foi possível atualizar o status.');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    setIsSending(true);
    try {
      await api.post(`/orders/${order.id}/messages`, { content: messageInput });
      setMessageInput('');
      await fetchMessages();
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
    } finally {
      setIsSending(false);
    }
  };

  const deliveryAddress = order.buyerRequest?.address;
  const products = order.buyerRequest?.items?.map((i: any) => `${i.quantity}x ${i.product?.name}`).join(' + ') || 'Produtos';
  const timeline = order.timeline || [];

  const mapSource = deliveryAddress?.latitude && deliveryAddress?.longitude ? {
    html: `<!DOCTYPE html><html><head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body,html,#map{margin:0;padding:0;width:100%;height:100%;}${darkMode ? '.leaflet-layer{filter:invert(100%) hue-rotate(180deg);}' : ''}</style>
    </head><body>
      <div id="map"></div>
      <script>
        var map = L.map('map',{zoomControl:false}).setView([${deliveryAddress.latitude},${deliveryAddress.longitude}],15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        L.marker([${deliveryAddress.latitude},${deliveryAddress.longitude}]).addTo(map).bindPopup('<b>Endereço de Entrega</b>').openPopup();
      </script>
    </body></html>`
  } : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Detalhes do Pedido</Text>
        <TouchableOpacity onPress={() => setShowChat(!showChat)} style={{ padding: 4, position: 'relative' }}>
          <MessageSquare size={22} color="#4F46E5" />
          {unreadCount > 0 && (
            <View style={{
              position: 'absolute', top: 0, right: 0,
              backgroundColor: '#EF4444', width: 14, height: 14, borderRadius: 7,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1.5, borderColor: colors.background
            }}>
              <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status + Actions */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>STATUS DO PEDIDO</Text>

          {/* Timeline */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 8 }}>
            {['CREATED', 'CONFIRMED', 'IN_DELIVERY', 'DELIVERED'].map((s, i, arr) => {
              const reached = ['CREATED', 'CONFIRMED', 'IN_DELIVERY', 'DELIVERED'].indexOf(order.status) >= i;
              return (
                <React.Fragment key={s}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <View style={{
                      width: 28, height: 28, borderRadius: 14,
                      backgroundColor: reached ? '#4F46E5' : colors.border,
                      alignItems: 'center', justifyContent: 'center'
                    }}>
                      {reached ? <CheckCircle size={14} color="white" /> : <Clock size={14} color={colors.textSecondary} />}
                    </View>
                    <Text style={{ fontSize: 9, marginTop: 4, color: reached ? '#4F46E5' : colors.textSecondary, textAlign: 'center', fontWeight: reached ? 'bold' : 'normal' }}>
                      {timelineLabels[s]}
                    </Text>
                  </View>
                  {i < arr.length - 1 && (
                    <View style={{ height: 2, flex: 0.3, backgroundColor: ['CONFIRMED', 'IN_DELIVERY', 'DELIVERED'].indexOf(order.status) >= i ? '#4F46E5' : colors.border }} />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          {/* Action buttons */}
          {order.status === 'CREATED' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#4F46E5' }]}
              onPress={() => handleUpdateStatus('CONFIRMED')}
              disabled={isUpdating}
            >
              {isUpdating ? <ActivityIndicator color="white" /> : (
                <>
                  <CheckCircle size={18} color="white" />
                  <Text style={styles.actionBtnText}>Confirmar Pedido</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {order.status === 'CONFIRMED' && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669' }]}
              onPress={() => handleUpdateStatus('IN_DELIVERY')}
              disabled={isUpdating}
            >
              {isUpdating ? <ActivityIndicator color="white" /> : (
                <>
                  <Truck size={18} color="white" />
                  <Text style={styles.actionBtnText}>Despachar para Entrega</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          {order.status === 'IN_DELIVERY' && (
            <View style={{ backgroundColor: '#D1FAE5', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Truck size={18} color="#059669" />
              <Text style={{ color: '#065F46', fontWeight: 'bold', fontSize: 14 }}>
                Pedido em rota de entrega. Aguardando confirmação do comprador.
              </Text>
            </View>
          )}
          {order.status === 'DELIVERED' && (
            <View style={{ backgroundColor: '#F0FDF4', padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={18} color="#16A34A" />
              <Text style={{ color: '#15803D', fontWeight: 'bold', fontSize: 14 }}>Pedido entregue com sucesso!</Text>
            </View>
          )}
        </View>

        {/* Products */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ITENS DO PEDIDO</Text>
          {order.buyerRequest?.items?.map((item: any) => (
            <View key={item.id} style={[styles.productRow, { borderBottomColor: colors.border }]}>
              <Package size={18} color={colors.textSecondary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>{item.product?.name}</Text>
              </View>
              <Text style={{ fontWeight: 'bold', color: colors.text }}>{item.quantity} un.</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ color: colors.textSecondary }}>Total do pedido</Text>
            <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#4F46E5' }}>
              R$ {order.totalPrice?.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>

        {/* Delivery Address + Map */}
        {deliveryAddress && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ENDEREÇO DE ENTREGA</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <MapPin size={18} color="#4F46E5" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: colors.text }}>
                  {deliveryAddress.street}, {deliveryAddress.number}
                </Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {deliveryAddress.neighborhood} · {deliveryAddress.city}/{deliveryAddress.state}
                </Text>
                <Text style={{ color: colors.textSecondary }}>{deliveryAddress.zipCode}</Text>
              </View>
            </View>
            {mapSource && (
              <View style={{ height: 180, borderRadius: 12, overflow: 'hidden' }}>
                <WebView
                  source={mapSource}
                  style={{ flex: 1 }}
                  scrollEnabled={false}
                  javaScriptEnabled
                  onLoadEnd={() => setIsMapLoaded(true)}
                />
              </View>
            )}
          </View>
        )}

        {/* Buyer info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>COMPRADOR</Text>
          <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 15 }}>
            {order.buyerCompany?.name || 'Comprador'}
          </Text>
          {order.buyerCompany?.cnpj && (
            <Text style={{ color: colors.textSecondary, marginTop: 2 }}>CNPJ: {order.buyerCompany.cnpj}</Text>
          )}
        </View>

        {/* Chat movido para fora do ScrollView principal, renderizado como Modal abaixo */}

        {/* Timeline history */}
        {timeline.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>HISTÓRICO</Text>
            {timeline.map((t: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4F46E5', marginTop: 5 }} />
                <View>
                  <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 13 }}>{timelineLabels[t.status] || t.status}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{new Date(t.createdAt).toLocaleString('pt-BR')}</Text>
                  {t.notes && <Text style={{ color: colors.textSecondary, fontSize: 11, fontStyle: 'italic' }}>{t.notes}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal de Chat Full-Screen */}
      <Modal visible={showChat} animationType="slide" onRequestClose={() => setShowChat(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowChat(false)} style={{ padding: 4 }}>
                <ChevronLeft size={24} color={colors.text} />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={20} color="#4F46E5" />
                <Text style={[styles.headerTitle, { color: colors.text }]}>Chat do Pedido</Text>
              </View>
              <View style={{ width: 32 }} />
            </View>

            <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: chatMessages.length === 0 ? 'center' : 'flex-start' }}>
              {chatMessages.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textSecondary }}>Nenhuma mensagem ainda</Text>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.sender?.companyId === order.supplierCompanyId;
                  return (
                    <View key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 12 }}>
                      {!isMe && <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2, marginLeft: 4 }}>{msg.sender?.name}</Text>}
                      <View style={{ backgroundColor: isMe ? '#4F46E5' : colors.card, padding: 12, borderRadius: 16, borderBottomRightRadius: isMe ? 4 : 16, borderBottomLeftRadius: !isMe ? 4 : 16 }}>
                        <Text style={{ color: isMe ? 'white' : colors.text, fontSize: 14 }}>{msg.content}</Text>
                      </View>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
              <TextInput
                style={[styles.chatInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                placeholder="Digite uma mensagem..."
                placeholderTextColor={colors.textSecondary}
                value={messageInput}
                onChangeText={setMessageInput}
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity
                style={{ backgroundColor: '#4F46E5', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
                onPress={handleSendMessage}
                disabled={isSending || !messageInput.trim()}
              >
                {isSending ? <ActivityIndicator color="white" size="small" /> : <Send size={18} color="white" style={{ marginLeft: -2 }} />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 16 },
  card: { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionLabel: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 16 },
  actionBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  chatInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
});
