/**
 * UIOverlay — elements HUD dibuxiats sobre el canvas.
 *
 * Inclou: comptador de ronda, indicador de fase, botons de zoom.
 * S'actualitza via DOM (elements HTML superposats al canvas).
 */

import { GamePhase, PlayerInfo } from "../network/protocol.js";
import { t } from "../i18n/index.js";

export class UIOverlay {
  private container: HTMLElement;
  private timerEl: HTMLElement;
  private phaseEl: HTMLElement;
  private roundEl: HTMLElement;
  private scoreEl: HTMLElement;
  private zoomControls: HTMLElement;

  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = this.template();

    this.timerEl = container.querySelector(".hud-timer")!;
    this.phaseEl = container.querySelector(".hud-phase")!;
    this.roundEl = container.querySelector(".hud-round")!;
    this.scoreEl = container.querySelector(".hud-score")!;
    this.zoomControls = container.querySelector(".zoom-controls")!;
  }

  private template(): string {
    return `
      <div class="hud-top">
        <span class="hud-round"></span>
        <span class="hud-phase"></span>
        <span class="hud-timer"></span>
      </div>
      <div class="hud-score"></div>
      <div class="zoom-controls" aria-label="${t("zoom.controls")}">
        <button class="zoom-btn" data-action="in"  aria-label="${t("zoom.in")}">+</button>
        <button class="zoom-btn" data-action="reset" aria-label="${t("zoom.reset")}">⊙</button>
        <button class="zoom-btn" data-action="out" aria-label="${t("zoom.out")}">−</button>
      </div>
    `;
  }

  /** Vincular botons de zoom a la càmera */
  bindZoom(callbacks: { zoomIn: () => void; zoomOut: () => void; reset: () => void }): void {
    this.zoomControls.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      if (action === "in") callbacks.zoomIn();
      else if (action === "out") callbacks.zoomOut();
      else if (action === "reset") callbacks.reset();
    });
  }

  updateRound(round: number): void {
    this.roundEl.textContent = `${t("hud.round")} ${round}`;
  }

  updatePhase(phase: GamePhase): void {
    const labels: Record<GamePhase, string> = {
      lobby: t("phase.lobby"),
      planning: t("phase.planning"),
      resolving: t("phase.resolving"),
      ended: t("phase.ended"),
    };
    this.phaseEl.textContent = labels[phase] ?? phase;
    this.phaseEl.dataset.phase = phase;
  }

  startCountdown(seconds: number, onEnd?: () => void): void {
    this.stopCountdown();
    let remaining = seconds;
    this.timerEl.textContent = String(remaining);

    this.countdownInterval = setInterval(() => {
      remaining--;
      this.timerEl.textContent = String(remaining);
      if (remaining <= 0) {
        this.stopCountdown();
        onEnd?.();
      }
    }, 1000);
  }

  stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  updateScoreboard(players: PlayerInfo[], regions: Array<{ ownerId: string | null }>): void {
    const counts = new Map<string, number>();
    for (const r of regions) {
      if (r.ownerId) counts.set(r.ownerId, (counts.get(r.ownerId) ?? 0) + 1);
    }

    const sorted = [...players]
      .filter((p) => !p.isEliminated)
      .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));

    this.scoreEl.innerHTML = sorted
      .map((p) => `
        <span class="score-entry">
          <span class="score-dot" style="background:${p.color}"></span>
          <span class="score-name">${escapeHtml(p.name)}</span>
          <span class="score-count">${counts.get(p.id) ?? 0}</span>
        </span>
      `).join("");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
