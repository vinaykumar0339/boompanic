export type SignalingPayload = { version: 1; kind: 'offer' | 'answer'; sdp: { type: 'offer' | 'answer'; sdp: string }; createdAt: number };

export function encodeSignal(payload: SignalingPayload) { return encodeURIComponent(JSON.stringify(payload)); }

export function decodeSignal(value: string): SignalingPayload | null {
  try {
    const decoded: unknown = JSON.parse(decodeURIComponent(value.trim()));
    if (!decoded || typeof decoded !== 'object') return null;
    const candidate = decoded as Partial<SignalingPayload>;
    return candidate.version === 1 && (candidate.kind === 'offer' || candidate.kind === 'answer') &&
      !!candidate.sdp && (candidate.sdp.type === 'offer' || candidate.sdp.type === 'answer') && typeof candidate.sdp.sdp === 'string'
      ? candidate as SignalingPayload : null;
  } catch { return null; }
}
