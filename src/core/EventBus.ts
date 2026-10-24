/**
 * Event Bus for decoupled communication between game systems
 * Provides a central event system that allows systems to communicate
 * without direct dependencies on each other.
 */

export interface EventData {
    [key: string]: any;
}

export type EventCallback<T = EventData> = (data: T) => void;

export class EventBus {
    private listeners = new Map<string, Set<EventCallback>>();
    private onceListeners = new Map<string, Set<EventCallback>>();
    private debugMode = false;

    /**
     * Subscribe to an event
     * @param event - Event name to listen for
     * @param callback - Function to call when event is emitted
     * @returns Unsubscribe function
     */
    on<T = EventData>(event: string, callback: EventCallback<T>): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        
        const typedCallback = callback as EventCallback;
        this.listeners.get(event)!.add(typedCallback);
        
        if (this.debugMode) {
            console.log(`EventBus: Listener added for '${event}'`);
        }
        
        // Return unsubscribe function
        return () => this.off(event, typedCallback);
    }

    /**
     * Subscribe to an event, but only fire once
     * @param event - Event name to listen for
     * @param callback - Function to call when event is emitted
     * @returns Unsubscribe function
     */
    once<T = EventData>(event: string, callback: EventCallback<T>): () => void {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }
        
        const typedCallback = callback as EventCallback;
        this.onceListeners.get(event)!.add(typedCallback);
        
        if (this.debugMode) {
            console.log(`EventBus: One-time listener added for '${event}'`);
        }
        
        // Return unsubscribe function
        return () => this.onceListeners.get(event)?.delete(typedCallback);
    }

    /**
     * Unsubscribe from an event
     * @param event - Event name
     * @param callback - Callback function to remove
     */
    off(event: string, callback: EventCallback): void {
        this.listeners.get(event)?.delete(callback);
        this.onceListeners.get(event)?.delete(callback);
        
        if (this.debugMode) {
            console.log(`EventBus: Listener removed for '${event}'`);
        }
    }

    /**
     * Emit an event to all listeners
     * @param event - Event name to emit
     * @param data - Data to pass to listeners
     */
    emit<T = EventData>(event: string, data?: T): void {
        if (this.debugMode) {
            console.log(`EventBus: Emitting '${event}'`, data);
        }

        // Call regular listeners
        const listeners = this.listeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data as EventData);
                } catch (error) {
                    console.error(`EventBus: Error in listener for '${event}':`, error);
                }
            });
        }

        // Call once listeners and remove them
        const onceListeners = this.onceListeners.get(event);
        if (onceListeners) {
            onceListeners.forEach(callback => {
                try {
                    callback(data as EventData);
                } catch (error) {
                    console.error(`EventBus: Error in once-listener for '${event}':`, error);
                }
            });
            // Clear once listeners after calling them
            this.onceListeners.delete(event);
        }
    }

    /**
     * Remove all listeners for a specific event
     * @param event - Event name to clear
     */
    clear(event: string): void {
        this.listeners.delete(event);
        this.onceListeners.delete(event);
        
        if (this.debugMode) {
            console.log(`EventBus: All listeners cleared for '${event}'`);
        }
    }

    /**
     * Remove all listeners for all events
     */
    dispose(): void {
        if (this.debugMode) {
            console.log('EventBus: Disposing all listeners');
        }
        
        this.listeners.clear();
        this.onceListeners.clear();
    }

    /**
     * Get list of events that have listeners
     * @returns Array of event names
     */
    getEvents(): string[] {
        const events = new Set<string>();
        this.listeners.forEach((_, event) => events.add(event));
        this.onceListeners.forEach((_, event) => events.add(event));
        return Array.from(events);
    }

    /**
     * Get number of listeners for an event
     * @param event - Event name
     * @returns Number of listeners
     */
    getListenerCount(event: string): number {
        const regular = this.listeners.get(event)?.size || 0;
        const once = this.onceListeners.get(event)?.size || 0;
        return regular + once;
    }

    /**
     * Enable or disable debug logging
     * @param enabled - Whether to enable debug mode
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }

    /**
     * Create a namespaced event bus for a specific system
     * @param namespace - Namespace prefix for events
     * @returns Namespaced event bus interface
     */
    createNamespace(namespace: string) {
        return {
            on: <T = EventData>(event: string, callback: EventCallback<T>) => 
                this.on(`${namespace}:${event}`, callback),
            
            once: <T = EventData>(event: string, callback: EventCallback<T>) => 
                this.once(`${namespace}:${event}`, callback),
            
            off: (event: string, callback: EventCallback) => 
                this.off(`${namespace}:${event}`, callback),
            
            emit: <T = EventData>(event: string, data?: T) => 
                this.emit(`${namespace}:${event}`, data),
            
            clear: (event: string) => 
                this.clear(`${namespace}:${event}`)
        };
    }
}

// Global event bus instance
export const globalEventBus = new EventBus();

// Common event types for type safety
export interface GameEvents {
    'engine:started': Record<string, never>;
    'engine:stopped': Record<string, never>;
    'engine:paused': Record<string, never>;
    'engine:resumed': Record<string, never>;
    'engine:update': { deltaTime: number; timestamp: number };
    'engine:render': { deltaTime: number; timestamp: number };
    'game:reset': Record<string, never>;
    'game:paused': Record<string, never>;
    'game:resumed': Record<string, never>;
    'game:over': { score: number; reason: string };
    'state:updated': { state: any };
    'system:error': { system: string; error: Error };
    'player:moved': { x: number; y: number };
    'player:shot': { x: number; y: number };
    'collision:detected': { entityA: string; entityB: string };
    'score:updated': { score: number; highScore: number };
}

export default EventBus;
