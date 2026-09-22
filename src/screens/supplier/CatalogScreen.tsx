import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Save } from 'lucide-react-native';
import { api } from '../../api';
import { useTheme } from '../../context/ThemeContext';

export default function CatalogScreen() {
  const navigation = useNavigation<any>();
  const { colors, darkMode } = useTheme();
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/supplier/products');
      setProducts(res.data || []);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível carregar seu catálogo.');
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const handleSave = async (product: any) => {
    try {
      setSaving(true);
      
      const payload = {
        biddingMode: product.biddingMode,
        defaultPrice: product.defaultPrice ? parseFloat(product.defaultPrice.toString().replace(',','.')) : null,
      };

      await api.put(`/supplier/products/${product.id}`, payload);
      Alert.alert('Sucesso', 'Preços salvos com sucesso!');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft color={colors.text} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Meu Catálogo</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {products.length === 0 ? (
          <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
            Nenhum produto foi liberado para o seu perfil ainda.
          </Text>
        ) : (
          products.map((p, index) => {
            if (!p.active) return null; // Skip inactive products
            
            return (
              <View key={p.id} style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.productName, { color: colors.text }]}>{p.product?.name}</Text>
                
                <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Modo de Operação</Text>
                <View style={styles.modeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      { borderColor: colors.border },
                      p.biddingMode === 'MANUAL_ONLY' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => updateProduct(index, 'biddingMode', 'MANUAL_ONLY')}
                  >
                    <Text style={[styles.modeText, { color: p.biddingMode === 'MANUAL_ONLY' ? '#fff' : colors.text }]}>Manual</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      { borderColor: colors.border },
                      p.biddingMode === 'AUTO_ONLY' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => updateProduct(index, 'biddingMode', 'AUTO_ONLY')}
                  >
                    <Text style={[styles.modeText, { color: p.biddingMode === 'AUTO_ONLY' ? '#fff' : colors.text }]}>Auto</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeButton,
                      { borderColor: colors.border },
                      p.biddingMode === 'BOTH' && { backgroundColor: colors.primary, borderColor: colors.primary }
                    ]}
                    onPress={() => updateProduct(index, 'biddingMode', 'BOTH')}
                  >
                    <Text style={[styles.modeText, { color: p.biddingMode === 'BOTH' ? '#fff' : colors.text }]}>Ambos</Text>
                  </TouchableOpacity>
                </View>

                {(p.biddingMode === 'AUTO_ONLY' || p.biddingMode === 'BOTH') && (
                  <View style={styles.tiersContainer}>
                    <Text style={[styles.label, { color: colors.text, marginBottom: 10 }]}>Preço Padrão (Auto-lance)</Text>
                    
                    <View style={styles.tierRow}>
                      <View style={[styles.inputWrapper, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.textSecondary }}>R$</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, flex: 1 }]}
                          placeholder="Ex: 100,00"
                          placeholderTextColor={colors.textSecondary}
                          keyboardType="numeric"
                          value={p.defaultPrice?.toString() || ''}
                          onChangeText={(val) => updateProduct(index, 'defaultPrice', val)}
                        />
                      </View>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleSave(p)}
                  disabled={saving}
                >
                  <Save color="#fff" size={20} />
                  <Text style={styles.saveButtonText}>Salvar Configuração</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 100 },
  productCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  modeContainer: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeText: {
    fontWeight: '500',
  },
  tiersContainer: {
    marginTop: 25,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,150,150,0.2)',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  tierLabel: {
    width: 60,
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    flex: 1,
  },
  input: {
    paddingHorizontal: 5,
    fontSize: 14,
    minWidth: 40,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 25,
    gap: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  }
});
