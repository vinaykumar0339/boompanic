import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BombMascot, BottomNav, Brand, Field, ModeCard, Screen } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function HomeScreen() {
  const session = useGameSession();
  const [name, setName] = useState(session.displayName === 'Player' ? '' : session.displayName);
  const [nameError, setNameError] = useState(false);
  useEffect(() => { if (session.displayName !== 'Player') setName(session.displayName); }, [session.displayName]);
  const chooseMode = async (route: '/local' | '/online') => {
    if (!name.trim()) { setNameError(true); return; }
    await session.setDisplayName(name); router.push(route);
  };
  return <Screen><View style={styles.hero}><BombMascot size={165} style={styles.mascot} /><Brand /><Text style={styles.tagline}>Pass it before you panic.</Text></View><View style={[styles.playerCard, nameError && styles.playerCardError]}><Text style={styles.playerLabel}>WHAT SHOULD WE CALL YOU?</Text><Field value={name} onChangeText={(value) => { setName(value); setNameError(false); }} placeholder="ENTER PLAYER NAME" maxLength={18} returnKeyType="done" /><Text style={styles.playerHint}>{nameError ? 'Enter your name before starting a game.' : 'Your rival sees this name in the lobby.'}</Text></View><View style={styles.modes}><ModeCard icon="wifi" title="LOCAL GAME" copy="Play on the same Wi-Fi or hotspot" tone="orange" onPress={() => void chooseMode('/local')} /><ModeCard icon="globe" title="ONLINE GAME" copy="Play with a friend from anywhere" tone="violet" onPress={() => void chooseMode('/online')} /></View><Text style={styles.tip}>QUICK ROUNDS · ONE PLAYER LOSES</Text><BottomNav /></Screen>;
}
const styles = StyleSheet.create({ hero: { alignItems: 'center', paddingTop: 8, marginBottom: 2 }, mascot: { marginBottom: -68, transform: [{ translateY: -12 }] }, tagline: { color: '#FFD31A', textAlign: 'center', fontWeight: '900', fontStyle: 'italic', fontSize: 18, marginTop: 6 }, playerCard: { padding: 14, borderRadius: 19, borderWidth: 1, borderColor: '#2C4270', backgroundColor: '#111B3C', gap: 8 }, playerCardError: { borderColor: '#FF5867', backgroundColor: '#361D36' }, playerLabel: { color: '#FFD31A', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 }, playerHint: { color: '#A9B7D8', fontSize: 11, lineHeight: 16 }, modes: { gap: 14 }, tip: { color: '#8E9BBB', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 3 } });
