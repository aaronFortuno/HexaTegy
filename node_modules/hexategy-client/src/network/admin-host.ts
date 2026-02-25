/**
 * AdminHost — lògica exclusiva del navegador administrador.
 *
 * Rep ordres dels jugadors, executa la lògica de joc i difon l'estat.
 * És l'autoritat única de la partida.
 */

import type { RelayClient } from "./relay-client.js";
import type { LocalRelay } from "./local-relay.js";

type AnyRelay = RelayClient | LocalRelay;
import { MsgType, GameConfig, GameStatePayload, GamePhase,
         PlayerInfo, Region, MoveOrder, RoundResult, DEFAULT_CONFIG } from "./protocol.js";
import { generateMap } from "../core/map.js";
import { resolveRound } from "../core/combat.js";
import { applyProduction } from "../core/production.js";
import { checkVictory } from "../core/victory.js";

export class AdminHost {
  private relay: AnyRelay;
  private players: Map<string, PlayerInfo> = new Map();
  private regions: Region[] = [];
  private config: GameConfig = { ...DEFAULT_CONFIG };
  private round = 0;
  private phase: GamePhase = "lobby";
  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingOrders = new Map<string, MoveOrder[]>();

  // Colors assignats als jugadors en ordre d'unió
  private static PLAYER_COLORS = [
    "#e05c5c", "#5c9ee0", "#5ce07a", "#e0c45c",
    "#c45ce0", "#5ce0d4", "#e08c5c", "#a0e05c",
  ];
  private colorIndex = 0;

  constructor(relay: AnyRelay) {
    this.relay = relay;
    this.setupListeners();

    // Pre-afegir l'admin a la llista de jugadors perquè aparegui a la sala
    // d'espera i pugui editar el seu nom com qualsevol altre jugador.
    const adminColor = AdminHost.PLAYER_COLORS[this.colorIndex % AdminHost.PLAYER_COLORS.length];
    this.colorIndex++;
    this.players.set(this.relay.clientId!, {
      id: this.relay.clientId!,
      name: "Admin",
      color: adminColor,
      isAdmin: true,
      isReady: true,
      isEliminated: false,
    });
    this.broadcastState();
  }

  private setupListeners(): void {
    // Nou jugador detectat pel relay
    this.relay.on(MsgType.PLAYER_JOINED, (msg) => {
      const { id, name } = msg.payload as { id: string; name: string };
      if (this.players.has(id)) return;

      const color = AdminHost.PLAYER_COLORS[this.colorIndex % AdminHost.PLAYER_COLORS.length];
      this.colorIndex++;

      const player: PlayerInfo = {
        id, name, color,
        isAdmin: false,
        isReady: false,
        isEliminated: false,
      };
      this.players.set(id, player);
      this.broadcastState();
    });

    this.relay.on(MsgType.PLAYER_LEFT, (msg) => {
      const { id } = msg.payload as { id: string };
      this.players.delete(id);
      this.broadcastState();
    });

    this.relay.on(MsgType.PLAYER_READY, (msg) => {
      const player = this.players.get(msg.from ?? "");
      if (player) { player.isReady = true; this.broadcastState(); }
    });

    this.relay.on(MsgType.PLAYER_ORDERS, (msg) => {
      const { orders } = msg.payload as { orders: MoveOrder[] };
      this.pendingOrders.set(msg.from ?? "", orders);
    });
  }

  // ─── Control de partida ───────────────────────────────────────────────────

  updateConfig(partial: Partial<GameConfig>): void {
    this.config = { ...this.config, ...partial };
    this.broadcastState(); // difondre als clients perquè vegin el canvi en temps real
  }

  kickPlayer(id: string): void {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.relay.send(MsgType.PLAYER_KICK, { id });
    this.broadcastState();
  }

  renamePlayer(id: string, newName: string): void {
    const player = this.players.get(id);
    if (!player) return;
    player.name = newName.trim().slice(0, 20) || player.name;
    this.broadcastState();
  }

