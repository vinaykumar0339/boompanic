# BoomPanic

Pass it. Outsmart them. Don’t hold the BOOM.

BoomPanic is a two-player bomb-passing game with no accounts and no BoomPanic backend. The host is the temporary game authority: it validates passes, chooses the hidden 20–60 second explosion time, and sends game events. Devices render locally; the countdown is never streamed per frame.

## Run a development build

This app cannot use Expo Go for multiplayer. `react-native-tcp-socket` and `react-native-webrtc` contain native code.

```bash
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

For a shareable build, configure EAS for the project, then use:

```bash
npx eas-cli@latest build --profile development --platform android
npx expo start --dev-client
```

Do not hand-edit the generated `android/` or `ios/` folders. Native configuration belongs in `app.json`.

## Local game

1. Put both physical devices on the same Wi-Fi network, or connect the second device to the host device’s hotspot.
2. On Player 1, choose **Local Game → Create Game**.
3. On Player 2, choose **Local Game → Join Game**, scan the QR code, or enter the displayed `IP:port`.
4. Once connected, both players select **I’m Ready**. The host starts the duel.

Local game uses a direct TCP connection. QR/IP entry is deliberate for V1: it is simpler and more reliable than mDNS or UDP broadcast across hotspot and mixed Android/iOS networks.

## Online game

1. Player 1 selects **Online Game → Create Game** and shares the offer QR/payload.
2. Player 2 scans/pastes it to produce an answer QR/payload.
3. Player 1 scans/pastes the answer. The two devices then attempt a direct WebRTC DataChannel connection.

There is no custom signaling or matchmaking server. The app uses a public STUN endpoint only to discover reachable public candidates; game data goes over the direct DataChannel. It never configures TURN or a relay.

## Limitations and physical-device checklist

Direct online P2P is not guaranteed. Symmetric NAT, carrier-grade NAT, restrictive firewalls, captive portals, some mobile networks, and Wi-Fi client isolation can prevent direct WebRTC connectivity. In those cases the app reports that the direct connection is unavailable; retry on another network or use Local Mode. A TURN relay would improve reliability but is intentionally not included because it would be server infrastructure.

Test before release:

- Local: Android↔Android, iOS↔iOS, Android↔iOS; same Wi-Fi; phone hotspot; isolated/different LANs.
- Online: Wi-Fi↔Wi-Fi, Wi-Fi↔mobile data, mobile↔mobile, Android↔iOS.
- Gameplay: valid/invalid pass, simultaneous presses, disconnect/reconnect, background/foreground, explosion, rematch, and malformed QR/network data.

The UI and TypeScript compile have been checked; real TCP/WebRTC interoperability still requires those two-device tests.
