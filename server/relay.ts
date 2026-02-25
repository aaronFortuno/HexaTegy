/**
 * HexaTegy — Relay WebSocket Server
 *
 * Servidor sense estat: encamina missatges entre clients de la mateixa sala.
 * Cap lògica de joc viu aquí. Tota l'autoritat és al navegador admin.
 */

import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 3001);

interface RoomMember {
  ws: WebSocket;
  id: string;
  isAdmin: boolean;
}

// rooms: roomCode → llista de membres
const rooms = new Map<string, RoomMember[]>();

const wss = new WebSocketServer({ 
  port: PORT,
  host: "0.0.0.0" // per connectar amb servei extern i escolti totes les interfícies
});

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function membersOf(roomCode: string): RoomMember[] {
  return rooms.get(roomCode) ?? [];
}

function broadcast(roomCode: string, data: string, exclude?: WebSocket): void {
  for (const member of membersOf(roomCode)) {
    if (member.ws !== exclude && member.ws.readyState === WebSocket.OPEN) {
      member.ws.send(data);
    }
  }
}

function sendTo(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function removeMember(ws: WebSocket): void {
  for (const [roomCode, members] of rooms.entries()) {
    const idx = members.findIndex((m) => m.ws === ws);
    if (idx === -1) continue;

    const [removed] = members.splice(idx, 1);

    if (members.length === 0) {
      rooms.delete(roomCode);
      console.log(`[relay] Sala ${roomCode} tancada (buida)`);
      return;
    }

    // Notificar a la resta
    broadcast(roomCode, JSON.stringify({
      type: "player:left",
      payload: { id: removed.id, isAdmin: removed.isAdmin },
    }));

    // Si era l'admin, notificar que la sala pot quedar orfena
    if (removed.isAdmin) {
      console.warn(`[relay] Admin de ${roomCode} desconnectat`);
    }
    return;
  }
}

// Caràcters no ambigus (sense O-0, I-l, etc.)
const UNAMBIGUOUS_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomCode(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    result += UNAMBIGUOUS_CHARS[randomIndex];
  }
  return result;
}


wss.on("connection", (ws) => {
  const clientId = generateId();
  let joinedRoom: string | null = null;

  ws.on("message", (raw) => {
    let msg: { type: string; payload?: Record<string, unknown> };

    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendTo(ws, { type: "relay:error", payload: { message: "JSON invàlid" } });
      return;
    }

    switch (msg.type) {
      // ─── Crear sala (admin) ───────────────────────────────────────────
      case "room:create": {
        // Generar codi XXX-XXX amb caràcters no ambigus
        const code = [
          generateRoomCode(3),
          generateRoomCode(3)
        ].join("-");

        rooms.set(code, [{ ws, id: clientId, isAdmin: true }]);
        joinedRoom = code;

        sendTo(ws, {
          type: "room:created",
          payload: { roomCode: code, clientId },
        });
        console.log(`[relay] Sala creada: ${code}`);
        break;
      }

      // ─── Unir-se a sala (jugador) ─────────────────────────────────────
      case "room:join": {
        const roomCode = String(msg.payload?.roomCode ?? "").toUpperCase();
        const playerName = String(msg.payload?.name ?? "Jugador");

        if (!rooms.has(roomCode)) {
          sendTo(ws, {
            type: "relay:error",
            payload: { message: `Sala ${roomCode} no existeix` },
          });
          return;
        }

        const member: RoomMember = { ws, id: clientId, isAdmin: false };
        rooms.get(roomCode)!.push(member);
        joinedRoom = roomCode;

        // Confirmar al nou membre
        sendTo(ws, {
          type: "room:joined",
          payload: { roomCode, clientId },
        });

        // Notificar a l'admin i resta
        broadcast(roomCode, JSON.stringify({
          type: "player:joined",
          payload: { id: clientId, name: playerName },
        }), ws);

        console.log(`[relay] ${playerName} (${clientId}) → sala ${roomCode}`);
        break;
      }

      // ─── Missatge genèric: encaminament a la sala ─────────────────────
      default: {
        if (!joinedRoom) {
          sendTo(ws, {
            type: "relay:error",
            payload: { message: "No estàs en cap sala" },
          });
          return;
        }

        // Afegir metadades de remitent i reenviar
        const envelope = JSON.stringify({
          type: msg.type,
          from: clientId,
          payload: msg.payload ?? {},
        });

        broadcast(joinedRoom, envelope, ws);
        break;
      }
    }
  });

  ws.on("close", () => removeMember(ws));
  ws.on("error", () => removeMember(ws));
});

console.log(`[relay] HexaTegy relay escoltant al port ${PORT}`);
