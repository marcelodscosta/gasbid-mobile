import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Package, Clock, CheckCircle, Truck, MessageSquare } from 'lucide-react-native';
import { api } from '../../api';
import { useTheme } from '../../context/ThemeContext';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  CREATED:     { label: 'Aguardando Confirmação', color: '#D97706', bg: '#FEF3C7' },
  CONFIRMED:   { label: 'Confirmado · Preparando', color: '#2563EB', bg: '#DBEAFE' },
  IN_DELIVERY: { label: '🚚 Em Entrega', color: '#059669', bg: '#D1FAE5' },
  DELIVERED:   { label: '✓ Entregue', color: '#16A34A', bg: '#F0FDF4' },
  CANCELLED:   { label: 'Cancelado', color: '#DC2626', bg: '#FEE2E2' },
};

export default function SupplierOrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get('/orders?limit=30');
      setOrders(res.data?.data || []);
    } catch (e: any) {
      if (e.response?.status !== 401) console.warn('SupplierOrders fetch error:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchOrders();
      const interval = setInterval(() => fetchOrders(), 8000);
      return () => clearInterval(interval);
    }, [])
  );

  const renderItem = ({ item }: any) => {
    const cfg = statusConfig[item.status] || { label: item.status, color: '#666', bg: '#F3F4F6' };
    const products = item.buyerRequest?.items
      ?.map((i: any) => `${i.quantity}x ${i.product?.name}`)
      .join(' + ') || 'Produtos';

    const isActive = ['CREATED', 'CONFIRMED', 'IN_DELIVERY'].includes(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: isActive ? '#4F46E5' : colors.border, borderWidth: isActive ? 2 : 1 }]}
        onPress={() => navigation.navigate('SupplierOrderDetail', { order: item })}
        activeOpacity={0.85}
      >
        {/* Status Badge */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            {item.status === 'IN_DELIVERY' ? <Truck size={12} color={cfg.color} /> :
             item.status === 'DELIVERED' ? <CheckCircle size={12} color={cfg.color} /> :
             <Clock size={12} color={cfg.color} />}
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            {new Date(item.createdAt).toLocaleDateString('pt-BR')}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
          <Package size={22} color={colors.textSecondary} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 15, color: colors.text }} numberOfLines={2}>{products}</Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Cliente: {item.buyerCompany?.name || 'Comprador'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
                <Truck size={12} color="#DC2626" />
                <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: 'bold' }}>
                  Entrega: {item.proposal?.deliveryDeadline ? new Date(item.proposal.deliveryDeadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'A Combinar'}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#4F46E5', fontWeight: 'bold' }}>
                R$ {item.totalPrice?.toFixed(2).replace('.', ',')}
              </Text>
            </View>
          </View>
        </View>

        {/* Action row */}
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
          <View style={[styles.actionChip, { borderColor: '#4F46E5' }]}>
            <MessageSquare size={12} color="#4F46E5" />
            <Text style={{ fontSize: 12, color: '#4F46E5', fontWeight: 'bold' }}>Detalhes</Text>
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
      <View style={styles.pageHeader}>
        <Text style={[styles.title, { color: colors.text }]}>Meus Pedidos</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Pedidos recebidos pela distribuidora</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchOrders(true)} tintColor="#4F46E5" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Package size={48} color={colors.textSecondary} strokeWidth={1} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum pedido ainda</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Quando um comprador aceitar sua proposta, o pedido aparecerá aqui
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 26, fontWeight: 'bold' },
  subtitle: { fontSize: 13, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
