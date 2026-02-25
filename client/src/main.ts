/**
 * main.ts — punt d'entrada de HexaTegy.
 *
 * Inicialitza i18n, capçalera i router de vistes:
 *   lobby → sala d'espera → partida → end screen
 */

import { t, initI18n, onLocaleChange } from "./i18n/index.js";
import { AppHeader } from "./ui/header.js";
import { LobbyView } from "./ui/lobby.js";
import { ConfigPanel } from "./ui/config-panel.js";
import { EndScreen } from "./ui/end-screen.js";
import { AdminHost } from "./network/admin-host.js";
import { GameClient } from "./core/game.js";
import { Camera } from "./render/camera.js";
import { HexRenderer } from "./render/hex-renderer.js";
import { ArrowRenderer, ArrowData } from "./render/arrows.js";
import { UIOverlay } from "./render/ui-overlay.js";
import { InputHandler } from "./input/input-handler.js";
import { MsgType, MoveOrder, PlayerInfo, Region, GameConfig } from "./network/protocol.js";
import type { LocalRelay } from "./network/local-relay.js";
import type { RelayClient } from "./network/relay-client.js";

type AnyRelay = LocalRelay | RelayClient;

// ─── Configuració ─────────────────────────────────────────────────────────────

const RELAY_URL = "wss://hexategy-relay.onrender.com";
// const RELAY_URL = (import.meta as unknown as { env: Record<string, string> })
  // .env?.VITE_RELAY_URL ?? "ws://192.168.17.117:3001" // "ws://localhost:3001"; //

// ─── Utils ────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

console.log("[HexaTegy] main.ts carregat, iniciant bootstrap…");
initI18n();
console.log("[HexaTegy] initI18n() completat");

const headerEl = document.getElementById("app-header")!;
const rootEl = document.getElementById("app-root")!;
const versionModal = document.getElementById("version-history-modal")!;

console.log("[HexaTegy] Elements DOM:", { headerEl, rootEl, versionModal });

const appHeader = new AppHeader(headerEl, versionModal);
console.log("[HexaTegy] AppHeader creat correctament");

// Quan canvia l'idioma, re-renderitzar el header i la vista actual
let localeUnsub: (() => void) | null = null;

// ─── Router de vistes ─────────────────────────────────────────────────────────

function showLobby(): void {
  console.log("[HexaTegy] showLobby() iniciant…");
  // Dessubscriure el listener anterior si n'hi havia
  localeUnsub?.();

  rootEl.innerHTML = "";

  new LobbyView(
    rootEl,
    RELAY_URL,
    (relay, roomCode, clientId, isAdmin) => {
      localeUnsub?.(); // sortim del lobby, aturar re-renders
      showWaitingRoom(relay, roomCode, clientId, isAdmin);
    }
  );

  console.log("[HexaTegy] LobbyView creat, esperant acció de l'usuari");

  // Re-renderitzar el lobby quan canvia l'idioma
  localeUnsub = onLocaleChange(() => {
    appHeader.render(); // actualitzar el header
    showLobby();        // re-renderitzar el lobby
  });
}

