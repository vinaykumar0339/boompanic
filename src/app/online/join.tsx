import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Brand, ConnectionStatus, Field, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function JoinOnlineRoute() { const [roomCode, setRoomCode] = useState(''); const session = useGameSession(); useEffect(() => { if (session.connection === 'CONNECTED') router.replace('/lobby'); }, [session.connection]); return <Screen><Brand compact /><Header eyebrow="JOIN ONLINE" title="ENTER ROOM CODE" copy="Ask your friend for their six-character room code, or scan it." /><PrimaryButton label="SCAN QR" onPress={() => router.push('/scan?kind=offer')} tone="violet" /><Field value={roomCode} onChangeText={(value) => setRoomCode(value.toUpperCase())} placeholder="E.G. F7K2Q9" autoCapitalize="characters" autoCorrect={false} maxLength={6} /><PrimaryButton label="JOIN ROOM" onPress={() => void session.createOnlineAnswer(roomCode)} disabled={roomCode.trim().length !== 6} tone="green" /><ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { void session.cancel(); router.replace('/online'); }} /></Screen>; }
