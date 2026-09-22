import { router } from 'expo-router';

import { Brand, FriendsArt, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';

export default function OnlineGameRoute() { return <Screen scroll={false}><Brand compact /><Header eyebrow="ONLINE GAME" title="PLAY ANYWHERE" copy="Send an invitation code to a friend and start the panic." /><PrimaryButton label="CREATE GAME" onPress={() => router.push('/online/create')} tone="green" /><PrimaryButton label="JOIN GAME" onPress={() => router.push('/online/join')} tone="violet" /><FriendsArt /><SecondaryButton label="←  BACK" onPress={() => router.back()} /></Screen>; }
