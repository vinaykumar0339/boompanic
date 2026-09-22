import { router } from 'expo-router';

import { Brand, FriendsArt, Header, PrimaryButton, Screen, SecondaryButton } from '@/components/game/GameUi';

export default function LocalGameRoute() { return <Screen scroll={false}><Brand compact /><Header eyebrow="LOCAL GAME" title="PLAY NEARBY" copy="Play with a friend on the same Wi-Fi or hotspot." /><PrimaryButton label="CREATE GAME" onPress={() => router.push('/local/create')} tone="green" /><PrimaryButton label="JOIN GAME" onPress={() => router.push('/local/join')} tone="violet" /><FriendsArt /><SecondaryButton label="←  BACK" onPress={() => router.back()} /></Screen>; }
