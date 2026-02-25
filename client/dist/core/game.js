/**
 * Màquina d'estats del joc (vista del client).
 *
 * Gestiona les transicions de fase i manté l'estat local
 * sincronitzat amb el que difon l'admin.
 */
import { MsgType } from "../network/protocol.js";
export class GameClient {
    relay;
    // Estat local (sincronitzat amb l'admin)
    players = [];
    regions = [];
    config = null;
    round = 0;
    phase = "lobby";
    winnerId = null;
    // Ordres planificades localment (no enviades encara)
    localOrders = [];
    listeners = new Map();
    constructor(relay) {
        this.relay = relay;
        this.setupListeners();
    }
    setupListeners() {
        this.relay.on(MsgType.GAME_STATE, (msg) => {
            const state = msg.payload;
            this.players = state.players;
            this.regions = state.regions;
            this.config = state.config;
            this.round = state.round;
            this.phase = state.phase;
            this.emit("state:updated", state);
        });
        this.relay.on(MsgType.ROUND_START, (msg) => {
            const { round, duration } = msg.payload;
            this.round = round;
            this.phase = "planning";
            this.localOrders = [];
            this.emit("round:started", { round, duration });
        });
        this.relay.on(MsgType.ROUND_RESOLVE, (msg) => {
            const result = msg.payload;
            this.phase = "resolving";
            this.emit("round:resolved", result);
        });
        this.relay.on(MsgType.GAME_OVER, (msg) => {
            const { winnerId } = msg.payload;
            this.winnerId = winnerId;
            this.phase = "ended";
            this.emit("game:over", { winnerId });
        });
    }
    // ─── Ordres del jugador ───────────────────────────────────────────────────
    addOrder(order) {
        // Eliminar ordre existent per la mateixa parella origen-destí
        this.localOrders = this.localOrders.filter((o) => !(o.fromRegionId === order.fromRegionId && o.toRegionId === order.toRegionId));
        this.localOrders.push(order);
    }
    removeOrder(fromRegionId, toRegionId) {
        this.localOrders = this.localOrders.filter((o) => !(o.fromRegionId === fromRegionId && o.toRegionId === toRegionId));
        this.relay.send(MsgType.PLAYER_CANCEL, { fromRegionId, toRegionId });
    }
    submitOrders() {
        this.relay.send(MsgType.PLAYER_ORDERS, {
            orders: this.localOrders,
        });
    }
    setReady() {
        this.relay.send(MsgType.PLAYER_READY, {});
    }
    // ─── Helpers ─────────────────────────────────────────────────────────────
    regionById(id) {
        return this.regions.find((r) => r.id === id);
    }
    playerById(id) {
        return this.players.find((p) => p.id === id);
    }
    myId() {
        return this.relay.clientId;
    }
    // ─── Esdeveniments ────────────────────────────────────────────────────────
    on(event, listener) {
        if (!this.listeners.has(event))
            this.listeners.set(event, new Set());
        this.listeners.get(event).add(listener);
        return () => this.listeners.get(event)?.delete(listener);
    }
    emit(event, data) {
        this.listeners.get(event)?.forEach((l) => l(data));
    }
}
