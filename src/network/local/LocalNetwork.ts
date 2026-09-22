import TcpSocket from 'react-native-tcp-socket';
import type Server from 'react-native-tcp-socket/lib/types/Server';
import type Socket from 'react-native-tcp-socket/lib/types/Socket';

import { decodeGameMessage, type GameMessage } from '../GameProtocol';
import type { ConnectionState, GameNetwork } from '../GameNetwork';

const MAX_FRAME_BYTES = 16_384;

/** TCP transport only. It knows nothing about game rules or screen state. */
export class LocalNetwork implements GameNetwork {
  private server: Server | null = null;
  private socket: Socket | null = null;
  private state: ConnectionState = 'IDLE';
  private incoming = '';
  private readonly messageListeners = new Set<(message: GameMessage) => void>();
  private readonly stateListeners = new Set<(state: ConnectionState, detail?: string) => void>();

  constructor(private readonly role: 'host' | 'client', private readonly endpoint?: { host: string; port: number }) {}

  async connect(): Promise<void> {
    if (this.role === 'host') return this.startHost();
    return this.startClient();
  }

  private setState(state: ConnectionState, detail?: string) {
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state, detail));
  }

  private startHost(): Promise<void> {
    this.setState('CREATING');
    return new Promise((resolve, reject) => {
      const server = TcpSocket.createServer((socket) => {
        if (this.socket) { socket.destroy(); return; }
        this.attachSocket(socket);
        this.setState('CONNECTED');
      });
      this.server = server;
      server.once('error', (error) => { this.setState('FAILED', error.message); reject(error); });
      server.listen({ port: this.endpoint?.port ?? 45454, host: '0.0.0.0', reuseAddress: true }, () => {
        this.setState('WAITING');
        resolve();
      });
    });
  }

  private startClient(): Promise<void> {
    if (!this.endpoint) return Promise.reject(new Error('A host address is required.'));
    const endpoint = this.endpoint;
    this.setState('CONNECTING');
    return new Promise((resolve, reject) => {
      const socket = TcpSocket.createConnection({ host: endpoint.host, port: endpoint.port, connectTimeout: 10_000 }, () => {
        this.attachSocket(socket);
        this.setState('CONNECTED');
        resolve();
      });
      socket.once('error', (error: Error) => { this.setState('FAILED', error.message); reject(error); });
    });
  }

  private attachSocket(socket: Socket) {
    this.socket = socket;
    socket.setNoDelay(true);
    socket.setKeepAlive(true);
    socket.setEncoding('utf8');
    socket.on('data', (part: string | Uint8Array) => this.read(String(part)));
    socket.on('close', () => { this.socket = null; this.setState('DISCONNECTED', 'Peer disconnected.'); });
    socket.on('error', (error: Error) => this.setState('FAILED', error.message));
  }

  private read(part: string) {
    this.incoming += part;
    if (this.incoming.length > MAX_FRAME_BYTES) { this.socket?.destroy(); return; }
    let end = this.incoming.indexOf('\n');
    while (end >= 0) {
      const raw = this.incoming.slice(0, end);
      this.incoming = this.incoming.slice(end + 1);
      const parsed = decodeGameMessage(raw);
      if (parsed) this.messageListeners.forEach((listener) => listener(parsed));
      end = this.incoming.indexOf('\n');
    }
  }

  async send(value: GameMessage): Promise<void> {
    if (!this.socket || this.state !== 'CONNECTED') throw new Error('No peer is connected.');
    const frame = `${JSON.stringify(value)}\n`;
    if (frame.length > MAX_FRAME_BYTES) throw new Error('Message too large.');
    this.socket.write(frame);
  }

  onMessage(callback: (message: GameMessage) => void) { this.messageListeners.add(callback); return () => this.messageListeners.delete(callback); }
  onConnectionStateChange(callback: (state: ConnectionState, detail?: string) => void) { this.stateListeners.add(callback); callback(this.state); return () => this.stateListeners.delete(callback); }

  async disconnect() {
    this.socket?.destroy(); this.socket = null;
    if (this.server?.listening) this.server.close();
    this.server = null;
    this.setState('DISCONNECTED');
  }
}
