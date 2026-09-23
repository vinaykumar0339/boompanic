import { addDoc, collection, deleteDoc, doc, getDoc, getDocFromServer, onSnapshot, runTransaction } from 'firebase/firestore';

import { decodeGameMessage, type GameMessage } from '../GameProtocol';
import type { ConnectionState, GameNetwork } from '../GameNetwork';
import { firestore, getFirebaseUserId } from './Firebase';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_LIFETIME_MS = 10 * 60 * 1_000;

const roomCode = () => Array.from({ length: 6 }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]!).join('');

/** Firestore-backed room transport. It avoids a fragile direct WebRTC connection on mobile networks. */
export class OnlineNetwork implements GameNetwork {
  private state: ConnectionState = 'IDLE';
  private roomRef: ReturnType<typeof doc> | null = null;
  private roomListener: (() => void) | null = null;
  private messagesListener: (() => void) | null = null;
  private roomPoller: ReturnType<typeof setInterval> | null = null;
  private localUserId = '';
  private readonly messageListeners = new Set<(message: GameMessage) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState, detail?: string) => void>();

  async connect() {}

  private setState(state: ConnectionState, detail?: string) {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state, detail));
  }

  private listenForMessages() {
    if (!this.roomRef || this.messagesListener) return;
    this.messagesListener = onSnapshot(collection(this.roomRef, 'messages'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const message = decodeGameMessage(JSON.stringify(change.doc.data().message));
        if (message) this.messageListeners.forEach((listener) => listener(message));
      });
    }, (error) => this.fail(error, 'Could not receive game updates.'));
  }

  private listenForRoom() {
    if (!this.roomRef) return;
    this.roomListener?.();
    this.roomListener = onSnapshot(this.roomRef, (snapshot) => {
      this.applyRoomState(snapshot.exists(), snapshot.data());
    }, (error) => this.fail(error, 'Could not listen for room updates.'));
    this.roomPoller ??= setInterval(() => {
      if (!this.roomRef || this.state === 'CONNECTED') return;
      void getDocFromServer(this.roomRef)
        .then((snapshot) => this.applyRoomState(snapshot.exists(), snapshot.data()))
        .catch((error) => this.fail(error, 'Could not refresh the room.'));
    }, 1_200);
  }

  private applyRoomState(exists: boolean, room: Record<string, unknown> | undefined) {
    if (!exists || !room) {
      this.setState('DISCONNECTED', 'Your rival left the room.');
      return;
    }
    if (Number(room.expiresAt) <= Date.now()) {
      this.setState('FAILED', 'That room has expired.');
      return;
    }
    if (typeof room.guestId === 'string' && room.guestId !== this.localUserId) {
      this.listenForMessages();
      this.stopRoomPolling();
      this.setState('CONNECTED', 'Rival joined.');
    } else if (room.guestId === this.localUserId) {
      this.listenForMessages();
      this.stopRoomPolling();
      this.setState('CONNECTED', 'Room joined.');
    } else {
      this.setState('WAITING', 'Room code is ready. Waiting for your rival…');
    }
  }

  private stopRoomPolling() {
    if (this.roomPoller) clearInterval(this.roomPoller);
    this.roomPoller = null;
  }

  private fail(error: unknown, fallback: string) {
    this.setState('FAILED', error instanceof Error ? error.message : fallback);
  }

  async createOffer(): Promise<string> {
    this.setState('CREATING');
    this.localUserId = await getFirebaseUserId();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = roomCode();
      const ref = doc(firestore, 'boomPanicRooms', code);
      try {
        await runTransaction(firestore, async (transaction) => {
          const existing = await transaction.get(ref);
          if (existing.exists()) throw new Error('Room code collision.');
          transaction.set(ref, {
            hostId: this.localUserId,
            createdAt: Date.now(),
            expiresAt: Date.now() + ROOM_LIFETIME_MS,
          });
        });
        this.roomRef = ref;
        this.listenForRoom();
        return code;
      } catch (error) {
        if (attempt === 5) throw error;
      }
    }
    throw new Error('Could not create a room.');
  }

  async acceptOffer(code: string): Promise<void> {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z2-9]/g, '');
    if (normalized.length !== 6) throw new Error('Enter the six-character room code.');
    this.setState('CONNECTING', 'Joining room…');
    this.localUserId = await getFirebaseUserId();
    const ref = doc(firestore, 'boomPanicRooms', normalized);
    const room = await getDoc(ref);
    if (!room.exists() || Number(room.data().expiresAt) <= Date.now()) throw new Error('That room code has expired or does not exist.');
    await runTransaction(firestore, async (transaction) => {
      const latest = await transaction.get(ref);
      if (!latest.exists() || Number(latest.data().expiresAt) <= Date.now()) throw new Error('That room has expired.');
      if (latest.data().guestId) throw new Error('That room already has a rival.');
      transaction.update(ref, { guestId: this.localUserId });
    });
    this.roomRef = ref;
    this.listenForRoom();
  }

  async send(message: GameMessage) {
    if (!this.roomRef || this.state !== 'CONNECTED') throw new Error('No game room is connected.');
    await addDoc(collection(this.roomRef, 'messages'), { authorId: this.localUserId, message });
  }

  onMessage(callback: (message: GameMessage) => void) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  onConnectionStateChange(callback: (state: ConnectionState, detail?: string) => void) {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  async disconnect() {
    this.roomListener?.();
    this.messagesListener?.();
    this.stopRoomPolling();
    this.roomListener = null;
    this.messagesListener = null;
    if (this.roomRef && this.localUserId) void deleteDoc(this.roomRef).catch(() => undefined);
    this.roomRef = null;
    this.setState('DISCONNECTED');
  }
}
