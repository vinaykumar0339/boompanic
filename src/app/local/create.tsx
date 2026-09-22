import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Text } from 'react-native';

import { Brand, ConnectionStatus, Header, InviteCode, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function CreateLocalRoute() { const started = useRef(false); const session = useGameSession(); useEffect(() => { if (!started.current) { started.current = true; void session.createLocalHost(); } }, [session]); useEffect(() => { if (session.connection === 'CONNECTED') router.replace('/lobby'); }, [session.connection]); return <Screen><Brand compact /><Header eyebrow="LOCAL GAME" title="Your table is ready" copy="Ask your rival to scan this code or enter the address below." />{session.invitation && <InviteCode value={session.invitation} />}{session.localAddress && <Text style={{ color: '#F8FBFF', fontSize: 23, fontWeight: '800', textAlign: 'center' }}>{session.localAddress}</Text>}<ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { session.cancel(); router.replace('/'); }} /></Screen>; }