function showWaitingRoom(
  relay: AnyRelay,
  roomCode: string,
  clientId: string,
  isAdmin: boolean
): void {
  rootEl.innerHTML = `
    <section class="waiting-room">
      <div class="room-code-block">
        <span class="room-code-label">Sala</span>
        <strong class="room-code">${roomCode}</strong>
      </div>
      <div class="waiting-room-cols">
        <div class="waiting-room-left">
          ${isAdmin
            ? `<div id="config-panel-mount"></div>`
            : `<div id="config-preview" class="config-preview"></div>`
          }
        </div>
        <div class="waiting-room-right">
          <div id="player-list" class="player-list">
            <p class="player-list-empty">${t("waiting.no_players")}</p>
          </div>
          ${isAdmin
            ? `<button class="btn btn-primary" id="btn-start" disabled>${t("lobby.start_game")}</button>`
            : `<button class="btn btn-secondary" id="btn-ready">${t("lobby.ready")}</button>`
          }
        </div>
      </div>
    </section>
  `;

  let adminHost: AdminHost | null = null;
  // Flag per evitar cridar showGame() més d'una vegada
  let gameTransitioned = false;

  // ─── Llista de jugadors ────────────────────────────────────────────────────

  function renderPlayerList(players: PlayerInfo[]): void {
    const listEl = document.getElementById("player-list");
    if (!listEl) return;

    if (players.length === 0) {
      listEl.innerHTML = `<p class="player-list-empty">${t("waiting.no_players")}</p>`;
      return;
    }

    listEl.innerHTML = players
      .map((p) => {
        const isMe = p.id === clientId;
        const badges = [
          p.isAdmin ? `<span class="player-badge player-badge--admin">admin</span>` : "",
          isMe      ? `<span class="player-badge player-badge--me">tu</span>` : "",
          p.isReady ? `<span class="player-badge player-badge--ready">${t("lobby.ready")}</span>` : "",
        ].join("");
        const editBtn = isAdmin
          ? `<button class="btn-icon-sm btn-edit-name" data-id="${p.id}" title="${t("waiting.edit_name")}">✎</button>`
          : "";
        const kickBtn = isAdmin && !isMe
          ? `<button class="btn-icon-sm btn-kick" data-id="${p.id}" title="${t("waiting.kick")}">✕</button>`
          : "";
        return `
          <div class="player-item" data-id="${p.id}">
            <span class="player-dot" style="background:${p.color}"></span>
            <span class="player-name">${escapeHtml(p.name)}</span>
            ${badges}
            <span class="player-item-actions">${editBtn}${kickBtn}</span>
          </div>`;
      })
      .join("");

    // Kick
    listEl.querySelectorAll<HTMLButtonElement>(".btn-kick[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => adminHost?.kickPlayer(btn.dataset.id!));
    });

    // Editar nom (inline)
    listEl.querySelectorAll<HTMLButtonElement>(".btn-edit-name[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id!;
        const item = listEl.querySelector<HTMLElement>(`.player-item[data-id="${id}"]`);
        if (!item) return;
        const nameSpan = item.querySelector<HTMLElement>(".player-name");
        if (!nameSpan || item.querySelector(".player-name-input")) return; // ja editant

        const currentName = nameSpan.textContent?.trim() ?? "";
        const input = document.createElement("input");
        input.className = "input player-name-input";
        input.value = currentName;
        input.maxLength = 20;
        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const confirm = (): void => {
          const newName = input.value.trim();
          if (newName && newName !== currentName) {
            adminHost?.renamePlayer(id, newName);
          } else {
            input.replaceWith(nameSpan);
          }
        };
        input.addEventListener("blur", confirm);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { input.blur(); }
          if (e.key === "Escape") {
            input.removeEventListener("blur", confirm);
            input.replaceWith(nameSpan);
          }
        });
      });
    });
  }

  // ─── Resum de configuració (visible per a tots els jugadors) ──────────────

  function renderConfigPreview(config: GameConfig): void {
    const el = document.getElementById("config-preview");
    if (!el) return;

    const visLabel: Record<string, string> = {
      full:      t("config.visibility_full"),
      fog_of_war: t("config.visibility_fog_of_war"),
      fog_strict: t("config.visibility_fog_strict"),
    };
    const victLabel: Record<string, string> = {
      total_conquest: t("config.victory_total"),
      score_rounds:   t("config.victory_score"),
      map_percent:    t("config.victory_percent"),
      hill_control:   t("config.victory_hill"),
    };
    const placLabel: Record<string, string> = {
      random:    t("config.placement_random"),
      clustered: t("config.placement_clustered"),
    };

    const maxRoundsVal = (!config.maxRounds || config.maxRounds === 0)
      ? t("waiting.max_rounds_unlimited")
      : String(config.maxRounds);

    const shapeLabel: Record<string, string> = {
      hexagon:   t("config.map_shape_hexagon"),
      rectangle: t("config.map_shape_rectangle"),
      triangle:  t("config.map_shape_triangle"),
    };

    const rows: Array<[string, string]> = [
      [t("config.map_size"),                 String(config.mapSize ?? 5)],
      [t("config.map_shape"),                shapeLabel[config.mapShape ?? "hexagon"] ?? (config.mapShape ?? "hexagon")],
      [t("config.visibility_mode"),          visLabel[config.visibilityMode]  ?? config.visibilityMode],
      [t("config.victory_condition"),        `${victLabel[config.victoryCondition] ?? config.victoryCondition} (${config.victoryParam})`],
      [t("config.round_duration"),           `${config.roundDuration}s`],
      [t("config.max_rounds"),               maxRoundsVal],
      [t("config.base_production"),          `${config.baseProduction} + ${config.productionPerNeighbor}${t("waiting.per_neighbor")}`],
      [t("config.bonus_after_rounds"),       `+${config.bonusTroops} ${t("waiting.from_round")} ${config.bonusAfterRounds}`],
      [t("config.defense_advantage"),        `${Math.round(config.defenseAdvantage * 100)}%`],
      [t("config.start_placement"),          placLabel[config.startPlacement] ?? config.startPlacement],
      [t("config.start_regions"),            String(config.startRegions ?? 1)],
    ];

    el.innerHTML = `
      <h3 class="config-preview-title">${t("waiting.game_config")}</h3>
      <dl class="config-preview-grid">
        ${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join("")}
      </dl>
    `;
  }

  // ─── Admin setup ───────────────────────────────────────────────────────────

  if (isAdmin) {
    adminHost = new AdminHost(relay);

    const configMount = document.getElementById("config-panel-mount")!;
    new ConfigPanel(configMount, (cfg) => adminHost!.updateConfig(cfg));

    const startBtn = document.getElementById("btn-start") as HTMLButtonElement;
    startBtn.addEventListener("click", () => adminHost!.startGame());
  } else {
    const readyBtn = document.getElementById("btn-ready") as HTMLButtonElement;
    readyBtn.addEventListener("click", () => {
      relay.send(MsgType.PLAYER_READY, {});
      readyBtn.disabled = true;
    });
  }

  // ─── Sincronització d'estat ────────────────────────────────────────────────

  relay.on(MsgType.GAME_STATE, (msg) => {
    if (gameTransitioned) return;
    const state = msg.payload as { phase: string; players: PlayerInfo[]; config?: GameConfig };

    if (state.phase === "lobby") {
      renderPlayerList(state.players ?? []);
      if (state.config) renderConfigPreview(state.config);
      // Habilitar el botó d'inici quan hi ha almenys 1 jugador
      if (isAdmin) {
        const startBtn = document.getElementById("btn-start") as HTMLButtonElement | null;
        if (startBtn) startBtn.disabled = (state.players ?? []).length < 1;
      }
    } else if (state.phase === "planning" || state.phase === "resolving") {
      gameTransitioned = true;
      showGame(relay, clientId, isAdmin, adminHost);
    }
  });
}

