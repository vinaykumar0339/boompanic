import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Field, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function SettingsRoute() {
  const session = useGameSession();
  const [name, setName] = useState(session.displayName);
  const [saved, setSaved] = useState(false);
  const save = async () => { await session.setDisplayName(name); setName(name.trim().slice(0, 18) || 'Player'); setSaved(true); };
  return <Screen><Brand compact /><Header eyebrow="PLAYER SETUP" title="SETTINGS" copy="Set the name your rival sees in the lobby." /><View style={styles.card}><Text style={styles.label}>PLAYER NAME</Text><Field value={name} onChangeText={(value) => { setName(value); setSaved(false); }} placeholder="PLAYER" maxLength={18} /><Text style={styles.help}>Up to 18 characters. This is saved on this device.</Text></View>{saved ? <View style={styles.saved}><Text style={styles.savedText}>✓ NAME SAVED</Text></View> : null}<PrimaryButton label="SAVE NAME" onPress={() => void save()} tone="green" /><SecondaryButton label="←  BACK" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({
  card: { padding: 17, borderRadius: 22, borderWidth: 1, borderColor: '#2C4270', backgroundColor: '#111B3C', gap: 10 },
  label: { color: '#FFD31A', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 }, help: { color: '#A9B7D8', fontSize: 12, lineHeight: 17 },
  saved: { alignItems: 'center', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#2AD999', backgroundColor: '#103E36' }, savedText: { color: '#5CF0B2', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
});
