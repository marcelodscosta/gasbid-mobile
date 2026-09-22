import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, Package, BarChart3, TrendingDown, TrendingUp, Target, DollarSign, AlertCircle, MapPin, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { api } from '../api';
import { useTheme } from '../context/ThemeContext';

export default function StatsScreen() {
  const [userData, setUserData] = useState<any>(null);
  
  // Buyer state
  const [requests, setRequests] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  // Supplier state
  const [supplierStats, setSupplierStats] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [loading, setLoading] = useState(true);
  const { colors } = useTheme();

  const fetchBuyerData = async () => {
    try {
      const [requestsRes, ordersRes] = await Promise.all([
        api.get('/buyer-requests?limit=100'),
        api.get('/orders?limit=100')
      ]);
      setRequests(requestsRes.data?.data || []);
      setOrders(ordersRes.data?.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSupplierData = async (date: Date) => {
    try {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const res = await api.get(`/stats/supplier?month=${month}&year=${year}`);
      setSupplierStats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const meRes = await api.get('/me');
      setUserData(meRes.data);
      
      if (meRes.data?.role === 'SUPPLIER') {
        await fetchSupplierData(currentDate);
      } else {
        await fetchBuyerData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    if (userData?.role === 'SUPPLIER') {
      setLoading(true);
      fetchSupplierData(newDate).finally(() => setLoading(false));
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    if (userData?.role === 'SUPPLIER') {
      setLoading(true);
      fetchSupplierData(newDate).finally(() => setLoading(false));
    }
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const renderBuyerStats = () => {
    const openRequests = requests.filter(r => r.status === 'OPEN').length;
    const totalSpent = orders.reduce((acc, o) => acc + o.totalPrice, 0);

    const productsWithPrices = orders.reduce((acc: any, order) => {
      order.proposal?.items?.forEach((proposalItem: any) => {
        const brItem = order.buyerRequest?.items?.find((i: any) => i.id === proposalItem.buyerRequestItemId);
        const productName = brItem?.product?.name || 'Produto';
        const unitPrice = proposalItem.unitPrice;
        if (!acc[productName]) acc[productName] = [];
        acc[productName].push(unitPrice);
      });
      return acc;
    }, {});

    const priceStats = Object.keys(productsWithPrices).map(name => {
      const prices = productsWithPrices[name];
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      const range = max - min;
      const relativePercentage = range === 0 ? 0.5 : (avg - min) / range;
      const percentage = 10 + (relativePercentage * 80);
      return { product: name, min, max, avg, percentage };
    });

    return (
      <>
        <View style={styles.cardsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#1E88E520' }]}>
              <Package color="#1E88E5" size={24} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>{openRequests}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pedidos Abertos</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#43A04720' }]}>
              <Wallet color="#43A047" size={24} />
            </View>
            <Text style={[styles.statValue, { color: colors.text }]}>
              R$ {totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Gasto</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <View style={styles.sectionHeader}>
            <BarChart3 color={colors.primary} size={24} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Inteligência de Preços</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Média de preços pagos por produto</Text>

          {priceStats.length === 0 ? (
            <View style={styles.emptyState}>
              <TrendingDown color={colors.textSecondary} size={32} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Sem dados suficientes</Text>
            </View>
          ) : (
            priceStats.map(stat => (
              <View key={stat.product} style={[styles.priceCard, { borderBottomColor: colors.border }]}>
                <Text style={[styles.productName, { color: colors.text }]}>{stat.product}</Text>

                <View style={styles.barContainer}>
                  <View style={[styles.barBackground, { backgroundColor: colors.border }]} />
                  <View style={[styles.barIndicator, { left: `${stat.percentage}%` }]} />
                </View>

                <View style={styles.priceLabels}>
                  <Text style={[styles.priceMin, { color: colors.textSecondary }]}>Min: R$ {stat.min.toFixed(2)}</Text>
                  <Text style={styles.priceAvg}>Média: R$ {stat.avg.toFixed(2)}</Text>
                  <Text style={[styles.priceMax, { color: colors.textSecondary }]}>Max: R$ {stat.max.toFixed(2)}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </>
    );
  };

  const renderSupplierStats = () => {
    if (!supplierStats) return null;

    const { overview, competitiveness } = supplierStats;

    return (
      <>
        {/* Filtro de Mês */}
        <View style={styles.monthSelector}>
          <TouchableOpacity onPress={handlePrevMonth} style={[styles.monthButton, { backgroundColor: colors.card }]}>
            <ChevronLeft color={colors.text} size={20} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={[styles.monthButton, { backgroundColor: colors.card }]}>
            <ChevronRight color={colors.text} size={20} />
          </TouchableOpacity>
        </View>

        {/* Resumo Financeiro */}
        <View style={styles.cardsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#43A04720' }]}>
              <DollarSign color="#43A047" size={24} />
            </View>
            <Text style={[styles.statValue, { color: colors.text, fontSize: 20 }]}>
              R$ {overview.totalFaturado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Faturamento Bruto</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.card }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#1E88E520' }]}>
              <Target color="#1E88E5" size={24} />
            </View>
            <Text style={[styles.statValue, { color: colors.text, fontSize: 20 }]}>
              {overview.taxaConversao.toFixed(1)}%
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Taxa de Sucesso</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, marginBottom: 24 }]}>
          <View style={styles.sectionHeader}>
            <TrendingUp color={colors.primary} size={24} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Leilões e Pedidos</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.statValue, { color: colors.text }]}>{overview.leiloesParticipados}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Participados</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.statValue, { color: '#43A047' }]}>{overview.leiloesGanhos}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ganhos</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                R$ {overview.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Ticket Médio</Text>
            </View>
          </View>
        </View>

        {/* Inteligência Competitiva - Preço */}
        <View style={[styles.section, { backgroundColor: colors.card, marginBottom: 24 }]}>
          <View style={styles.sectionHeader}>
            <AlertCircle color="#FF5722" size={24} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Motivos de Perda (Preço)</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Descubra por que você perdeu os leilões neste mês.
          </Text>
          
          {competitiveness.perdasAnalisadas > 0 ? (
            <View style={[styles.lossCard, { backgroundColor: '#FF572210', borderColor: '#FF5722' }]}>
              <Text style={{ fontSize: 16, color: colors.text, textAlign: 'center', lineHeight: 24 }}>
                Nos {competitiveness.perdasAnalisadas} leilões que você perdeu, seu lance estava em média:
              </Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FF5722', textAlign: 'center', marginVertical: 8 }}>
                R$ {competitiveness.diferencaMediaPreco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mais caro
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
                que o lance do revendedor vencedor.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum dado de perda analisado ainda.</Text>
            </View>
          )}
        </View>

        {/* Inteligência Competitiva - Distância */}
        <View style={[styles.section, { backgroundColor: colors.card, marginBottom: 24 }]}>
          <View style={styles.sectionHeader}>
            <MapPin color={colors.primary} size={24} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Eficiência por Distância</Text>
          </View>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
            Veja onde você tem mais sucesso de vendas.
          </Text>
          
          {competitiveness.distanceAnalysis.map((item: any) => {
            const taxa = item.participados > 0 ? (item.ganhos / item.participados) * 100 : 0;
            return (
              <View key={item.label} style={[styles.priceCard, { borderBottomColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={[styles.productName, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.productName, { color: colors.text }]}>{taxa.toFixed(1)}% win</Text>
                </View>
                
                <View style={styles.barContainer}>
                  <View style={[styles.barBackground, { backgroundColor: colors.border }]} />
                  <View style={[styles.barIndicator, { left: '0%', width: `${taxa}%`, backgroundColor: '#43A047', marginLeft: 0 }]} />
                </View>

                <View style={styles.priceLabels}>
                  <Text style={[styles.priceMin, { color: colors.textSecondary }]}>{item.participados} Participados</Text>
                  <Text style={[styles.priceMax, { color: colors.textSecondary }]}>{item.ganhos} Ganhos</Text>
                </View>
              </View>
            );
          })}
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Desempenho</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {userData?.role === 'SUPPLIER' ? 'Acompanhe suas vendas e competitividade' : 'Acompanhe o desempenho de suas compras'}
          </Text>
        </View>

        {userData?.role === 'SUPPLIER' ? renderSupplierStats() : renderBuyerStats()}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 40 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  headerSubtitle: { fontSize: 15, marginTop: 4 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  monthButton: { padding: 8, borderRadius: 8 },
  monthText: { fontSize: 18, fontWeight: 'bold' },
  cardsGrid: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  statCard: { flex: 1, padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 13, marginTop: 4 },
  section: { padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  sectionSubtitle: { fontSize: 14, marginBottom: 20 },
  emptyState: { alignItems: 'center', padding: 20 },
  emptyText: { marginTop: 12 },
  priceCard: { marginBottom: 24, borderBottomWidth: 1, paddingBottom: 16 },
  productName: { fontWeight: 'bold', fontSize: 15, marginBottom: 12 },
  barContainer: { height: 8, backgroundColor: 'transparent', justifyContent: 'center', marginVertical: 8, marginHorizontal: 0 },
  barBackground: { height: 4, borderRadius: 2, width: '100%' },
  barIndicator: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF5722', marginLeft: -6 },
  priceLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  priceMin: { fontSize: 12 },
  priceAvg: { fontSize: 12, fontWeight: 'bold', color: '#FF5722' },
  priceMax: { fontSize: 12 },
  lossCard: { borderWidth: 1, padding: 20, borderRadius: 12 }
});
