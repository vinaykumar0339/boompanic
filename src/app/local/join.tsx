import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Brand, ConnectionStatus, Field, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function JoinLocalRoute() { const [address, setAddress] = useState(''); const session = useGameSession(); useEffect(() => { if (session.connection === 'CONNECTED') router.replace('/lobby'); }, [session.connection]); return <Screen><Brand compact /><Header eyebrow="JOIN LOCAL" title="Find the hot seat" copy="Scan your rival’s code or type their Wi-Fi address." /><PrimaryButton label="SCAN QR" onPress={() => router.push('/scan?kind=local')} tone="green" /><Field value={address} onChangeText={setAddress} placeholder="192.168.1.12:45454" /><SecondaryButton label="CONNECT" onPress={() => void session.joinLocal(address)} /><ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { session.cancel(); router.replace('/local'); }} /></Screen>; }
