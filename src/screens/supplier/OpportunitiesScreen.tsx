import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Vibration
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Zap, MapPin, Clock, Users, ChevronRight, CheckCircle, Package, Truck, MessageSquare } from 'lucide-react-native';
import { api } from '../../api';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  CREATED:     { label: 'Aguardando Confirmação', color: '#D97706', bg: '#FEF3C7' },
  CONFIRMED:   { label: 'Confirmado · Preparando', color: '#2563EB', bg: '#DBEAFE' },
};

function CountdownBadge({ expiresAt, colors }: { expiresAt: string; colors: any }) {
  const [timeLeft, setTimeLeft] = useState('');

  React.useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setTimeLeft('Encerrado'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const isUrgent = new Date(expiresAt).getTime() - Date.now() < 2 * 60 * 1000;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Clock size={12} color={isUrgent ? '#EF4444' : colors.textSecondary} />
      <Text style={{ fontSize: 11, color: isUrgent ? '#EF4444' : colors.textSecondary, fontWeight: isUrgent ? 'bold' : 'normal' }}>
        {timeLeft}
      </Text>
    </View>
  );
}

function PendingOrderCard({ order, colors, navigation }: any) {
  const [unreadCount, setUnreadCount] = useState(0);
  const prevTotalRef = React.useRef(order._count?.messages || 0);

  useFocusEffect(
    useCallback(() => {
      const checkUnread = async () => {
        try {
          const lastSeen = await AsyncStorage.getItem(`lastSeenMessages_${order.id}`);
          const seenCount = parseInt(lastSeen || '0', 10);
          const total = order._count?.messages || 0;
          
          if (total > prevTotalRef.current && total > seenCount) {
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
    }, [order._count?.messages, order.id])
  );

  const cfg = statusConfig[order.status] || { label: order.status, color: '#666', bg: '#F3F4F6' };
  const products = order.buyerRequest?.items?.map((i: any) => `${i.quantity}x ${i.product?.name}`).join(' + ') || 'Produtos';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: '#F59E0B', borderWidth: 1 }]}
      onPress={() => navigation.navigate('SupplierOrderDetail', { order })}
      activeOpacity={0.85}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: cfg.bg }}>
          <Clock size={12} color={cfg.color} />
          <Text style={{ fontSize: 11, fontWeight: 'bold', color: cfg.color }}>{cfg.label}</Text>
        </View>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</Text>
          <TouchableOpacity 
            style={{ position: 'relative', padding: 4 }}
            onPress={() => navigation.navigate('SupplierOrderDetail', { order, openChat: true })}
          >
            <MessageSquare size={18} color={unreadCount > 0 ? '#4F46E5' : colors.textSecondary} />
            {unreadCount > 0 && (
              <View style={{
                position: 'absolute', top: 0, right: 0,
                backgroundColor: '#EF4444', width: 14, height: 14, borderRadius: 7,
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: colors.card
              }}>
                <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Package size={22} color={colors.textSecondary} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.text }} numberOfLines={2}>{products}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            Cliente: {order.buyerCompany?.name || 'Comprador'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
              <Truck size={12} color="#DC2626" />
              <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>
                Entrega: {order.proposal?.deliveryDeadline ? new Date(order.proposal.deliveryDeadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'A Combinar'}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#4F46E5', fontWeight: 'bold' }}>
              R$ {order.totalPrice?.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OpportunitiesScreen() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors, darkMode } = useTheme();
  const navigation = useNavigation<any>();

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [oppRes, ordRes] = await Promise.all([
        api.get(`/marketplace/opportunities?showApplied=true`),
        api.get('/orders?limit=30')
      ]);
      setOpportunities(oppRes.data?.data || []);
      
      // Filter for orders that need supplier action or delivery
      const activeOrders = (ordRes.data?.data || []).filter((o: any) => ['CREATED', 'CONFIRMED'].includes(o.status));
      setPendingOrders(activeOrders);
    } catch (e: any) {
      if (e.response?.status !== 401) console.warn('Fetch error:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
      const interval = setInterval(() => fetchData(), 15000);
      return () => clearInterval(interval);
    }, [])
  );

  const renderItem = ({ item }: any) => {
    const productsSummary = item.items?.map((i: any) => `${i.quantity}x ${i.product?.name || 'Produto'}`).join(' + ') || 'Produtos';
    const hasProposal = item.proposals && item.proposals.length > 0;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: hasProposal ? '#4F46E5' : colors.border, borderWidth: hasProposal ? 2 : 1 }]}
        onPress={() => navigation.navigate('ProposalDetail', { opportunity: item })}
        activeOpacity={0.85}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: colors.text, marginBottom: 2 }} numberOfLines={2}>
              {productsSummary}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {item.buyerCompany?.name || 'Comprador'}
            </Text>
          </View>
          {hasProposal ? (
            item.proposals[0].status === 'COUNTER_OFFER' ? (
              <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MessageSquare size={12} color="#DC2626" />
                <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>Contraproposta</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} color="#4F46E5" />
                <Text style={{ fontSize: 11, color: '#4F46E5', fontWeight: 'bold' }}>Proposta Enviada</Text>
              </View>
            )
          ) : (
            <View style={{ backgroundColor: '#FFF7ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, color: '#F97316', fontWeight: 'bold' }}>Nova</Text>
            </View>
          )}
        </View>

        {/* Info row */}
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MapPin size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {item.address?.city}/{item.address?.state}
              {item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)} km` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Users size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              {item._count?.proposals || 0} proposta(s)
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <CountdownBadge expiresAt={item.expiresAt} colors={colors} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#4F46E5' }}>
              {hasProposal ? 'Ver / Atualizar' : 'Fazer Proposta'}
            </Text>
            <ChevronRight size={14} color="#4F46E5" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Oportunidades</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Cotações abertas na sua região</Text>
        </View>
        <View style={{ backgroundColor: '#4F46E5', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
          <Zap color="white" size={22} />
        </View>
      </View>

      <FlatList
        data={opportunities}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor="#4F46E5" />}
        ListHeaderComponent={
          pendingOrders.length > 0 ? (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 12 }}>
                Pendentes de Entrega
              </Text>
              {pendingOrders.map(order => (
                <PendingOrderCard key={order.id} order={order} colors={colors} navigation={navigation} />
              ))}
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 10, marginBottom: 4 }}>
                Novas Oportunidades
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Zap size={48} color={colors.textSecondary} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma oportunidade</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Novas cotações aparecerão aqui assim que clientes da sua região solicitarem gás
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  title: { fontSize: 26, fontWeight: 'bold' },
  subtitle: { fontSize: 13, marginTop: 2 },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
  },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
