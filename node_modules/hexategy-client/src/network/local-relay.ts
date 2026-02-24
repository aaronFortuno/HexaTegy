/**
 * LocalRelay — relay simulat via BroadcastChannel.
 *
 * Permet jugar en múltiples pestanyes del mateix navegador sense cap servidor.
 * Implementa la mateixa interfície que RelayClient.
 *
 * Canals BroadcastChannel usats:
 *   hexategy:{codi}:to-admin    — jugadors → admin
 *   hexategy:{codi}:from-admin  — admin → jugadors (broadcast)
 *   hexategy:{codi}:to-{id}     — admin → jugador específic (1 missatge)
 */

import { MsgType, WsMessage } from "./protocol.js";

type MessageHandler = (msg: WsMessage) => void;

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function genCode(): string {
  return [
    Math.random().toString(36).slice(2, 5).toUpperCase(),
    Math.random().toString(36).slice(2, 5).toUpperCase(),
  ].join("-");
}

export class LocalRelay {
  clientId: string = genId();
  roomCode: string | null = null;

  private isAdmin = false;
  private handlers = new Map<string, Set<MessageHandler>>();

  // Canal on l'admin escolta missatges dels jugadors
  private toAdminCh: BroadcastChannel | null = null;
  // Canal de difusió admin → tots els jugadors
  private fromAdminCh: BroadcastChannel | null = null;

  connect(): Promise<void> {
    // BroadcastChannel no necessita connexió
    return Promise.resolve();
  }

  createRoom(): void {
    this.isAdmin = true;
    const code = genCode();
    this.roomCode = code;

    // L'admin escolta peticions de jugadors
    this.toAdminCh = new BroadcastChannel(`hexategy:${code}:to-admin`);
    this.toAdminCh.onmessage = (e: MessageEvent) =>
      this.handleIncomingAsAdmin(e.data as WsMessage);

    // Canal de difusió per enviar a tots els jugadors
    this.fromAdminCh = new BroadcastChannel(`hexategy:${code}:from-admin`);

    // Confirmar creació de sala a l'admin (dispatch local sincrón)
    this.dispatch({
      type: MsgType.ROOM_CREATED,
      payload: { roomCode: code, clientId: this.clientId },
    });
  }

  joinRoom(roomCode: string, name: string): void {
    this.isAdmin = false;
    this.roomCode = roomCode;

    // Escolta difusions de l'admin
    this.fromAdminCh = new BroadcastChannel(`hexategy:${roomCode}:from-admin`);
    this.fromAdminCh.onmessage = (e: MessageEvent) =>
      this.dispatch(e.data as WsMessage);

    // Canal privat per rebre la confirmació de l'admin (room:joined)
    const privateCh = new BroadcastChannel(
      `hexategy:${roomCode}:to-${this.clientId}`
    );
    privateCh.onmessage = (e: MessageEvent) => {
      this.dispatch(e.data as WsMessage);
      privateCh.close();
    };

    // Enviar petició d'unió a l'admin
    const toAdmin = new BroadcastChannel(`hexategy:${roomCode}:to-admin`);
    toAdmin.postMessage({
      type: MsgType.ROOM_JOIN,
      from: this.clientId,
      payload: { roomCode, name, clientId: this.clientId },
    });
    toAdmin.close();
  }

  /**
   * Enviar un missatge.
   * - Admin: difon a tots els jugadors I es notifica a si mateix.
   * - Jugador: envia a l'admin.
   */
  send(type: MsgType, payload: unknown = {}): void {
    const msg: WsMessage = {
      type,
      from: this.clientId,
      payload: payload as Record<string, unknown>,
    };

    if (this.isAdmin) {
      // Difondre als jugadors de les altres pestanyes
      this.fromAdminCh?.postMessage(msg);
      // L'admin es notifica a si mateix perquè el seu propi GameClient
      // rebi les actualitzacions d'estat
      this.dispatch(msg);
    } else {
      if (!this.roomCode) return;
      const ch = new BroadcastChannel(`hexategy:${this.roomCode}:to-admin`);
      ch.postMessage(msg);
      ch.close();
    }
  }

  on(type: MsgType | "*", handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  disconnect(): void {
    this.toAdminCh?.close();
    this.fromAdminCh?.close();
  }

  // ─── Gestió de missatges entrants a l'admin ───────────────────────────────

  private handleIncomingAsAdmin(msg: WsMessage): void {
    // Cas especial: protocol d'unió a sala
    if (msg.type === MsgType.ROOM_JOIN) {
      const { name, clientId } = msg.payload as {
        name: string;
        clientId: string;
      };

      // Confirmar al jugador específic via canal privat
      const playerCh = new BroadcastChannel(
        `hexategy:${this.roomCode}:to-${clientId}`
      );
      playerCh.postMessage({
        type: MsgType.ROOM_JOINED,
        payload: { roomCode: this.roomCode, clientId },
      });
      playerCh.close();

      // Notificar a tothom (inclòs l'admin a si mateix) que s'ha unit un jugador
      const joinedMsg: WsMessage = {
        type: MsgType.PLAYER_JOINED,
        payload: { id: clientId, name },
      };
      this.fromAdminCh?.postMessage(joinedMsg); // altres pestanyes
      this.dispatch(joinedMsg);                 // admin (si mateix)
      return;
    }

    // Qualsevol altre missatge (ordres de jugadors, etc.) → dispatch local
    this.dispatch(msg);
  }

  private dispatch(msg: WsMessage): void {
    this.handlers.get(msg.type)?.forEach((h) => h(msg));
    this.handlers.get("*")?.forEach((h) => h(msg));
  }
}
