/**
 * Protocol de missatges WebSocket de HexaTegy.
 *
 * Totes les comunicacions entre clients i relay segueixen aquest esquema:
 *   { type: MessageType, from?: string, payload: {...} }
 */
// ─── Tipus de missatge ────────────────────────────────────────────────────────
export const MsgType = {
    // Relay → client
    ROOM_CREATED: "room:created",
    ROOM_JOINED: "room:joined",
    RELAY_ERROR: "relay:error",
    // Client → relay
    ROOM_CREATE: "room:create",
    ROOM_JOIN: "room:join",
    // Admin → jugadors (via relay broadcast)
    GAME_STATE: "game:state",
    ROUND_START: "round:start",
    ROUND_RESOLVE: "round:resolve",
    GAME_OVER: "game:over",
    PLAYER_JOINED: "player:joined",
    PLAYER_LEFT: "player:left",
    // Jugadors → admin (via relay broadcast)
    PLAYER_READY: "player:ready",
    PLAYER_ORDERS: "player:orders",
    PLAYER_CANCEL: "player:cancel",
    // Admin → jugador específic (expulsió)
    PLAYER_KICK: "player:kick",
};
export const DEFAULT_CONFIG = {
    roundDuration: 20,
    maxRounds: null,
    baseProduction: 2,
    productionPerNeighbor: 1,
    bonusAfterRounds: 3,
    bonusTroops: 3,
    defenseAdvantage: 0.55,
    victoryCondition: "total_conquest",
    victoryParam: 100,
    startPlacement: "random",
    startRegions: 1,
    visibilityMode: "full",
    mapSize: 5,
    mapShape: "hexagon",
};
