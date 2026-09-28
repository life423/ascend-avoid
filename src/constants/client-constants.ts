// Game event types for EventBus
export const GameEvents = {
    // Connection events
    MULTIPLAYER_CONNECTED: 'multiplayer:connected',
    MULTIPLAYER_DISCONNECTED: 'multiplayer:disconnected',
    MULTIPLAYER_ERROR: 'multiplayer:error',
    MULTIPLAYER_STATE_UPDATE: 'multiplayer:stateUpdate',
    
    // Player events
    PLAYER_JOINED: 'player:joined',
    PLAYER_LEFT: 'player:left',
    PLAYER_INPUT: 'player:input',
    PLAYER_UPDATE: 'player:update',
    
    // Game events
    GAME_START: 'game:start',
    GAME_OVER: 'game:over',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    
    // UI events
    UI_SHOW_MENU: 'ui:showMenu',
    UI_HIDE_MENU: 'ui:hideMenu',
    UI_SHOW_LOBBY: 'ui:showLobby',
    UI_HIDE_LOBBY: 'ui:hideLobby',
} as const;

// Type for GameEvents values
export type GameEventType = typeof GameEvents[keyof typeof GameEvents];