  startGame(): void {
    if (this.phase !== "lobby") return;

    // L'admin ja és a this.players des del constructor. Assegurem flags de partida.
    const adminEntry = this.players.get(this.relay.clientId!);
    if (adminEntry) {
      adminEntry.isAdmin = true;
      adminEntry.isReady = true;
    }

    const playerIds = [...this.players.keys()];
    this.regions = generateMap(playerIds, this.config);
    this.startRound();
  }

  // Marge extra (ms) que l'admin espera després que acabi el compte enrere
  // dels jugadors, per donar temps a que les seves ordres arribin via
  // BroadcastChannel / WebSocket abans de cridar resolveRound().
  private static readonly RESOLVE_GRACE_MS = 1000;

  private startRound(skipProductionFor: Set<string> = new Set()): void {
    this.round++;
    this.phase = "planning";
    this.pendingOrders.clear();

    // Les regions recentment conquistades (skipProductionFor) no reben
    // producció el primer torn de control: el jugador no les ha tingut
    // durant tota la fase de planificació anterior.
    applyProduction(this.regions, this.config, skipProductionFor);
    this.broadcastState();

    this.relay.send(MsgType.ROUND_START, {
      round: this.round,
      duration: this.config.roundDuration,
    });

    this.roundTimer = setTimeout(
      () => this.resolveRound(),
      this.config.roundDuration * 1000 + AdminHost.RESOLVE_GRACE_MS,
    );
  }

  private resolveRound(): void {
    if (this.phase !== "planning") return;
    this.phase = "resolving";

    const allOrders = [...this.pendingOrders.entries()].flatMap(
      ([playerId, orders]) => orders.map((o) => ({ ...o, playerId }))
    );

    // Capturar propietaris ABANS de la resolució per detectar canvis
    const ownerBefore = new Map(this.regions.map((r) => [r.id, r.ownerId]));

    const result: RoundResult = resolveRound(this.regions, allOrders, this.config);
    result.round = this.round; // assignar número de ronda correcte

    // Aplicar resultats al mapa
    for (const delta of result.regionDeltas) {
      const region = this.regions.find((r) => r.id === delta.regionId);
      if (region) {
        region.ownerId = delta.newOwnerId;
        region.troops = delta.newTroops;
      }
    }

    // Regions que han canviat de propietari (conquestes noves):
    // no rebran producció al primer torn de control del nou propietari.
    const newlyConquered = new Set(
      this.regions
        .filter((r) => r.ownerId !== null && r.ownerId !== ownerBefore.get(r.id))
        .map((r) => r.id)
    );

    // Marcar eliminats
    for (const playerId of result.eliminated) {
      const p = this.players.get(playerId);
      if (p) p.isEliminated = true;
    }

    this.relay.send(MsgType.ROUND_RESOLVE, result as unknown as Record<string, unknown>);

    // Comprovar victòria
    const winner = checkVictory(this.regions, [...this.players.values()], this.config, this.round);
    if (winner) {
      this.phase = "ended";
      this.relay.send(MsgType.GAME_OVER, { winnerId: winner, round: this.round });
      return;
    }

    // Pausa breu per animació i nova ronda
    setTimeout(() => this.startRound(newlyConquered), 2500);
  }

  private broadcastState(): void {
    const payload: GameStatePayload = {
      players: [...this.players.values()],
      regions: this.regions,
      config: this.config,
      round: this.round,
      phase: this.phase,
    };
    this.relay.send(MsgType.GAME_STATE, payload as unknown);
  }

  /** Reenviar l'estat actual a tots els listeners (útil quan el GameClient admin
   *  s'inicialitza DESPRÉS que AdminHost ja hagi difós el primer GAME_STATE). */
  syncState(): void {
    this.broadcastState();
  }

  destroy(): void {
    if (this.roundTimer) clearTimeout(this.roundTimer);
  }
}
