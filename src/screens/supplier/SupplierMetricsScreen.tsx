import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingUp, Target, DollarSign, AlertCircle, MapPin, ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { api } from '../../api';
import { useTheme } from '../../context/ThemeContext';

export default function SupplierMetricsScreen() {
  const [metrics, setMetrics] = useState<any>(null); // Old metrics for reputation
  const [supplierStats, setSupplierStats] = useState<any>(null); // New advanced stats
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  const fetchAdvancedStats = async (date: Date) => {
    try {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear());
      const res = await api.get(`/stats/supplier?month=${month}&year=${year}`);
      setSupplierStats(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMetrics = async (isRefresh = false, date = currentDate) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [oldRes] = await Promise.all([
        api.get('/marketplace/metrics').catch(() => ({ data: null })),
        fetchAdvancedStats(date)
      ]);
      if (oldRes.data) setMetrics(oldRes.data);
    } catch (e: any) {
      console.warn('Metrics fetch error:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchMetrics(false, currentDate);
    }, [])
  );

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    setIsLoading(true);
    fetchMetrics(false, newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    setIsLoading(true);
    fetchMetrics(false, newDate);
  };

  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  if (isLoading && !supplierStats) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const stars = metrics?.reputation?.averageStars;
  const ratingCount = metrics?.reputation?.ratingCount || 0;
  const overview = supplierStats?.overview;
  const competitiveness = supplierStats?.competitiveness;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchMetrics(true, currentDate)} tintColor="#4F46E5" />}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Desempenho</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Inteligência de negócios da sua distribuidora</Text>
        </View>

        {/* Reputation Banner (Mantido do original) */}
        {metrics?.reputation && (
          <View style={[styles.reputationCard, { backgroundColor: '#4F46E5', marginBottom: 24 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
                <Star size={26} color="white" fill="white" />
              </View>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Sua Avaliação</Text>
                <Text style={{ color: 'white', fontSize: 30, fontWeight: 'bold' }}>
                  {stars != null ? `${stars} ★` : 'Sem avaliações'}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                  {ratingCount} avaliação(ões)
                </Text>
              </View>
            </View>
          </View>
        )}

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

        {overview && (
          <>
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
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Leilões e Pedidos do Mês</Text>
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
          </>
        )}

        {competitiveness && (
          <>
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
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhum dado de perda analisado neste mês.</Text>
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
                Veja em qual raio geográfico você tem mais vitórias.
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
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 'bold' },
  subtitle: { fontSize: 13, marginTop: 2 },
  reputationCard: { borderRadius: 20, padding: 20 },
  monthSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  monthButton: { padding: 8, borderRadius: 8 },
  monthText: { fontSize: 18, fontWeight: 'bold' },
  cardsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
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
