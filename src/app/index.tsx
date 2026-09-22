import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BombMascot, BottomNav, Brand, ModeCard, Screen } from '@/components/game/GameUi';

export default function HomeScreen() {
  return <Screen scroll={false}><View style={styles.hero}><BombMascot size={165} style={styles.mascot} /><Brand /><Text style={styles.tagline}>Pass it before you panic.</Text></View><View style={styles.modes}><ModeCard icon="wifi" title="LOCAL GAME" copy="Play on the same Wi-Fi or hotspot" tone="orange" onPress={() => router.push('/local')} /><ModeCard icon="globe" title="ONLINE GAME" copy="Play with a friend from anywhere" tone="violet" onPress={() => router.push('/online')} /></View><Text style={styles.tip}>QUICK ROUNDS · ONE PLAYER LOSES</Text><BottomNav /></Screen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center', paddingTop: 8, marginBottom: 10 }, mascot: { marginBottom: -68, transform: [{ translateY: -12 }] }, tagline: { color: '#FFD31A', textAlign: 'center', fontWeight: '900', fontStyle: 'italic', fontSize: 18, marginTop: 6 }, modes: { gap: 14 }, tip: { color: '#8E9BBB', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 3 } });
