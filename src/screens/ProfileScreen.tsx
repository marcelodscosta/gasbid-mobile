import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, DevSettings, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Settings, LogOut, FileText, HelpCircle, ChevronLeft, MapPin, List } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';

import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

type ViewState = 'menu' | 'data' | 'addresses' | 'settings';

export default function ProfileScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [viewState, setViewState] = useState<ViewState>('menu');
  const [notifications, setNotifications] = useState(true);
  const { darkMode, toggleDarkMode, colors } = useTheme();
  const { logout } = useUser();
  const navigation = useNavigation<any>();

  useEffect(() => {
    api.get('/me').then(res => setUserData(res.data)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    if (__DEV__) {
      DevSettings.reload();
    }
  };

  const renderHeader = (title: string) => (
    <View style={styles.subHeader}>
      <TouchableOpacity onPress={() => setViewState('menu')} style={styles.backButton}>
        <ChevronLeft size={24} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>Voltar</Text>
      </TouchableOpacity>
      <Text style={[styles.subTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );

  if (viewState === 'data') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader('Meus Dados')}
        <View style={styles.dataContent}>
          <View style={[styles.dataItem, { borderBottomColor: colors.border }]}>
            <Text style={styles.label}>Nome Completo</Text>
            <Text style={[styles.value, { color: colors.text }]}>{userData?.name}</Text>
          </View>
          <View style={[styles.dataItem, { borderBottomColor: colors.border }]}>
            <Text style={styles.label}>E-mail</Text>
            <Text style={[styles.value, { color: colors.text }]}>{userData?.email}</Text>
          </View>
          <View style={[styles.dataItem, { borderBottomColor: colors.border }]}>
            <Text style={styles.label}>Tipo de Conta</Text>
            <Text style={[styles.value, { color: colors.text }]}>{userData?.role === 'BUYER' ? 'Comprador' : 'Fornecedor'}</Text>
          </View>
          <View style={[styles.dataItem, { borderBottomColor: colors.border }]}>
            <Text style={styles.label}>Empresa</Text>
            <Text style={[styles.value, { color: colors.text }]}>{userData?.company?.name}</Text>
          </View>
          <View style={[styles.dataItem, { borderBottomColor: colors.border }]}>
            <Text style={styles.label}>CNPJ</Text>
            <Text style={[styles.value, { color: colors.text }]}>{userData?.company?.cnpj}</Text>
          </View>
          <Text style={styles.infoNote}>Para alterar seus dados, entre em contato com o suporte.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (viewState === 'addresses') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader('Endereços')}
        <ScrollView style={styles.dataContent}>
          {userData?.company?.addresses?.map((addr: any) => (
            <View key={addr.id} style={[styles.addressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MapPin size={20} color={colors.primary} />
              <View style={styles.addressInfo}>
                <Text style={[styles.addressStreet, { color: colors.text }]}>{addr.street}, {addr.number}</Text>
                <Text style={[styles.addressCity, { color: colors.textSecondary }]}>{addr.neighborhood} - {addr.city}/{addr.state}</Text>
                <Text style={styles.addressZip}>{addr.zipCode}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (viewState === 'settings') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {renderHeader('Configurações')}
        <View style={styles.dataContent}>
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Modo Escuro (Dark Mode)</Text>
            <Switch 
              value={darkMode} 
              onValueChange={toggleDarkMode} 
              trackColor={{ false: '#767577', true: colors.primary + '80' }}
              thumbColor={darkMode ? colors.primary : '#f4f3f4'}
            />
          </View>
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Notificações Push</Text>
            <Switch 
              value={notifications} 
              onValueChange={setNotifications}
              trackColor={{ false: '#767577', true: colors.primary + '80' }}
              thumbColor={notifications ? colors.primary : '#f4f3f4'}
            />
          </View>
          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>Idioma</Text>
            <Text style={styles.settingValue}>Português (BR)</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userData?.name ? userData.name[0].toUpperCase() : 'U'}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{userData?.name || 'Carregando...'}</Text>
        <Text style={[styles.company, { color: colors.textSecondary }]}>{userData?.company?.name || '...'}</Text>
      </View>

      <View style={[styles.menuContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => setViewState('data')}>
          <View style={styles.menuItemIcon}><User size={24} color={colors.textSecondary} /></View>
          <Text style={[styles.menuItemText, { color: colors.text }]}>Meus Dados</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => setViewState('addresses')}>
          <View style={styles.menuItemIcon}><FileText size={24} color={colors.textSecondary} /></View>
          <Text style={[styles.menuItemText, { color: colors.text }]}>Endereços de Entrega</Text>
        </TouchableOpacity>

        {userData?.role === 'SUPPLIER' && (
          <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => navigation.navigate('Catalog')}>
            <View style={styles.menuItemIcon}><List size={24} color={colors.textSecondary} /></View>
            <Text style={[styles.menuItemText, { color: colors.text }]}>Meu Catálogo</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={() => setViewState('settings')}>
          <View style={styles.menuItemIcon}><Settings size={24} color={colors.textSecondary} /></View>
          <Text style={[styles.menuItemText, { color: colors.text }]}>Configurações</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]}>
          <View style={styles.menuItemIcon}><HelpCircle size={24} color={colors.textSecondary} /></View>
          <Text style={[styles.menuItemText, { color: colors.text }]}>Ajuda e Suporte</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.card, borderColor: '#ffcdd233' }]} onPress={handleLogout}>
        <LogOut size={20} color="#E53935" style={{ marginRight: 8 }} />
        <Text style={styles.logoutText}>Sair do Aplicativo</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: 40, borderBottomWidth: 1 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF5722', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: 'white' },
  name: { fontSize: 22, fontWeight: 'bold' },
  company: { fontSize: 15, marginTop: 4 },
  menuContainer: { marginTop: 20, borderTopWidth: 1, borderBottomWidth: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1 },
  menuItemIcon: { marginRight: 16 },
  menuItemText: { fontSize: 16 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingVertical: 16, marginHorizontal: 20, borderRadius: 12, borderWidth: 1 },
  logoutText: { fontSize: 16, fontWeight: 'bold', color: '#E53935' },

  subHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'transparent' },
  backButton: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  backText: { fontWeight: 'bold', fontSize: 16, marginLeft: 4 },
  subTitle: { fontSize: 20, fontWeight: 'bold' },
  dataContent: { padding: 20 },
  dataItem: { marginBottom: 20, borderBottomWidth: 1, paddingBottom: 10 },
  label: { fontSize: 13, color: '#888', marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '600' },
  infoNote: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 20, fontStyle: 'italic' },
  
  addressCard: { flexDirection: 'row', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, alignItems: 'flex-start' },
  addressInfo: { marginLeft: 12, flex: 1 },
  addressStreet: { fontSize: 15, fontWeight: 'bold' },
  addressCity: { fontSize: 13, marginTop: 2 },
  addressZip: { fontSize: 12, color: '#999', marginTop: 2 },

  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  settingLabel: { fontSize: 16 },
  settingValue: { fontSize: 14, color: '#999', fontWeight: 'bold' }
});
