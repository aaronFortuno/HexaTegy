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
export class LobbyView {
    container;
    relayUrl;
    onJoined;
    mode = "local";
    constructor(container, relayUrl, onJoined) {
        this.container = container;
        this.relayUrl = relayUrl;
        this.onJoined = onJoined;
        this.renderMain();
    }
    renderMain() {
        console.log("[LobbyView] renderMain() executat");
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
    bindMain() {
        // Selector de mode
        this.container.querySelectorAll(".mode-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                this.mode = btn.getAttribute("data-mode");
                this.renderMain();
            });
        });
        // Crear sala
        this.container.querySelector("#btn-create").addEventListener("click", () => {
            this.handleCreate();
        });
        // Unir-se a sala
        this.container.querySelector("#btn-join").addEventListener("click", () => {
            const code = this.container.querySelector("#input-code").value.trim().toUpperCase();
            const name = this.container.querySelector("#input-name").value.trim() || "Jugador";
            this.handleJoin(code, name);
        });
        // Auto-format XXX-XXX: insereix el guionet en escriure el 4t caràcter
        const inputCode = this.container.querySelector("#input-code");
        inputCode.addEventListener("input", () => {
            const raw = inputCode.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
            inputCode.value = raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
        });
        // Enter en el camp de codi
        this.container.querySelector("#input-code").addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const code = this.container.querySelector("#input-code").value.trim().toUpperCase();
                const name = this.container.querySelector("#input-name").value.trim() || "Jugador";
                this.handleJoin(code, name);
            }
        });
    }
    // ─── Accions ──────────────────────────────────────────────────────────────
    async handleCreate() {
        this.setLoading(true);
        const relay = this.createRelay();
        try {
            await relay.connect();
        }
        catch {
            this.showError(t("error.connection"));
            return;
        }
        relay.on(MsgType.ROOM_CREATED, (msg) => {
            const { roomCode, clientId } = msg.payload;
            relay.roomCode = roomCode;
            relay.clientId = clientId;
            this.onJoined(relay, roomCode, clientId, true);
        });
        relay.on(MsgType.RELAY_ERROR, (msg) => {
            const { message } = msg.payload;
            this.showError(message);
        });
        relay.createRoom();
    }
    async handleJoin(code, name) {
        if (!code || code.length < 5) {
            this.showError(t("error.room_not_found"));
            return;
        }
        this.setLoading(true);
        const relay = this.createRelay();
        try {
            await relay.connect();
        }
        catch {
            this.showError(t("error.connection"));
            return;
        }
        relay.on(MsgType.ROOM_JOINED, (msg) => {
            const { roomCode, clientId } = msg.payload;
            relay.roomCode = roomCode;
            relay.clientId = clientId;
            this.onJoined(relay, roomCode, clientId, false);
        });
        relay.on(MsgType.RELAY_ERROR, (msg) => {
            const { message } = msg.payload;
            this.showError(message);
        });
        relay.joinRoom(code, name);
    }
    createRelay() {
        return this.mode === "local"
            ? new LocalRelay()
            : new RelayClient(this.relayUrl);
    }
    // ─── Estat visual ─────────────────────────────────────────────────────────
    setLoading(active) {
        const createBtn = this.container.querySelector("#btn-create");
        const joinBtn = this.container.querySelector("#btn-join");
        if (createBtn)
            createBtn.disabled = active;
        if (joinBtn)
            joinBtn.disabled = active;
    }
    /** Mostra l'error: primer re-renderitza (allibera botons), després posa el text. */
    showError(msg) {
        this.renderMain(); // primer restaurar UI
        const err = this.container.querySelector("#lobby-error");
        if (err) {
            err.hidden = false;
            err.textContent = msg;
        }
    }
}
