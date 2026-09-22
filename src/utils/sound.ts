import { Vibration, Platform } from 'react-native';

export const mobileAudioService = {
  // Bipe e vibração hática ao receber nova oferta
  notifyNewProposal() {
    try {
      // Padrão de vibração hática (2 pulsos rápidos)
      Vibration.vibrate([0, 150, 100, 150]);
    } catch (e) {
      console.warn('[MobileAudio] Vibration error:', e);
    }
  },

  // Bipe e vibração ao alterar status para Saiu para Entrega ou Entregue
  notifyOrderStatusChange() {
    try {
      // Padrão de vibração (1 pulso longo de confirmação)
      Vibration.vibrate([0, 400]);
    } catch (e) {
      console.warn('[MobileAudio] Vibration error:', e);
    }
  }
};
