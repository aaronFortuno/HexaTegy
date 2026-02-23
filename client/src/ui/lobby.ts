/**
 * Lobby — pantalla de creació i unió a sala.
 *
 * Mode LOCAL (per defecte): BroadcastChannel, funciona sense servidor.
 * Mode EN XARXA: WebSocket relay, requereix el servidor relay actiu.
 */

import { t } from "../i18n/index.js";
import { LocalRelay } from "../network/local-relay.js";
import { RelayClient } from "../network/relay-client.js";
import { MsgType } from "../network/protocol.js";

type AnyRelay = LocalRelay | RelayClient;
type LobbyCallback = (relay: AnyRelay, roomCode: string, clientId: string, isAdmin: boolean) => void;

export class LobbyView {
  private container: HTMLElement;
  private relayUrl: string;
  private onJoined: LobbyCallback;
  private mode: "local" | "online" = "local";

  constructor(container: HTMLElement, relayUrl: string, onJoined: LobbyCallback) {
    this.container = container;
    this.relayUrl = relayUrl;
    this.onJoined = onJoined;
    this.renderMain();
  }

  private renderMain(): void {
    this.container.innerHTML = `
      <section class="lobby-screen">
        <h1 class="lobby-logo">${t("lobby.title")}</h1>

        <div class="lobby-mode-toggle" role="group" aria-label="Mode de connexió">
          <button class="mode-btn ${this.mode === "local" ? "active" : ""}" data-mode="local">
            ${t("lobby.mode_local")}
          </button>
          <button class="mode-btn ${this.mode === "online" ? "active" : ""}" data-mode="online">
            ${t("lobby.mode_online")}
          </button>
        </div>

        ${this.mode === "online" ? `
          <p class="lobby-mode-hint">${t("lobby.mode_online_hint")}</p>
        ` : `
          <p class="lobby-mode-hint">${t("lobby.mode_local_hint")}</p>
        `}

        <div class="lobby-actions">
          <button class="btn btn-primary" id="btn-create">${t("lobby.create")}</button>
          <div class="lobby-divider">o</div>
          <div class="join-form">
            <input class="input" id="input-code" type="text"
                   placeholder="${t("lobby.room_code")}"
                   maxlength="7" autocomplete="off" spellcheck="false" />
            <input class="input input-name" id="input-name" type="text"
                   placeholder="${t("lobby.your_name")}"
                   maxlength="20" autocomplete="off" />
            <button class="btn btn-secondary" id="btn-join">${t("lobby.join_btn")}</button>
          </div>
        </div>

        <p class="lobby-error" id="lobby-error" hidden></p>
      </section>
    `;

    this.bindMain();
  }

  private bindMain(): void {
    // Selector de mode
    this.container.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.mode = btn.getAttribute("data-mode") as "local" | "online";
        this.renderMain();
      });
    });

    // Crear sala
    this.container.querySelector("#btn-create")!.addEventListener("click", () => {
      this.handleCreate();
    });

    // Unir-se a sala
    this.container.querySelector("#btn-join")!.addEventListener("click", () => {
      const code = (this.container.querySelector("#input-code") as HTMLInputElement).value.trim().toUpperCase();
      const name = (this.container.querySelector("#input-name") as HTMLInputElement).value.trim() || "Jugador";
      this.handleJoin(code, name);
    });

    // Enter en el camp de codi
    this.container.querySelector("#input-code")!.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        const code = (this.container.querySelector("#input-code") as HTMLInputElement).value.trim().toUpperCase();
        const name = (this.container.querySelector("#input-name") as HTMLInputElement).value.trim() || "Jugador";
        this.handleJoin(code, name);
      }
    });
  }

  // ─── Accions ──────────────────────────────────────────────────────────────

  private async handleCreate(): Promise<void> {
    this.setLoading(true);

    const relay = this.createRelay();

    try {
      await relay.connect();
    } catch {
      this.showError(t("error.connection"));
      return;
    }

    relay.on(MsgType.ROOM_CREATED, (msg) => {
      const { roomCode, clientId } = msg.payload as { roomCode: string; clientId: string };
      relay.roomCode = roomCode;
      relay.clientId = clientId;
      this.onJoined(relay, roomCode, clientId, true);
    });

    relay.on(MsgType.RELAY_ERROR, (msg) => {
      const { message } = msg.payload as { message: string };
      this.showError(message);
    });

    relay.createRoom();
  }

  private async handleJoin(code: string, name: string): Promise<void> {
    if (!code || code.length < 5) {
      this.showError(t("error.room_not_found"));
      return;
    }

    this.setLoading(true);

    const relay = this.createRelay();

    try {
      await relay.connect();
    } catch {
      this.showError(t("error.connection"));
      return;
    }

    relay.on(MsgType.ROOM_JOINED, (msg) => {
      const { roomCode, clientId } = msg.payload as { roomCode: string; clientId: string };
      relay.roomCode = roomCode;
      relay.clientId = clientId;
      this.onJoined(relay, roomCode, clientId, false);
    });

    relay.on(MsgType.RELAY_ERROR, (msg) => {
      const { message } = msg.payload as { message: string };
      this.showError(message);
    });

    relay.joinRoom(code, name);
  }

  private createRelay(): AnyRelay {
    return this.mode === "local"
      ? new LocalRelay()
      : new RelayClient(this.relayUrl);
  }

  // ─── Estat visual ─────────────────────────────────────────────────────────

  private setLoading(active: boolean): void {
    const createBtn = this.container.querySelector("#btn-create") as HTMLButtonElement | null;
    const joinBtn = this.container.querySelector("#btn-join") as HTMLButtonElement | null;
    if (createBtn) createBtn.disabled = active;
    if (joinBtn) joinBtn.disabled = active;
  }

  /** Mostra l'error: primer re-renderitza (allibera botons), després posa el text. */
  private showError(msg: string): void {
    this.renderMain(); // primer restaurar UI
    const err = this.container.querySelector("#lobby-error") as HTMLElement;
    if (err) {
      err.hidden = false;
      err.textContent = msg;
    }
  }
}
