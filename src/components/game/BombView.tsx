import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export function BombView({ active, panic, exploded = false }: { active: boolean; panic: boolean; exploded?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active || exploded) { scale.stopAnimation(); rotate.stopAnimation(); scale.setValue(1); rotate.setValue(0); return; }
    const beat = Animated.loop(Animated.sequence([
      Animated.parallel([Animated.timing(scale, { toValue: panic ? 1.12 : 1.055, duration: panic ? 130 : 420, useNativeDriver: true }), Animated.timing(rotate, { toValue: 1, duration: panic ? 130 : 420, useNativeDriver: true })]),
      Animated.parallel([Animated.timing(scale, { toValue: 1, duration: panic ? 130 : 420, useNativeDriver: true }), Animated.timing(rotate, { toValue: -1, duration: panic ? 130 : 420, useNativeDriver: true })]),
    ]));
    beat.start(); return () => beat.stop();
  }, [active, exploded, panic, rotate, scale]);
  const spin = rotate.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-4deg', '0deg', '4deg'] });
  return <View style={[styles.wrap, panic && styles.panic, exploded && styles.exploded]}><Animated.View style={{ transform: [{ scale }, { rotate: spin }] }}><Text accessibilityLabel={exploded ? 'Bomb exploded' : 'Live bomb'} style={styles.bomb}>{exploded ? '💥' : '💣'}</Text></Animated.View>{active && !exploded ? <Text style={styles.fuse}>{panic ? 'FUSE PANIC' : 'FUSE LIT'}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  wrap: { width: 178, height: 178, borderRadius: 89, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16264B', borderWidth: 2, borderColor: '#314979', shadowColor: '#FF9A00', shadowOpacity: .22, shadowRadius: 18, elevation: 6 },
  panic: { backgroundColor: '#542039', borderColor: '#FF4D5D', shadowColor: '#FF334B', shadowOpacity: .9, shadowRadius: 28 },
  exploded: { backgroundColor: '#3B1835', borderColor: '#FF4D5D' },
  bomb: { fontSize: 94 }, fuse: { position: 'absolute', bottom: 17, color: '#FFD31A', fontWeight: '900', fontSize: 10, letterSpacing: 1.5 },
});
