import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function ScanRoute() { const { kind } = useLocalSearchParams<{ kind: 'local' | 'offer' }>(); const [permission, requestPermission] = useCameraPermissions(); const session = useGameSession(); const didScan = useRef(false); useEffect(() => { if (!permission?.granted) void requestPermission(); }, [permission, requestPermission]); const scanned = ({ data }: { data: string }) => { if (didScan.current) return; didScan.current = true; if (kind === 'local') { void session.joinLocal(data); router.replace('/local/join'); } else { void session.createOnlineAnswer(data); router.replace('/online/join'); } }; if (!permission?.granted) return <View style={styles.empty}><Text style={styles.text}>Camera permission is required to scan a game code.</Text><SecondaryButton label="BACK" onPress={() => router.back()} /></View>; return <View style={styles.camera}><CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned} /><View style={styles.overlay}><Text style={styles.text}>Scan room code</Text><SecondaryButton label="CANCEL" onPress={() => router.back()} /></View></View>; }
const styles = StyleSheet.create({ camera: { flex: 1, backgroundColor: '#080E26' }, overlay: { flex: 1, justifyContent: 'flex-end', padding: 28, gap: 20, backgroundColor: 'rgba(8,14,38,0.38)' }, empty: { flex: 1, padding: 28, justifyContent: 'center', backgroundColor: '#080E26', gap: 20 }, text: { color: '#F8FBFF', fontSize: 22, textAlign: 'center', fontWeight: '800' } });
