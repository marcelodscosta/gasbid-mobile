import { useState, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api';

// Configurar comportamento quando app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(navigationRef?: any) {
  const [expoPushToken, setExpoPushToken] = useState<string>('');
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    registerForPushNotifications().then(token => {
      if (token) {
        setExpoPushToken(token);
        // Registrar no backend
        api.post('/push-tokens', {
          token,
          platform: Platform.OS,
        }).catch(err => {
          console.warn('Failed to register push token:', err?.message);
        });
      }
    });

    // Listener: notificação recebida (foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // A notificação será exibida automaticamente pelo handler acima
      console.log('Notification received in foreground:', notification.request.content.title);
    });

    // Listener: usuário tocou na notificação
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (navigationRef?.current) {
        handleNotificationNavigation(data, navigationRef.current);
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications não funcionam em emuladores
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Verificar/solicitar permissão
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // Obter Expo Push Token
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });

    // Configurar canal padrão no Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'GasBid',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F97316',
      });
    }

    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

function handleNotificationNavigation(data: any, navigation: any) {
  if (!data?.type) return;

  try {
    switch (data.type) {
      case 'NEW_OPPORTUNITY':
        navigation.navigate('Opportunities');
        break;
      case 'OPPORTUNITY_CANCELLED':
        navigation.navigate('Opportunities');
        break;
      case 'PROPOSAL_RECEIVED':
        navigation.navigate('Home');
        break;
      case 'PROPOSAL_OUTBID':
      case 'COUNTER_OFFER_RECEIVED':
        navigation.navigate('Opportunities');
        break;
      case 'PROPOSAL_REJECTED':
        navigation.navigate('Opportunities');
        break;
      case 'ORDER_CREATED':
      case 'ORDER_UPDATED':
        navigation.navigate('Orders');
        break;
      case 'NEW_ORDER_MESSAGE':
        navigation.navigate('Orders');
        break;
      case 'RATING_RECEIVED':
        navigation.navigate('SupplierMetrics');
        break;
      case 'REQUEST_CLOSED':
        navigation.navigate('Opportunities');
        break;
      default:
        break;
    }
  } catch (err) {
    console.warn('Navigation from push failed:', err);
  }
}

/**
 * Remove o push token do backend (chamar no logout)
 */
export async function unregisterPushToken() {
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    await api.delete(`/push-tokens/${encodeURIComponent(tokenData.data)}`);
  } catch (err) {
    console.warn('Failed to unregister push token:', err);
  }
}
