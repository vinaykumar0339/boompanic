import type { GameMessage } from './GameProtocol';

export type ConnectionState = 'IDLE' | 'CREATING' | 'WAITING' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'FAILED';

export interface GameNetwork {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: GameMessage): Promise<void>;
  onMessage(callback: (message: GameMessage) => void): () => void;
  onConnectionStateChange(callback: (state: ConnectionState, detail?: string) => void): () => void;
}
