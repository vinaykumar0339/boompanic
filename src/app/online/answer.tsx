import { router } from 'expo-router';
import { useEffect } from 'react';

import { Brand, ConnectionStatus, Header, InviteCode, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function OnlineAnswerRoute() { const session = useGameSession(); useEffect(() => { if (session.connection === 'CONNECTED') router.replace('/lobby'); }, [session.connection]); return <Screen><Brand compact /><Header eyebrow="ONLINE GAME" title="Return the spark" copy="Show this response to the host. The duel opens as soon as they accept it." />{session.invitation && <InviteCode value={session.invitation} />}<ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { session.cancel(); router.replace('/'); }} /></Screen>; }
