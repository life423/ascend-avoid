type BrowserEvents = Pick<WebSocket, 'onopen' | 'onmessage' | 'onclose' | 'onerror'>;

/** Browser build of Colyseus's transport. Never probe native WebSocket with Node-only options. */
export class WebSocketTransport {
  ws!: WebSocket;
  protocols?: string | string[];
  constructor(public events: Partial<BrowserEvents>) {}
  connect(url: string): void {
    this.ws = this.protocols ? new WebSocket(url, this.protocols) : new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = this.events.onopen ?? null;
    this.ws.onmessage = this.events.onmessage ?? null;
    this.ws.onclose = this.events.onclose ?? null;
    this.ws.onerror = this.events.onerror ?? null;
  }
  send(data: ArrayBuffer | number[]): void { this.ws.send(Array.isArray(data) ? new Uint8Array(data).buffer : data); }
  close(code?: number, reason?: string): void { this.ws.close(code, reason); }
  get isOpen(): boolean { return this.ws.readyState === WebSocket.OPEN; }
}
