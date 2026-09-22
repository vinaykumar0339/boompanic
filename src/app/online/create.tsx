import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Brand, ConnectionStatus, Field, Header, InviteCode, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';
import { useGameSession } from '@/game/GameSession';

export default function CreateOnlineRoute() { const started = useRef(false); const [answer, setAnswer] = useState(''); const session = useGameSession(); useEffect(() => { if (!started.current) { started.current = true; void session.createOnlineHost(); } }, [session]); useEffect(() => { if (session.connection === 'CONNECTED') router.replace('/lobby'); }, [session.connection]); return <Screen><Brand compact /><Header eyebrow="ONLINE GAME" title="Send the challenge" copy="Share your code. Then paste or scan the response from your rival." />{session.invitation && <InviteCode value={session.invitation} />}{session.invitation && <><Field value={answer} onChangeText={setAnswer} placeholder="Paste rival’s response" multiline /><PrimaryButton label="CONNECT RESPONSE" onPress={() => void session.acceptOnlineAnswer(answer)} tone="violet" /></>}<ConnectionStatus state={session.connection} detail={session.connectionDetail} /><SecondaryButton label="CANCEL" onPress={() => { session.cancel(); router.replace('/'); }} /></Screen>; }
