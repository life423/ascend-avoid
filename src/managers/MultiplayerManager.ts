import type { PracticeLesson } from '../../server/practice/definitions';
import { Client, Room } from 'colyseus.js';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../constants/client-constants';
import { GAME } from '../../server/constants/gameConstants';
import { NAME_EVENT, playerName } from '../core/PlayerName';

export type OnlineSession = { kind: 'play'; spectator?: boolean } | { kind: 'practice'; lesson: PracticeLesson; token: string; sequence?: boolean };

export class MultiplayerManager {
    private generation = 0;
    private disposed = false;
    private reconnectionToken = '';
    private client: Client | null = null;
    private room: Room | null = null;
    private eventBus: EventBus;
    private connecting: Promise<boolean> | null = null;
    /** Round trip to the server in ms, measured every couple of seconds (0 until the first reply) */
    roundTripMs: number = 0;
    private pingTimer: ReturnType<typeof setInterval> | null = null;

    constructor(eventBus: EventBus, readonly session: OnlineSession = { kind: 'play' }) {
        this.eventBus = eventBus;
    }

    /**
     * Get WebSocket URL based on environment
     */
    private getWebSocketUrl(): string {
        // Check if we're in production (built version)
        // Use a more reliable way to detect production
        const isProd = process.env.NODE_ENV === 'production' || 
                      (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD);
        
        if (isProd) {
            // In production, use same origin as the page
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            console.log(`Production WebSocket URL: ${protocol}//${host}`);
            return `${protocol}//${host}`;
        } else {
            // In development, use localhost:3000
            console.log('Development WebSocket URL: ws://localhost:3000');
            return 'ws://localhost:3000';
        }
    }

    connect(): Promise<boolean> {
        if (this.connecting) return this.connecting;
        if (this.disposed || this.room) return Promise.resolve(this.isConnected());
        this.connecting = this.openRoom().finally(() => { this.connecting = null; });
        return this.connecting;
    }

    /** A late connection is left immediately, even after an exit or a timeout. */
    private async openRoom(): Promise<boolean> {
        const generation = ++this.generation;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        try {
            const client = new Client(this.getWebSocketUrl());
            this.client = client;
            const join = this.session.kind === 'practice'
                ? (this.reconnectionToken ? client.reconnect(this.reconnectionToken) : client.create('tutorial_room', { name: this.getPlayerName(), token: this.session.token, lesson: this.session.lesson, sequence: this.session.sequence }))
                : client.joinOrCreate(GAME.ROOM_NAME, this.session.spectator ? { spectator: true } : { name: this.getPlayerName() });
            const accepted = join.then(room => {
                if (generation !== this.generation || this.disposed) { void room.leave(); throw new Error('Obsolete connection'); }
                return room;
            });
            const room = await Promise.race([accepted, new Promise<never>((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Connection timed out')), 10000);
            })]);
            if (generation !== this.generation || this.disposed) { void room.leave(); return false; }
            this.room = room;
            this.reconnectionToken = room.reconnectionToken;
            this.setupRoomHandlers();
            this.eventBus.emit(GameEvents.MULTIPLAYER_CONNECTED, { roomId: room.id, sessionId: room.sessionId });
            return true;
        } catch (error) {
            if (generation !== this.generation || this.disposed) return false;
            this.generation++; // Invalidates a successful response arriving after the timeout.
            // An expired private reconnection may create a new private lesson, never a live room.
            this.reconnectionToken = '';
            this.eventBus.emit(GameEvents.MULTIPLAYER_ERROR, { type: 'connection', message: error instanceof Error ? error.message : 'Connection failed' });
            return false;
        } finally {
            if (timeout) clearTimeout(timeout);
        }
    }

    /** Spawn in the room already being watched, and wait for the server's player record. */
    async joinArena(name: string): Promise<boolean> {
        if (this.session.kind !== 'play' || !await this.connect()) return false;
        const room = this.room;
        if (!room || this.disposed) return false;
        if (this.getLocalPlayer()) {
            this.session.spectator = false;
            return true;
        }
        const joined = await new Promise<boolean>(resolve => {
            const finish = (ok: boolean) => {
                clearTimeout(timer);
                room.onStateChange.remove(check);
                room.onLeave.remove(left);
                removeResult();
                resolve(ok);
            };
            const check = () => { if (room.state?.players?.has(room.sessionId)) finish(true); };
            const left = () => finish(false);
            const timer = setTimeout(left, 8000);
            const removeResult = room.onMessage('joinArenaResult', (result: { ok: boolean }) => { if (!result.ok) left(); });
            room.onStateChange(check);
            room.onLeave(left);
            try { room.send('joinArena', { name }); } catch { left(); }
        });
        if (joined && !this.disposed) this.session.spectator = false;
        return joined && !this.disposed;
    }