// ─── Filtre de visibilitat (boira de guerra) ──────────────────────────────────

/**
 * Retorna una còpia filtrada de les regions segons el mode de visibilitat del jugador.
 *
 * - full:       totes les regions amb totes les dades (sense canvis)
 * - fog_of_war: totes les regions visibles (es veu qui les controla i les tropes
 *               de les regions adjacents directes); les regions no adjacents no
 *               mostren tropes (troops = 0).
 * - fog_strict: només les pròpies regions i les adjacents directes amb totes
 *               les dades; la resta apareix com a neutral (ownerId = null, troops = 0).
 *
 * En ambdós modes de boira, les regions adjacents SEMPRES mostren les tropes
 * actuals (no l'increment de producció, que el renderer ja oculta per regions alienes).
 */
function applyVisibilityFilter(
  regions: Region[],
  myPlayerId: string,
  config: GameConfig | null
): Region[] {
  const mode = config?.visibilityMode ?? "full";
  if (mode === "full") return regions;

  const myRegionIds = new Set(
    regions.filter((r) => r.ownerId === myPlayerId).map((r) => r.id)
  );

  // Calcular adjacents (regions veïnes a les pròpies però no pròpies)
  const adjacentIds = new Set<string>();
  for (const regionId of myRegionIds) {
    const region = regions.find((r) => r.id === regionId);
    region?.neighbors.forEach((nId) => {
      if (!myRegionIds.has(nId)) adjacentIds.add(nId);
    });
  }

  if (mode === "fog_of_war") {
    // Totes les regions visibles; adjacents mostren tropes reals;
    // les no adjacents amaguen les tropes (troops = 0)
    return regions.map((r) => {
      if (myRegionIds.has(r.id) || adjacentIds.has(r.id)) return r;
      return { ...r, troops: 0 };
    });
  }

  // fog_strict: pròpies + adjacents visibles amb dades reals; resta = neutral
  return regions.map((r) => {
    if (myRegionIds.has(r.id) || adjacentIds.has(r.id)) return r;
    return { ...r, ownerId: null, troops: 0 };
  });
}

