import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { Truck, Flame } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  // Animation values
  const truckPosition = useRef(new Animated.Value(-width)).current; // Start off-screen left
  const fadeAnim = useRef(new Animated.Value(0)).current; // Logo fade
  const scaleAnim = useRef(new Animated.Value(0.8)).current; // Logo scale
  const containerOpacity = useRef(new Animated.Value(1)).current; // For final exit

  useEffect(() => {
    // 1. Truck drives in with a spring (brake effect)
    Animated.spring(truckPosition, {
      toValue: 0, // Stop at center
      friction: 6, // Controls "bounciness"
      tension: 40, // Controls speed
      useNativeDriver: true,
    }).start(() => {
      // 2. Logo pops in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 3. Hold for a moment
        setTimeout(() => {
          // 4. Truck drives away to the right, and container fades out
          Animated.parallel([
            Animated.timing(truckPosition, {
              toValue: width, // Drive off-screen right
              duration: 600,
              easing: Easing.in(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(containerOpacity, {
              toValue: 0,
              duration: 600,
              delay: 200, // wait a bit before fading out background
              useNativeDriver: true,
            })
          ]).start(() => {
            // Animation finished! Proceed to next screen
            onFinish();
          });
        }, 1200);
      });
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.animationWrapper}>
        <Animated.View style={[styles.truckContainer, { transform: [{ translateX: truckPosition }] }]}>
          <Truck color="#FF5722" size={56} strokeWidth={1.5} />
          <View style={styles.flameIcon}>
            <Flame color="#FFF" size={20} fill="#FF5722" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.logoContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <Text style={styles.logoText}>Gas<Text style={styles.logoBold}>Bid</Text></Text>
          <Text style={styles.subtitle}>Sua rede logística B2B</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#111827', // Dark, premium slate
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999, // Ensure it's on top
  },
  animationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
  truckContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  flameIcon: {
    position: 'absolute',
    top: 5,
    right: 5,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 36,
    color: '#FFF',
    letterSpacing: 1,
  },
  logoBold: {
    fontWeight: 'bold',
    color: '#FF5722',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 8,
    letterSpacing: 0.5,
  }
});
