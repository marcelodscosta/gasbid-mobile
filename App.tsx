import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MapPin, List, User, BarChart2, Zap, Package, TrendingUp } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePushNotifications } from './src/hooks/usePushNotifications';

// Buyer Screens
import HomeScreen from './src/screens/HomeScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import StatsScreen from './src/screens/StatsScreen';

// Supplier Screens
import OpportunitiesScreen from './src/screens/supplier/OpportunitiesScreen';
import ProposalScreen from './src/screens/supplier/ProposalScreen';
import SupplierOrdersScreen from './src/screens/supplier/SupplierOrdersScreen';
import SupplierOrderDetailScreen from './src/screens/supplier/SupplierOrderDetailScreen';
import SupplierMetricsScreen from './src/screens/supplier/SupplierMetricsScreen';
import CatalogScreen from './src/screens/supplier/CatalogScreen';

// Shared Screens
import ProfileScreen from './src/screens/ProfileScreen';
import SplashScreen from './src/screens/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';

import { authEvents } from './src/api';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { UserProvider, UserRole } from './src/context/UserContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ─── Buyer Navigation ──────────────────────────────────────────────────────────
function BuyerTabs() {
  const { darkMode, colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <MapPin color={color} size={size} />;
          if (route.name === 'Orders') return <List color={color} size={size} />;
          if (route.name === 'Stats') return <BarChart2 color={color} size={size} />;
          if (route.name === 'Profile') return <User color={color} size={size} />;
          return null;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: darkMode ? '#666' : 'gray',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Pedir Gás' }} />
      <Tab.Screen name="Orders" component={OrdersScreen} options={{ title: 'Pedidos' }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: 'Estatísticas' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

// ─── Supplier Navigation ───────────────────────────────────────────────────────
function SupplierBottomTabs() {
  const { darkMode, colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Opportunities') return <Zap color={color} size={size} />;
          if (route.name === 'SupplierOrders') return <Package color={color} size={size} />;
          if (route.name === 'SupplierMetrics') return <TrendingUp color={color} size={size} />;
          if (route.name === 'Profile') return <User color={color} size={size} />;
          return null;
        },
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: darkMode ? '#666' : 'gray',
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          elevation: 0,
          shadowOpacity: 0,
        },
      })}
    >
      <Tab.Screen name="Opportunities" component={OpportunitiesScreen} options={{ title: 'Oportunidades' }} />
      <Tab.Screen name="SupplierOrders" component={SupplierOrdersScreen} options={{ title: 'Pedidos' }} />
      <Tab.Screen name="SupplierMetrics" component={SupplierMetricsScreen} options={{ title: 'Desempenho' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function SupplierStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SupplierMain" component={SupplierBottomTabs} />
      <Stack.Screen name="ProposalDetail" component={ProposalScreen} />
      <Stack.Screen name="SupplierOrderDetail" component={SupplierOrderDetailScreen} />
      <Stack.Screen name="Catalog" component={CatalogScreen} />
    </Stack.Navigator>
  );
}

// ─── App Navigator (needs ThemeProvider + UserProvider above it) ───────────────
interface AppNavigatorProps {
  userRole: UserRole;
  onLoginSuccess: (role: string) => void;
}

function AppNavigator({ userRole, onLoginSuccess }: AppNavigatorProps) {
  const navigationRef = useRef<any>(null);
  const { expoPushToken } = usePushNotifications(navigationRef);

  return (
    <NavigationContainer ref={navigationRef}>
      {userRole === 'SUPPLIER' ? <SupplierStack /> : <BuyerTabs />}
    </NavigationContainer>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [isSplashComplete, setIsSplashComplete] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const [token, storedRole] = await Promise.all([
          AsyncStorage.getItem('@gasbid:token'),
          AsyncStorage.getItem('@gasbid:role'),
        ]);
        if (token) {
          setIsLoggedIn(true);
          setUserRole((storedRole as UserRole) ?? 'BUYER');
        }
      } catch (_) {}
    };
    checkLoginStatus();

    const unsubscribe = authEvents.onUnauthenticated(() => {
      setIsLoggedIn(false);
      setUserRole(null);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
  };

  const handleLoginSuccess = (role: string) => {
    setUserRole(role as UserRole);
    setIsLoggedIn(true);
  };

  if (!isSplashComplete) {
    return <SplashScreen onFinish={() => setIsSplashComplete(true)} />;
  }

  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <UserProvider onLogout={handleLogout}>
      <ThemeProvider>
        <AppNavigator userRole={userRole} onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    </UserProvider>
  );
}
