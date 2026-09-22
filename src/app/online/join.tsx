import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Brand, ConnectionStatus, Field, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function JoinOnlineRoute() { const [offer, setOffer] = useState(''); const session = useGameSession(); useEffect(() => { if (session.role === 'client' && session.mode === 'online' && session.invitation) router.replace('/online/answer'); }, [session.invitation, session.mode, session.role]); return <Screen><Brand compact /><Header eyebrow="JOIN ONLINE" title="Accept the challenge" copy="Scan or paste your rival’s invitation. You’ll send a response code back." /><PrimaryButton label="SCAN QR" onPress={() => router.push('/scan?kind=offer')} tone="violet" /><Field value={offer} onChangeText={setOffer} placeholder="Paste invitation" multiline /><SecondaryButton label="CREATE RESPONSE" onPress={() => void session.createOnlineAnswer(offer)} /><ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { session.cancel(); router.replace('/online'); }} /></Screen>; }
