import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel';
import type RTCDataChannelEvent from 'react-native-webrtc/lib/typescript/RTCDataChannelEvent';
import type MessageEvent from 'react-native-webrtc/lib/typescript/MessageEvent';

import { decodeGameMessage, type GameMessage } from '../GameProtocol';
import type { ConnectionState, GameNetwork } from '../GameNetwork';
import { decodeSignal, encodeSignal, type SignalingPayload } from './SignalingPayload';

const STUN_CONFIGURATION = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

/** Manual-signaling WebRTC DataChannel transport; it never contacts an app backend. */
export class OnlineNetwork implements GameNetwork {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private state: ConnectionState = 'IDLE';
  private readonly messageListeners = new Set<(message: GameMessage) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState, detail?: string) => void>();

  async connect() { this.createPeer(); }
  private setState(state: ConnectionState, detail?: string) { this.state = state; this.stateListeners.forEach((listener) => listener(state, detail)); }
  private createPeer() {
    if (this.peer) return;
    this.peer = new RTCPeerConnection(STUN_CONFIGURATION);
    this.peer.onconnectionstatechange = () => {
      const state = this.peer?.connectionState;
      if (state === 'connected') this.setState('CONNECTED');
      else if (state === 'connecting') this.setState('CONNECTING', 'Establishing direct connection…');
      else if (state === 'disconnected') this.setState('RECONNECTING', 'Trying to reconnect…');
      else if (state === 'failed') this.setState('FAILED', 'Direct connection could not be established on this network.');
      else if (state === 'closed') this.setState('DISCONNECTED');
    };
    this.peer.ondatachannel = (event: RTCDataChannelEvent<'datachannel'>) => this.attachChannel(event.channel);
  }
  private attachChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.onopen = () => this.setState('CONNECTED');
    channel.onclose = () => this.setState('DISCONNECTED', 'Peer disconnected.');
    channel.onerror = () => this.setState('FAILED', 'Data channel error.');
    channel.onmessage = (event: MessageEvent<'message'>) => { const parsed = decodeGameMessage(String(event.data)); if (parsed) this.messageListeners.forEach((listener) => listener(parsed)); };
  }
  private async waitForIce() {
    if (!this.peer || this.peer.iceGatheringState === 'complete') return;
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 8_000);
      this.peer!.onicegatheringstatechange = () => { if (this.peer?.iceGatheringState === 'complete') { clearTimeout(timeout); resolve(); } };
    });
  }
  async createOffer(): Promise<string> {
    this.createPeer(); this.setState('CREATING');
    this.attachChannel(this.peer!.createDataChannel('boompanic', { ordered: true }));
    const offer = await this.peer!.createOffer(); await this.peer!.setLocalDescription(offer); await this.waitForIce();
    const description = this.peer!.localDescription;
    if (!description?.sdp) throw new Error('Unable to create invitation.');
    this.setState('WAITING');
    return encodeSignal({ version: 1, kind: 'offer', sdp: { type: 'offer', sdp: description.sdp }, createdAt: Date.now() });
  }
  async acceptOffer(encoded: string): Promise<string> {
    const offer = decodeSignal(encoded); if (!offer || offer.kind !== 'offer') throw new Error('That is not a valid BoomPanic invitation.');
    this.createPeer(); this.setState('CONNECTING');
    await this.peer!.setRemoteDescription(new RTCSessionDescription(offer.sdp));
    const answer = await this.peer!.createAnswer(); await this.peer!.setLocalDescription(answer); await this.waitForIce();
    const description = this.peer!.localDescription; if (!description?.sdp) throw new Error('Unable to create response.');
    return encodeSignal({ version: 1, kind: 'answer', sdp: { type: 'answer', sdp: description.sdp }, createdAt: Date.now() });
  }
  async acceptAnswer(encoded: string) {
    const answer = decodeSignal(encoded); if (!answer || answer.kind !== 'answer') throw new Error('That is not a valid BoomPanic response.');
    if (!this.peer) throw new Error('Create an invitation first.');
    this.setState('CONNECTING'); await this.peer.setRemoteDescription(new RTCSessionDescription(answer.sdp));
  }
  async send(value: GameMessage) { if (!this.channel || this.channel.readyState !== 'open') throw new Error('No peer is connected.'); this.channel.send(JSON.stringify(value)); }
  onMessage(callback: (message: GameMessage) => void) { this.messageListeners.add(callback); return () => this.messageListeners.delete(callback); }
  onConnectionStateChange(callback: (state: ConnectionState, detail?: string) => void) { this.stateListeners.add(callback); callback(this.state); return () => this.stateListeners.delete(callback); }
  async disconnect() { this.channel?.close(); this.peer?.close(); this.channel = null; this.peer = null; this.setState('DISCONNECTED'); }
}
