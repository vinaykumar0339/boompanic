import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';

const steps = [
  ['1', 'CONNECT', 'Start a local or online game with one rival.'],
  ['2', 'CLEAR THE CHALLENGE', 'The bomb holder solves the mini challenge before time runs out.'],
  ['3', 'PASS IT FAST', 'A correct answer unlocks the pass. Send the bomb to your rival.'],
  ['4', 'DON’T BOOM', 'The player holding the bomb when the fuse ends loses the round.'],
];

export default function HowToPlayRoute() {
  return <Screen><Brand compact /><Header eyebrow="GAME GUIDE" title="HOW TO PLAY" copy="Quick reactions beat careful thinking when the fuse is lit." /><View style={styles.steps}>{steps.map(([number, title, copy]) => <View key={number} style={styles.step}><View style={styles.number}><Text style={styles.numberText}>{number}</Text></View><View style={styles.words}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepCopy}>{copy}</Text></View></View>)}</View><View style={styles.warning}><Text style={styles.warningTitle}>💣 PANIC TIP</Text><Text style={styles.warningCopy}>Wrong answers shorten the round. Get it right, then pass immediately.</Text></View><PrimaryButton label="START A GAME" onPress={() => router.replace('/')} /><SecondaryButton label="←  BACK" onPress={() => router.back()} /></Screen>;
}

const styles = StyleSheet.create({
  steps: { gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 15, borderRadius: 19, borderWidth: 1, borderColor: '#2C4270', backgroundColor: '#111B3C' },
  number: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7747FF' },
  numberText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  words: { flex: 1, gap: 3 },
  stepTitle: { color: '#F8FBFF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  stepCopy: { color: '#A9B7D8', fontSize: 13, lineHeight: 18 },
  warning: { padding: 17, alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: '#C75A17', backgroundColor: '#3B2130', gap: 4 },
  warningTitle: { color: '#FFD31A', fontSize: 13, fontWeight: '900', letterSpacing: 1.1 },
  warningCopy: { color: '#F9D9BF', textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