function showGame(
  relay: AnyRelay,
  clientId: string,
  isAdmin: boolean,
  adminHost: AdminHost | null
): void {
  rootEl.innerHTML = `
    <div class="game-layout">
      <canvas id="game-canvas" class="game-canvas"></canvas>
      <div id="hud-overlay" class="hud-overlay"></div>
    </div>
  `;

  const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
  const hudEl = document.getElementById("hud-overlay")!;

  function resizeCanvas(): void {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    renderFrame();
  }
  // Establim dimensions inicials sense cridar renderFrame —
  // els subsistemes (hexRenderer, etc.) encara no estan inicialitzats.
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // ─── Subsistemes ─────────────────────────────────────────────────────────

  const camera = new Camera(canvas, { minScale: 0.25, maxScale: 5 });
  camera.centerOnCanvas();
  camera.onChange(() => renderFrame());

  const hexRenderer = new HexRenderer(canvas, camera);
  hexRenderer.myPlayerId = clientId;
  const arrowRenderer = new ArrowRenderer(canvas, camera);
  const overlay = new UIOverlay(hudEl);
  const game = new GameClient(relay);

  // Si som l'admin, sincronitzar l'estat ara que el GameClient ja existeix
  // (el primer GAME_STATE ja va ser difós, però GameClient no existia encara)
  if (isAdmin && adminHost) {
    adminHost.syncState();
  }

  let localOrders: MoveOrder[] = [];
  let animationArrows: ArrowData[] = [];
  let dragArrow: { from: { x: number; y: number }; to: { x: number; y: number }; color: string } | null = null;
  let rightDragArrow: { from: { x: number; y: number }; to: { x: number; y: number }; hasValidTarget: boolean } | null = null;

  overlay.bindZoom({
    zoomIn: () => camera.zoomIn(),
    zoomOut: () => camera.zoomOut(),
    reset: () => { camera.resetZoom(); camera.centerOnCanvas(); },
  });

  // ─── Input ───────────────────────────────────────────────────────────────

  const inputHandler = new InputHandler(
    canvas, hexRenderer, camera, clientId,
    (orders) => {
      localOrders = orders;
      game.localOrders = orders;
      renderFrame();
    }
  );

  inputHandler.onDrag((from, to) => {
    const myPlayer = game.playerById(clientId);
    dragArrow = (from.x !== 0 || to.x !== 0)
      ? { from, to, color: myPlayer?.color ?? "#fff" }
      : null;
    renderFrame();
  });

  inputHandler.onRightDrag((from, to, targetId) => {
    if (!from || !to) {
      rightDragArrow = null;
      hexRenderer.deleteTargetRegionId = null;
    } else {
      rightDragArrow = { from, to, hasValidTarget: targetId !== null };
      hexRenderer.deleteTargetRegionId = targetId;
    }
    renderFrame();
  });

  inputHandler.onContextMenu((region: Region, cx: number, cy: number) => {
    showRegionContextMenu(region, cx, cy);
  });

  inputHandler.onArrowLabelClick((fromId, toId, screenPos) => {
    showArrowTroopInput(fromId, toId, screenPos);
  });

  function showRegionContextMenu(region: Region, clientX: number, clientY: number): void {
    document.getElementById("region-ctx-menu")?.remove();

    const owner     = region.ownerId ? game.playerById(region.ownerId) : null;
    const ownerName = owner?.name ?? t("ctx.neutral");
    const ownerColor = owner?.color ?? "var(--text-muted)";

    const menu = document.createElement("div");
    menu.id        = "region-ctx-menu";
    menu.className = "region-ctx-menu";

    // Posicionem el menú ajustant-lo per no sortir de la pantalla
    const menuW = 172;
    const menuH = 72;
    const x = Math.min(clientX + 4, window.innerWidth  - menuW - 8);
    const y = Math.min(clientY + 4, window.innerHeight - menuH - 8);
    menu.style.left = `${x}px`;
    menu.style.top  = `${y}px`;

    menu.innerHTML = `
      <div class="ctx-header">
        <span class="ctx-troops">⚔ ${region.troops}</span>
        <span class="ctx-owner" style="color:${ownerColor}">${escapeHtml(ownerName)}</span>
      </div>
      <button class="ctx-item" disabled>${t("ctx.coming_soon")}</button>
    `;

    document.body.appendChild(menu);

    // Tancar al clicar fora (setTimeout per no tancar en el mateix event)
    const dismiss = (e: MouseEvent): void => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener("mousedown", dismiss);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", dismiss), 0);
  }

  function showArrowTroopInput(
    fromId: string,
    toId: string,
    screenPos: { x: number; y: number }
  ): void {
    document.getElementById("arrow-troop-input")?.remove();

    const order = localOrders.find((o) => o.fromRegionId === fromId && o.toRegionId === toId);
    if (!order) return;
    const fromRegion = game.regions.find((r) => r.id === fromId);
    if (!fromRegion) return;

    const otherTroops = localOrders
      .filter((o) => o.fromRegionId === fromId && o.toRegionId !== toId)
      .reduce((s, o) => s + o.troops, 0);
    const maxTroops = Math.max(1, fromRegion.troops - 1 - otherTroops);

    const inp = document.createElement("input");
    inp.id        = "arrow-troop-input";
    inp.type      = "number";
    inp.className = "arrow-troop-input";
    inp.value     = String(order.troops);
    inp.min       = "1";
    inp.max       = String(maxTroops);
    inp.style.left = `${screenPos.x}px`;
    inp.style.top  = `${screenPos.y}px`;

    document.body.appendChild(inp);
    inp.focus();
    inp.select();

    const validate = (): boolean => {
      const v = parseInt(inp.value, 10);
      const ok = !isNaN(v) && v >= 1 && v <= maxTroops;
      inp.classList.toggle("arrow-troop-input--invalid", !ok);
      return ok;
    };

    const commit = (): void => {
      if (validate()) {
        order.troops = parseInt(inp.value, 10);
        game.localOrders = localOrders;
        inputHandler.updateState(game.regions, localOrders);
        renderFrame();
      }
      inp.remove();
    };

    inp.addEventListener("input", () => validate());
    inp.addEventListener("blur", commit);
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter")  { inp.blur(); }
      if (ev.key === "Escape") {
        inp.removeEventListener("blur", commit);
        inp.remove();
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function renderFrame(): void {
    const visRegions = applyVisibilityFilter(game.regions, clientId, game.config);
    hexRenderer.render(visRegions, game.players);

    const myPlayer = game.playerById(clientId);
    const plannedArrows: ArrowData[] = localOrders.map((o) => ({
      fromRegionId: o.fromRegionId,
      toRegionId: o.toRegionId,
      troops: o.troops,
      color: myPlayer?.color ?? "#fff",
    }));
    arrowRenderer.render([...plannedArrows, ...animationArrows], game.regions);

    if (dragArrow) {
      arrowRenderer.drawDragArrow(dragArrow.from, dragArrow.to, dragArrow.color);
    }
    if (rightDragArrow) {
      arrowRenderer.drawDeleteDragArrow(rightDragArrow.from, rightDragArrow.to, rightDragArrow.hasValidTarget);
    }
  }

  // ─── Esdeveniments de joc ─────────────────────────────────────────────────

  game.on("state:updated", () => {
    hexRenderer.config = game.config;
    overlay.updateRound(game.round);
    overlay.updatePhase(game.phase);
    overlay.updateScoreboard(game.players, game.regions);
    inputHandler.updateState(game.regions, localOrders);
    renderFrame();
  });

  game.on("round:started", (data) => {
    const { duration } = data as { round: number; duration: number };
    localOrders = [];
    animationArrows = [];
    game.localOrders = [];
    hexRenderer.updateOwnerStreak(game.regions);
    inputHandler.updateState(game.regions, localOrders);
    overlay.startCountdown(duration, () => game.submitOrders());
    renderFrame();
  });

  game.on("round:resolved", () => {
    overlay.stopCountdown();
    setTimeout(() => renderFrame(), 2200);
  });

  game.on("game:over", (data) => {
    const { winnerId } = data as { winnerId: string };
    window.removeEventListener("resize", resizeCanvas);
    camera.detachEvents();
    inputHandler.detach();
    showEndScreen(relay, winnerId, game, adminHost);
  });

  renderFrame();
}

function showEndScreen(
  relay: AnyRelay,
  winnerId: string,
  game: GameClient,
  adminHost: AdminHost | null
): void {
  const endScreen = new EndScreen(rootEl);
  endScreen.show(
    winnerId,
    game.players,
    game.regions,
    () => showWaitingRoom(relay, relay.roomCode ?? "", relay.clientId ?? "", adminHost !== null),
    () => {
      relay.disconnect();
      adminHost?.destroy();
      showLobby();
    }
  );
}

// ─── Inici ────────────────────────────────────────────────────────────────────

try {
  showLobby();
} catch (e) {
  console.error("[HexaTegy] ERROR FATAL a showLobby():", e);
  document.getElementById("app-root")!.innerHTML =
    `<div style="padding:2rem;color:#e05c5c;font-family:monospace">
       <b>Error d'inicialització</b><br><pre>${String(e)}</pre>
       <p>Consulta la consola del navegador per més detalls.</p>
     </div>`;
}
