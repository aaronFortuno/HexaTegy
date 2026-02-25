/**
 * RelayClient — connexió WebSocket al servidor relay.
 * Usada tant per l'admin com pels jugadors.
 */
import { MsgType } from "./protocol.js";
export class RelayClient {
    ws = null;
    handlers = new Map();
    reconnectTimer = null;
    url;
    clientId = null;
    roomCode = null;
    constructor(url) {
        this.url = url;
    }
    connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.url);
            this.ws.onopen = () => resolve();
            this.ws.onmessage = (event) => {
                let msg;
                try {
                    msg = JSON.parse(event.data);
                }
                catch {
                    return;
                }
                this.dispatch(msg);
            };
            this.ws.onerror = () => reject(new Error("No s'ha pogut connectar al relay"));
            this.ws.onclose = () => {
                this.dispatch({ type: MsgType.RELAY_ERROR, payload: { message: "Connexió tancada" } });
            };
        });
    }
    send(type, payload = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn("[relay-client] WebSocket no disponible");
            return;
        }
        this.ws.send(JSON.stringify({ type, payload }));
        // El relay exclou el remitent del broadcast, per tant el fem arribar
        // localment igual que LocalRelay fa amb dispatch(). Així l'admin rep
        // els seus propis GAME_STATE, ROUND_START, etc.
        const msg = {
            type,
            from: this.clientId ?? undefined,
            payload: payload,
        };
        this.dispatch(msg);
    }
    on(type, handler) {
        if (!this.handlers.has(type))
            this.handlers.set(type, new Set());
        this.handlers.get(type).add(handler);
        return () => this.handlers.get(type)?.delete(handler);
    }
    dispatch(msg) {
        this.handlers.get(msg.type)?.forEach((h) => h(msg));
        this.handlers.get("*")?.forEach((h) => h(msg));
    }
    createRoom() {
        this.send(MsgType.ROOM_CREATE);
    }
    joinRoom(roomCode, name) {
        this.send(MsgType.ROOM_JOIN, { roomCode, name });
    }
    disconnect() {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        this.ws?.close();
        this.ws = null;
    }
}
