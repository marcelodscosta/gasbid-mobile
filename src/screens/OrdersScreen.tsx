import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Clock, CheckCircle, RotateCcw, MessageSquare, Send } from 'lucide-react-native';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';
import { mobileAudioService } from '../utils/sound';

const statusTranslations: Record<string, string> = {
  OPEN: 'Em Aberto',
  UNDER_REVIEW: 'Aguardando',
  CANCELLED: 'Cancelado',
  DELIVERED: 'Concluído',
  AWARDED: 'Aceito',
  IN_DELIVERY: 'Em Entrega',
  CONFIRMED: 'Confirmado',
  CREATED: 'Iniciado',
};

export default function OrdersScreen({ navigation }: any) {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ratingOrder, setRatingOrder] = useState<any>(null);
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [chatOrder, setChatOrder] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/buyer-requests?limit=20');
      const newOrders = response.data.data || [];
      
      newOrders.forEach((newOrder: any) => {
        const oldOrder = orders.find((o: any) => o.id === newOrder.id);
        if (oldOrder && oldOrder.status !== newOrder.status) {
          if (newOrder.status === 'IN_DELIVERY' || newOrder.status === 'DELIVERED') {
            mobileAudioService.notifyOrderStatusChange();
          }
        }
      });

      setOrders(newOrders);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

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
    if (chatOrder) {
      fetchMessages(chatOrder.id);
      interval = setInterval(() => fetchMessages(chatOrder.id), 3000);
    }
    return () => clearInterval(interval);
  }, [chatOrder]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !chatOrder) return;
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

  const handleRepeatOrder = async (item: any) => {
    try {
      const addressId = item.addressId;
      const items = item.items?.map((i: any) => ({
        productId: i.productId,
        quantity: i.quantity,
      })) || [];

      if (!addressId || items.length === 0) {
        return alert('Não foi possível duplicar este pedido.');
      }

      // Previsão de entrega padrão: Amanhã às 08:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const yyyy = tomorrow.getFullYear();
      const deadline = new Date(`${yyyy}-${mm}-${dd}T08:00:00.000-03:00`).toISOString();

      await api.post('/buyer-requests', {
        addressId,
        items,
        deadline,
        observations: item.observations || 'Pagamento: Pix',
      });

      alert('Pedido duplicado com sucesso! Iniciando busca por fornecedores...');
      navigation?.navigate('Home');
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao repetir pedido.');
    }
  };

  const handleRateOrder = async () => {
    const targetOrderId = ratingOrder?.order?.id || ratingOrder?.id;
    if (!targetOrderId) return;
    setIsSubmittingRating(true);
    try {
      await api.post(`/orders/${targetOrderId}/rate`, { stars, comment });
      alert('Obrigado! Sua avaliação de ' + stars + ' ★ foi enviada com sucesso.');
      setRatingOrder(null);
      fetchOrders();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao enviar avaliação');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.post(`/buyer-requests/${id}/cancel`);
      alert('Solicitação cancelada.');
      fetchOrders();
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erro ao cancelar');
    }
  };

  const renderItem = ({ item }: any) => {
    const totalQty = item.items?.reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;
    const productsSummary = item.items && item.items.length > 0
      ? item.items.map((i: any) => `${i.quantity}x ${i.product?.name || 'Produto'}`).join(' + ')
      : 'Solicitação de Gás';

    const isDelivered = item.status === 'DELIVERED' || item.order?.status === 'DELIVERED';
    const isCancelled = item.status === 'CANCELLED' || item.order?.status === 'CANCELLED';
    const isActive = !isDelivered && !isCancelled;
    const canCancel = item.status === 'OPEN' || item.status === 'CREATED' || item.status === 'CONFIRMED' || item.status === 'UNDER_REVIEW';

    const orderRating = item.order?.rating || item.rating;
    const hasBeenRated = !!orderRating;

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.badgeContainer}>
            {isCancelled ? (
              <View style={[styles.badge, { backgroundColor: '#FFEBEE' }]}>
                <Clock size={12} color="#F44336" />
                <Text style={[styles.badgeText, { color: '#F44336' }]}>Cancelado</Text>
              </View>
            ) : !isDelivered ? (
              <View style={[styles.badge, { backgroundColor: '#FFF3E0' }]}>
                <Clock size={12} color="#FF9800" />
                <Text style={[styles.badgeText, { color: '#FF9800' }]}>{statusTranslations[item.status] || item.status}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: '#E8F5E9' }]}>
                <CheckCircle size={12} color="#4CAF50" />
                <Text style={[styles.badgeText, { color: '#4CAF50' }]}>Concluído</Text>
              </View>
            )}
          </View>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        
        <View style={styles.cardBody}>
          <Package size={24} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <View style={[styles.infoContainer, { flex: 1 }]}>
            <Text style={[styles.title, { color: colors.text }]}>{productsSummary}</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, marginTop: 2 }]}>Total: {totalQty} item(ns)</Text>
            
            {item.items && item.items.length > 1 && (
              <View style={{ marginTop: 6, gap: 2 }}>
                {item.items.map((it: any, idx: number) => (
                  <Text key={idx} style={{ fontSize: 12, color: colors.textSecondary }}>
                    • {it.quantity}x {it.product?.name || 'Produto'}
                  </Text>
                ))}
              </View>
            )}

            {item.order?.proposal?.paymentTerms && (
              <Text style={{ fontSize: 13, color: '#4CAF50', fontWeight: 'bold', marginTop: 4 }}>
                Pagamento: {item.order.proposal.paymentTerms}
              </Text>
            )}
          </View>
        </View>

        {/* Régua de Próximos Passos */}
        {!isCancelled && (
          <View style={{ marginVertical: 10, padding: 10, backgroundColor: '#F9F9F9', borderRadius: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#666', marginBottom: 6 }}>PRÓXIMOS PASSOS:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 10, color: item.status !== 'OPEN' ? '#4CAF50' : '#888', fontWeight: 'bold' }}>1. Aceito</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#ccc' }}>➔</Text>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 10, color: item.status === 'IN_DELIVERY' || item.status === 'DELIVERED' ? '#4CAF50' : '#888', fontWeight: 'bold' }}>2. Em Entrega</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#ccc' }}>➔</Text>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text style={{ fontSize: 10, color: item.status === 'DELIVERED' ? '#4CAF50' : '#888', fontWeight: 'bold' }}>3. Entregue</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
          {isDelivered && !hasBeenRated && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082', flex: 1 }]}
              onPress={() => {
                setRatingOrder(item);
                setStars(5);
                setComment('');
              }}
            >
              <Text style={[styles.actionButtonText, { color: '#F57F17' }]}>★ Avaliar Fornecedor</Text>
            </TouchableOpacity>
          )}

          {isDelivered && hasBeenRated && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#FF9800', fontWeight: 'bold' }}>
                Sua avaliação: {'★'.repeat(orderRating.stars)} ({orderRating.stars}.0)
              </Text>
            </View>
          )}

          {/* Botão Repetir Pedido */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#E3F2FD', borderWidth: 1, borderColor: '#90CAF9', flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }]}
            onPress={() => handleRepeatOrder(item)}
          >
            <RotateCcw size={14} color="#1976D2" />
            <Text style={[styles.actionButtonText, { color: '#1976D2' }]}>Repetir Pedido</Text>
          </TouchableOpacity>

          {isActive && (item.order?.id || item.status === 'AWARDED') && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#F3E5F5', borderWidth: 1, borderColor: '#CE93D8', flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }]}
              onPress={() => setChatOrder(item.order || { id: item.id, buyerCompanyId: item.buyerCompanyId, supplierCompany: { name: 'Fornecedor' } })}
            >
              <MessageSquare size={14} color="#9C27B0" />
              <Text style={[styles.actionButtonText, { color: '#9C27B0' }]}>Chat</Text>
            </TouchableOpacity>
          )}

          {canCancel && !isCancelled && (
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: '#FFCDD2', paddingHorizontal: 12 }]}
              onPress={() => handleCancel(item.id)}
            >
              <Text style={[styles.actionButtonText, { color: '#D32F2F' }]}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Meus Pedidos</Text>
      {isLoading ? (
        <ActivityIndicator size="large" color="#FF5722" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContainer}
          refreshing={isLoading}
          onRefresh={fetchOrders}
        />
      )}

      {/* Modal de Avaliação 5 Estrelas */}
      {ratingOrder && (
        <View style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 1000
        }}>
          <View style={{
            backgroundColor: colors.card, width: '100%', borderRadius: 24,
            padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border
          }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
              Avaliar Fornecedor
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>
              Como foi sua experiência com este pedido?
            </Text>

            {/* Estrelas Clicáveis (1 a 5) */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
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

            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.border }}
                onPress={() => setRatingOrder(null)}
              >
                <Text style={{ fontWeight: 'bold', color: colors.text }}>Cancelar</Text>
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

      {/* Modal de Chat */}
      {chatOrder && (
        <View style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 1000
        }}>
          <View style={{
            backgroundColor: colors.card, width: '100%', height: '80%', borderRadius: 24,
            borderWidth: 1, borderColor: colors.border, display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text }}>Chat do Pedido</Text>
              <TouchableOpacity onPress={() => setChatOrder(null)} style={{ padding: 4 }}>
                <Text style={{ fontSize: 24, color: '#999', lineHeight: 24 }}>×</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={chatMessages}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              inverted={false}
              renderItem={({ item: msg }) => {
                const isMe = msg.sender.companyId === chatOrder.buyerCompanyId; // Assume que sou o buyer no mobile
                return (
                  <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%', marginBottom: 12 }}>
                    {!isMe && <Text style={{ fontSize: 11, color: '#888', marginBottom: 2, marginLeft: 4 }}>{msg.sender.name}</Text>}
                    <View style={{
                      backgroundColor: isMe ? '#FF5722' : '#F5F5F5',
                      padding: 12,
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                    }}>
                      <Text style={{ color: isMe ? 'white' : '#333', fontSize: 14 }}>{msg.content}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: '#aaa', marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: '#999', marginTop: 40 }}>Nenhuma mensagem. Inicie o chat!</Text>
              }
            />

            <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, color: '#333' }}
                placeholder="Digite sua mensagem..."
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    color: '#111',
  },
  listContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  date: {
    fontSize: 13,
    color: '#888',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoContainer: {
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#FF5722',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