    /**
     * Set up room event handlers
     */
    private setupRoomHandlers(): void {
        window.removeEventListener(NAME_EVENT, this.onNameChange);
        window.addEventListener(NAME_EVENT, this.onNameChange);
        if (!this.room) {
            console.error('❌ Cannot setup room handlers - no room instance');
            return;
        }

        const room = this.room;
        const current = () => this.room === room && !this.disposed;
        const onMessage = (type: string, handler: (data: any) => void) => room.onMessage(type, data => { if (current()) handler(data); });

        // Handle state changes
        this.room.onStateChange((state) => {
            if (!current()) return;
            this.eventBus.emit(GameEvents.MULTIPLAYER_STATE_UPDATE, state);
        });

        // Handle messages from server
        onMessage('playerJoined', (data) => {
            console.log('Player joined:', data);
            this.eventBus.emit(GameEvents.PLAYER_JOINED, data);
        });

        onMessage('playerLeft', (data) => {
            console.log('Player left:', data);
            this.eventBus.emit(GameEvents.PLAYER_LEFT, data);
        });

        onMessage('pong', (data: any) => {
            const sample = performance.now() - Number(data?.t);
            if (!(sample >= 0 && sample < 5000)) return;
            this.roundTripMs = this.roundTripMs === 0 ? sample : this.roundTripMs * 0.7 + sample * 0.3;
        });
        this.startPinging();

        for (const type of ['capture', 'partCollected', 'weaponAssembled', 'weaponPlaced', 'gustHit']) onMessage(type, () => {});

        // Moments worth showing everyone: who shoved whom off the edge, who took the jackpot
        onMessage('combatReward', (data) => this.eventBus.emit('multiplayer:combatReward', data));
        onMessage('credit', (data) => this.eventBus.emit('multiplayer:credit', data));
        onMessage('weaponTheft', (data) => this.eventBus.emit('multiplayer:weaponTheft', data));
        onMessage('jackpot', (data) => this.eventBus.emit('multiplayer:jackpot', data));
        onMessage('burst', (data) => this.eventBus.emit('multiplayer:burst', data));
        onMessage('impact', (data) => this.eventBus.emit('multiplayer:impact', data));
        onMessage('launch', (data) => this.eventBus.emit('multiplayer:launch', data));
        onMessage('loadedTurnStopped', (data) => this.eventBus.emit('multiplayer:loadedTurnStopped', data));
        onMessage('parry', (data) => this.eventBus.emit('multiplayer:parry', data));
        onMessage('surge', (data) => this.eventBus.emit('multiplayer:surge', data));
        onMessage('blast', (data) => this.eventBus.emit('multiplayer:blast', data));
        onMessage('exhale', (data) => this.eventBus.emit('multiplayer:exhale', data));
        onMessage('wallSlip', (data) => this.eventBus.emit('multiplayer:wallSlip', data));


        // Handle errors
        this.room.onError((code, message) => {
            if (!current()) return;
            console.error('Room error:', code, message);
            this.eventBus.emit(GameEvents.MULTIPLAYER_ERROR, {
                type: 'room',
                code,
                message
            });
        });

        // Handle disconnect
        this.room.onLeave((code) => {
            if (!current()) return;
            this.stopPinging();
            this.room = null;
            console.log('Left room:', code);
            this.eventBus.emit(GameEvents.MULTIPLAYER_DISCONNECTED, { code });
            this.room = null;
            this.client = null;
        });
    }

    /**
     * Send custom message to server
     */
    sendMessage(type: string, data: any): void {
        if (!this.room) {
            console.warn('Not connected to room');
            return;
        }

        if (this.session.kind === 'practice') {
            if (type === 'practice:lesson' && data?.lesson) { this.session.lesson = data.lesson; this.session.sequence = false; }
            if (type === 'practice:start') { this.session.lesson = 'basics'; this.session.sequence = true; }
        }
        this.room.send(type, data);
    }

    /**
     * Get local player data
     */
    getLocalPlayer(): any {
        if (!this.room || !this.room.state) {
            return null;
        }
        
        // Return the player with our session ID
        const players = this.room.state.players;
        if (players && this.room.sessionId) {
            return players.get(this.room.sessionId);
        }
        
        return null;
    }

    /**
     * Disconnect from server
     */
    /** Time the round trip to the server now and every couple of seconds */
    private startPinging(): void {
        this.stopPinging();
        const ping = () => this.room?.send('ping', { t: performance.now() });
        ping();
        this.pingTimer = setInterval(ping, 2000);
    }

    private stopPinging(): void {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
    }

    disconnect(): void {
        this.disposed = true; this.generation++;
        window.removeEventListener(NAME_EVENT, this.onNameChange);
        this.stopPinging();
        if (this.room) {
            const old = this.room; this.room = null;
            void old.leave();
        }
        
        if (this.client) {
            this.client = null;
        }
        
        this.reconnectionToken = '';
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.room !== null && this.room.connection.isOpen;
    }

    /**
     * Get current room
     */
    getRoom(): Room | null {
        return this.room;
    }

    /** The name you play under (kept on this device; see PlayerName) */
    private getPlayerName(): string {
        return playerName();
    }

    /** The synchronized game state from the server, or null when not connected */
    getState(): any {
        return this.room ? this.room.state : null;
    }

    /** This client's session id in the room, or null when not connected */
    get localSessionId(): string | null {
        return this.room ? this.room.sessionId : null;
    }

    /** You picked a new name (in the drawer, say): everyone sees it right away */
    private onNameChange = (event: Event): void => {
        const name = (event as CustomEvent<string>).detail;
        if (this.room && name && this.getLocalPlayer()) this.room.send('updateName', { name });
    };
}
