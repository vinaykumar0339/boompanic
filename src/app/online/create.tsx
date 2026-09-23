import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { Brand, ConnectionStatus, Header, InviteCode, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function CreateOnlineRoute() { const started = useRef(false); const session = useGameSession(); useEffect(() => { if (!started.current) { started.current = true; void session.createOnlineHost(); } }, [session]); useEffect(() => { if (session.connection === 'CONNECTED') router.replace('/lobby'); }, [session.connection]); return <Screen><Brand compact /><Header eyebrow="ONLINE GAME" title="CREATE A ROOM" copy="Share this short code with one friend. They enter it to connect automatically." />{session.invitation && <InviteCode value={session.invitation} />}<ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { void session.cancel(); router.replace('/'); }} /></Screen>; }
