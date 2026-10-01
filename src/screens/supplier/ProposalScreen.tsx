import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { ChevronLeft, TrendingDown, TrendingUp, Package, Truck, Calendar } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { api } from '../../api';
import { useTheme } from '../../context/ThemeContext';

export default function ProposalScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { opportunity } = route.params;
  const { colors, darkMode } = useTheme();

  const [detail, setDetail] = useState<any>(opportunity);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [freight, setFreight] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Pix');
  const [observations, setObservations] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date(Date.now() + 3 * 3600 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        const [detailRes, meRes] = await Promise.all([
          api.get(`/buyer-requests/${opportunity.id}`),
          api.get('/me'),
        ]);
        setDetail(detailRes.data);
        setUserData(meRes.data);

        // Pre-fill existing proposal prices if supplier already has one
        const myCompanyId = meRes.data?.companyId;
        const existingProposal = detailRes.data?.proposals?.find(
          (p: any) => p.supplierCompanyId === myCompanyId
        );
        if (existingProposal) {
          const initialPrices: Record<string, string> = {};
          existingProposal.items?.forEach((item: any) => {
            initialPrices[item.buyerRequestItemId] = String(item.unitPrice);
          });
          setPrices(initialPrices);
          setFreight(String(existingProposal.freightPrice || ''));
          if (existingProposal.paymentTerms) setPaymentTerms(existingProposal.paymentTerms);
          if (existingProposal.observations) setObservations(existingProposal.observations);
          if (existingProposal.deliveryDeadline) setDeliveryDate(new Date(existingProposal.deliveryDeadline));
        }
      } catch (e) {
        console.warn('Error loading proposal detail', e);
      }
    };
    loadDetail();
  }, [opportunity.id]);

  const myCompanyId = userData?.companyId;
  const existingProposal = detail?.proposals?.find((p: any) => p.supplierCompanyId === myCompanyId);
  const hasProposal = !!existingProposal;
  const isCounterOffer = existingProposal?.status === 'COUNTER_OFFER';
  const marketSummary = detail?.lowestMarketSummary;

  const items = detail?.items || opportunity.items || [];

  const totalItems = items.reduce((sum: number, item: any) => {
    const price = parseFloat(prices[item.id] || '0');
    return sum + price * (item.quantity || 1);
  }, 0);
  const totalFreight = parseFloat(freight || '0');
  const grandTotal = totalItems + totalFreight;

  const isWinning = marketSummary
    ? marketSummary.myTotal <= marketSummary.totalPrice
    : null;

  const handleSubmit = async () => {
    const proposalItems = items.map((item: any) => ({
      buyerRequestItemId: item.id,
      unitPrice: parseFloat(prices[item.id] || '0'),
    }));

    const hasEmptyPrice = proposalItems.some((i: { buyerRequestItemId: string; unitPrice: number }) => isNaN(i.unitPrice) || i.unitPrice <= 0);
    if (hasEmptyPrice) {
      return Alert.alert('Atenção', 'Preencha o preço unitário de todos os produtos.');
    }
    if (!freight || parseFloat(freight) < 0) {
      return Alert.alert('Atenção', 'Informe o valor do frete (pode ser 0 para frete grátis).');
    }

    const buyerDeadline = new Date(detail?.deadline || opportunity.deadline);
    if (deliveryDate > buyerDeadline && !isCounterOffer) {
      return Alert.alert(
        'Prazo Excedido',
        `O comprador exige entrega até ${buyerDeadline.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`
      );
    }

    setIsSubmitting(true);
    try {
      await api.post(`/buyer-requests/${opportunity.id}/proposals`, {
        supplierCompanyId: myCompanyId,
        items: proposalItems,
        freightPrice: totalFreight,
        deliveryDeadline: deliveryDate.toISOString(),
        paymentTerms,
        observations,
      });
      Alert.alert(
        hasProposal ? 'Proposta Atualizada!' : 'Proposta Enviada!',
        hasProposal
          ? 'Sua proposta foi atualizada com sucesso.'
          : 'Sua proposta foi enviada ao comprador. Você será notificado se for aceita.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      Alert.alert('Erro', e.response?.data?.message || 'Não foi possível enviar a proposta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isCounterOffer ? 'Responder Contraproposta' : hasProposal ? 'Atualizar Proposta' : 'Enviar Proposta'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Counter Offer Alert */}
          {isCounterOffer && (
            <View style={[styles.marketCard, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 14, color: '#991B1B', marginBottom: 4 }}>
                  Contraproposta do Comprador
                </Text>
                <Text style={{ fontSize: 13, color: '#7F1D1D' }}>
                  {existingProposal?.observations || 'O comprador deseja negociar os valores desta proposta. Analise o cenário e reenvie sua oferta.'}
                </Text>
              </View>
            </View>
          )}

          {/* Market position indicator */}
          {marketSummary && (
            <View style={[styles.marketCard, {
              backgroundColor: isWinning ? '#F0FDF4' : '#FFF7ED',
              borderColor: isWinning ? '#86EFAC' : '#FED7AA'
            }]}>
              {isWinning ? (
                <TrendingUp size={20} color="#16A34A" />
              ) : (
                <TrendingDown size={20} color="#EA580C" />
              )}
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontWeight: 'bold', fontSize: 13, color: isWinning ? '#15803D' : '#C2410C' }}>
                  {isWinning ? '🏆 Você está vencendo!' : '⚠️ Você está perdendo'}
                </Text>
                <Text style={{ fontSize: 12, color: isWinning ? '#166534' : '#9A3412', marginTop: 2 }}>
                  {isWinning
                    ? `Sua proposta de R$ ${marketSummary.myTotal?.toFixed(2)} é a mais competitiva`
                    : `Menor oferta atual: R$ ${marketSummary.totalPrice?.toFixed(2)}. Para vencer, ofereça até R$ ${(marketSummary.totalPrice - 2).toFixed(2)}`
                  }
                </Text>
              </View>
            </View>
          )}

          {/* Requested Items */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Package size={18} color="#4F46E5" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Itens Solicitados</Text>
            </View>
            {items.map((item: any) => (
              <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold', color: colors.text, fontSize: 14 }}>
                    {item.product?.name || 'Produto'}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    Qtd: {item.quantity} unidade(s)
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>Preço unitário</Text>
                  <View style={[styles.priceInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>R$</Text>
                    <TextInput
                      style={{ width: 70, fontSize: 14, fontWeight: 'bold', color: colors.text, textAlign: 'right' }}
                      keyboardType="decimal-pad"
                      placeholder="0,00"
                      placeholderTextColor={colors.textSecondary}
                      value={prices[item.id] || ''}
                      onChangeText={v => setPrices(prev => ({ ...prev, [item.id]: v.replace(',', '.') }))}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Freight & Delivery */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Truck size={18} color="#4F46E5" />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Frete e Entrega</Text>
            </View>

            <View style={{ gap: 12 }}>
              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Valor do Frete (R$)</Text>
                <TextInput
                  style={[styles.textField, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text }]}
                  keyboardType="decimal-pad"
                  placeholder="0,00 (frete grátis)"
                  placeholderTextColor={colors.textSecondary}
                  value={freight}
                  onChangeText={v => setFreight(v.replace(',', '.'))}
                />
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Prazo de Entrega</Text>
                <TouchableOpacity
                  style={[styles.textField, { borderColor: colors.border, backgroundColor: colors.background, flexDirection: 'row', alignItems: 'center' }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Calendar size={16} color={colors.textSecondary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontSize: 14 }}>
                    {deliveryDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 11, color: '#EA580C', marginTop: 4 }}>
                  Limite exigido: {new Date(detail?.deadline || opportunity.deadline).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={deliveryDate}
                  mode="datetime"
                  display="default"
                  minimumDate={new Date()}
                  onValueChange={(_, date?: Date) => {
                    setShowDatePicker(false);
                    if (date) setDeliveryDate(date);
                  }}
                  onDismiss={() => setShowDatePicker(false)}
                />
              )}

              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Forma de Pagamento</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {['Pix', 'Dinheiro', 'Crédito', 'Débito', 'Faturado'].map(p => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPaymentTerms(p)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                        borderColor: paymentTerms === p ? '#4F46E5' : colors.border,
                        backgroundColor: paymentTerms === p ? '#EEF2FF' : colors.background
                      }}
                    >
                      <Text style={{ fontSize: 13, color: paymentTerms === p ? '#4F46E5' : colors.textSecondary, fontWeight: paymentTerms === p ? 'bold' : 'normal' }}>
                        {p}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Observações (opcional)</Text>
                <TextInput
                  style={[styles.textField, { borderColor: colors.border, backgroundColor: colors.background, color: colors.text, height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                  multiline
                  placeholder="Condições especiais, informações sobre o produto..."
                  placeholderTextColor={colors.textSecondary}
                  value={observations}
                  onChangeText={setObservations}
                />
              </View>
            </View>
          </View>

          {/* Total Summary */}
          <View style={[styles.totalCard, { backgroundColor: '#4F46E5' }]}>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Total da Proposta</Text>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>
              R$ {grandTotal.toFixed(2).replace('.', ',')}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>
              Itens: R$ {totalItems.toFixed(2)} + Frete: R$ {totalFreight.toFixed(2)}
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isCounterOffer ? 'Enviar Nova Oferta' : hasProposal ? 'Atualizar Proposta' : 'Enviar Proposta'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  backBtn: { padding: 4 },
  scrollContent: { padding: 20, paddingBottom: 40, gap: 16 },
  marketCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 12, borderWidth: 1 },
  section: { borderRadius: 16, padding: 16, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  priceInput: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  fieldLabel: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  textField: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  totalCard: { borderRadius: 16, padding: 20 },
  submitBtn: { backgroundColor: '#4F46E5', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  submitBtnText: { color: 'white', fontSize: 17, fontWeight: 'bold' },
});
