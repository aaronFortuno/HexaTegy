/**
 * main.ts — punt d'entrada de HexaTegy.
 *
 * Inicialitza i18n, capçalera i router de vistes:
 *   lobby → sala d'espera → partida → end screen
 */

import { initI18n, onLocaleChange } from "./i18n/index.js";
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
import { MsgType, MoveOrder } from "./network/protocol.js";
import type { LocalRelay } from "./network/local-relay.js";
import type { RelayClient } from "./network/relay-client.js";

type AnyRelay = LocalRelay | RelayClient;

// ─── Configuració ─────────────────────────────────────────────────────────────

const RELAY_URL = (import.meta as unknown as { env: Record<string, string> })
  .env?.VITE_RELAY_URL ?? "ws://localhost:3001";

// ─── Bootstrap ────────────────────────────────────────────────────────────────

initI18n();

const headerEl = document.getElementById("app-header")!;
const rootEl = document.getElementById("app-root")!;
const versionModal = document.getElementById("version-history-modal")!;

const appHeader = new AppHeader(headerEl, versionModal);

// Quan canvia l'idioma, re-renderitzar el header i la vista actual
let localeUnsub: (() => void) | null = null;

// ─── Router de vistes ─────────────────────────────────────────────────────────

function showLobby(): void {
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
      <div id="config-panel-mount"></div>
      <div id="player-list" class="player-list"></div>
      ${isAdmin
        ? `<button class="btn btn-primary" id="btn-start" disabled>Iniciar partida</button>`
        : `<button class="btn btn-secondary" id="btn-ready">Llest</button>`
      }
    </section>
  `;

  let adminHost: AdminHost | null = null;
  // Flag per evitar cridar showGame() més d'una vegada
  let gameTransitioned = false;

  if (isAdmin) {
    adminHost = new AdminHost(relay);

    const configMount = document.getElementById("config-panel-mount")!;
    new ConfigPanel(configMount, (cfg) => adminHost!.updateConfig(cfg));

    const startBtn = document.getElementById("btn-start") as HTMLButtonElement;
    startBtn.addEventListener("click", () => adminHost!.startGame());

    // Habilitar botó quan hi ha almenys 1 jugador més
    relay.on(MsgType.PLAYER_JOINED, () => {
      startBtn.disabled = false;
    });
  } else {
    const readyBtn = document.getElementById("btn-ready") as HTMLButtonElement;
    readyBtn.addEventListener("click", () => {
      relay.send(MsgType.PLAYER_READY, {});
      readyBtn.disabled = true;
    });
  }

  // Transició a la vista de joc quan arriba el primer estat de partida activa
  relay.on(MsgType.GAME_STATE, (msg) => {
    if (gameTransitioned) return;
    const state = msg.payload as { phase: string };
    if (state.phase === "planning" || state.phase === "resolving") {
      gameTransitioned = true;
      showGame(relay, clientId, isAdmin, adminHost);
    }
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
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // ─── Subsistemes ─────────────────────────────────────────────────────────

  const camera = new Camera(canvas, { minScale: 0.25, maxScale: 5 });
  camera.centerOnCanvas();
  camera.onChange(() => renderFrame());

  const hexRenderer = new HexRenderer(canvas, camera);
  const arrowRenderer = new ArrowRenderer(canvas, camera);
  const overlay = new UIOverlay(hudEl);
  const game = new GameClient(relay);

  // Si som l'admin, sincronitzar l'estat ara que el GameClient ja existeix
  // (el primer GAME_STATE ja va ser difós, però GameClient no existia encara)
  if (isAdmin && adminHost) {
    adminHost.syncState();
  }

  let localOrders: MoveOrder[] = [];
  const animationArrows: ArrowData[] = [];
  let dragArrow: { from: { x: number; y: number }; to: { x: number; y: number }; color: string } | null = null;

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

  // ─── Render ───────────────────────────────────────────────────────────────

  function renderFrame(): void {
    hexRenderer.render(game.regions, game.players);

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
  }

  // ─── Esdeveniments de joc ─────────────────────────────────────────────────

  game.on("state:updated", () => {
    overlay.updateRound(game.round);
    overlay.updatePhase(game.phase);
    overlay.updateScoreboard(game.players, game.regions);
    inputHandler.updateState(game.regions, localOrders);
    renderFrame();
  });

  game.on("round:started", (data) => {
    const { duration } = data as { round: number; duration: number };
    localOrders = [];
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

showLobby();
