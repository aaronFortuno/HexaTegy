/**
 * Màquina d'estats del joc (vista del client).
 *
 * Gestiona les transicions de fase i manté l'estat local
 * sincronitzat amb el que difon l'admin.
 */

import type { RelayClient } from "../network/relay-client.js";
import type { LocalRelay } from "../network/local-relay.js";
type AnyRelay = RelayClient | LocalRelay;
import { MsgType, GameStatePayload, GamePhase,
         Region, PlayerInfo, GameConfig, MoveOrder, RoundResult } from "../network/protocol.js";

export type GameEventType =
  | "state:updated"
  | "round:started"
  | "round:resolved"
  | "game:over";

type GameListener = (data: unknown) => void;

export class GameClient {
  readonly relay: AnyRelay;

  // Estat local (sincronitzat amb l'admin)
  players: PlayerInfo[] = [];
  regions: Region[] = [];
  config: GameConfig | null = null;
  round = 0;
  phase: GamePhase = "lobby";
  winnerId: string | null = null;

  // Ordres planificades localment (no enviades encara)
  localOrders: MoveOrder[] = [];

  private listeners = new Map<GameEventType, Set<GameListener>>();

  constructor(relay: AnyRelay) {
    this.relay = relay;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.relay.on(MsgType.GAME_STATE, (msg) => {
      const state = msg.payload as GameStatePayload;
      this.players = state.players;
      this.regions = state.regions;
      this.config = state.config;
      this.round = state.round;
      this.phase = state.phase;
      this.emit("state:updated", state);
    });

    this.relay.on(MsgType.ROUND_START, (msg) => {
      const { round, duration } = msg.payload as { round: number; duration: number };
      this.round = round;
      this.phase = "planning";
      this.localOrders = [];
      this.emit("round:started", { round, duration });
    });

    this.relay.on(MsgType.ROUND_RESOLVE, (msg) => {
      const result = msg.payload as RoundResult;
      this.phase = "resolving";
      this.emit("round:resolved", result);
    });

    this.relay.on(MsgType.GAME_OVER, (msg) => {
      const { winnerId } = msg.payload as { winnerId: string };
      this.winnerId = winnerId;
      this.phase = "ended";
      this.emit("game:over", { winnerId });
    });
  }

  // ─── Ordres del jugador ───────────────────────────────────────────────────

  addOrder(order: MoveOrder): void {
    // Eliminar ordre existent per la mateixa parella origen-destí
    this.localOrders = this.localOrders.filter(
      (o) => !(o.fromRegionId === order.fromRegionId && o.toRegionId === order.toRegionId)
    );
    this.localOrders.push(order);
  }

  removeOrder(fromRegionId: string, toRegionId: string): void {
    this.localOrders = this.localOrders.filter(
      (o) => !(o.fromRegionId === fromRegionId && o.toRegionId === toRegionId)
    );
    this.relay.send(MsgType.PLAYER_CANCEL, { fromRegionId, toRegionId });
  }

  submitOrders(): void {
    this.relay.send(MsgType.PLAYER_ORDERS, {
      orders: this.localOrders as unknown as Record<string, unknown>[],
    });
  }

  setReady(): void {
    this.relay.send(MsgType.PLAYER_READY, {});
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  regionById(id: string): Region | undefined {
    return this.regions.find((r) => r.id === id);
  }

  playerById(id: string): PlayerInfo | undefined {
    return this.players.find((p) => p.id === id);
  }

  myId(): string | null {
    return this.relay.clientId;
  }

  // ─── Esdeveniments ────────────────────────────────────────────────────────

  on(event: GameEventType, listener: GameListener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit(event: GameEventType, data: unknown): void {
    this.listeners.get(event)?.forEach((l) => l(data));
  }
}
