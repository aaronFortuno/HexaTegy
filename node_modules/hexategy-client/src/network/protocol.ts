/**
 * Protocol de missatges WebSocket de HexaTegy.
 *
 * Totes les comunicacions entre clients i relay segueixen aquest esquema:
 *   { type: MessageType, from?: string, payload: {...} }
 */

// ─── Tipus de missatge ────────────────────────────────────────────────────────

export const MsgType = {
  // Relay → client
  ROOM_CREATED:    "room:created",
  ROOM_JOINED:     "room:joined",
  RELAY_ERROR:     "relay:error",

  // Client → relay
  ROOM_CREATE:     "room:create",
  ROOM_JOIN:       "room:join",

  // Admin → jugadors (via relay broadcast)
  GAME_STATE:      "game:state",
  ROUND_START:     "round:start",
  ROUND_RESOLVE:   "round:resolve",
  GAME_OVER:       "game:over",
  PLAYER_JOINED:   "player:joined",
  PLAYER_LEFT:     "player:left",

  // Jugadors → admin (via relay broadcast)
  PLAYER_READY:    "player:ready",
  PLAYER_ORDERS:   "player:orders",
  PLAYER_CANCEL:   "player:cancel",

  // Admin → jugador específic (expulsió)
  PLAYER_KICK:     "player:kick",
} as const;

export type MsgType = (typeof MsgType)[keyof typeof MsgType];

// ─── Interfícies de payload ───────────────────────────────────────────────────

export interface HexCoord {
  q: number; // coordenada axial columna
  r: number; // coordenada axial fila
}

export interface Region {
  id: string;
  coord: HexCoord;
  ownerId: string | null; // null = neutral
  troops: number;
  neighbors: string[]; // ids de regions adjacents
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: string;
  isAdmin: boolean;
  isReady: boolean;
  isEliminated: boolean;
}

export interface GameConfig {
  roundDuration: number;       // segons per ronda (5–30)
  maxRounds: number | null;    // null = sense límit
  baseProduction: number;      // tropes base per ronda
  productionPerNeighbor: number;
  bonusAfterRounds: number;    // rondes continues per bonus
  bonusTroops: number;
  defenseAdvantage: number;    // 0.0–1.0, favorable al defensor
  victoryCondition: VictoryCondition;
  victoryParam: number;        // % mapa, rondes, punts... segons condició
  startPlacement: "random" | "clustered";
  startRegions: number;        // regions inicials per jugador (1–5)
  visibilityMode: VisibilityMode;
  mapSize: number;             // radi del grid hexagonal (3–8), default 5
  mapShape: MapShape;          // forma del tauler (ara únicament "hexagon")
}

export type VictoryCondition =
  | "total_conquest"
  | "score_rounds"
  | "map_percent"
  | "hill_control";

export type VisibilityMode =
  | "full"        // Tots els jugadors veuen tot el tauler en temps real
  | "fog_of_war"  // Veus totes les regions amb propietari, però les tropes enemigues estan ocultes
  | "fog_strict"; // Boira estricta: únicament les teves regions i les adjacents directes

export type MapShape =
  | "hexagon"    // Hexàgon regular (implementat)
  | "rectangle"  // Requadre (reservat per a versions futures)
  | "triangle";  // Triangle (reservat per a versions futures)

export interface MoveOrder {
  fromRegionId: string;
  toRegionId: string;
  troops: number; // tropes assignades a aquest moviment
}

export interface RoundResult {
  round: number;
  regionDeltas: Array<{
    regionId: string;
    newOwnerId: string | null;
    newTroops: number;
    attackers: Array<{ playerId: string; troops: number }>;
  }>;
  eliminated: string[]; // playerIds eliminats aquesta ronda
  winner: string | null; // playerId guanyador, null si continua
}

// ─── Missatges tipats ─────────────────────────────────────────────────────────

export interface WsMessage<T = unknown> {
  type: MsgType;
  from?: string;
  payload: T;
}

export type GameStatePayload = {
  players: PlayerInfo[];
  regions: Region[];
  config: GameConfig;
  round: number;
  phase: GamePhase;
};

export type GamePhase = "lobby" | "planning" | "resolving" | "ended";

export const DEFAULT_CONFIG: GameConfig = {
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
