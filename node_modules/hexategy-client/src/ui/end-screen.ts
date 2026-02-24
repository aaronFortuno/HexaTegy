/**
 * EndScreen — pantalla de fi de partida i rànquing temporal.
 */

import { t } from "../i18n/index.js";
import { PlayerInfo, Region } from "../network/protocol.js";

export class EndScreen {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  show(
    winnerId: string,
    players: PlayerInfo[],
    regions: Region[],
    onPlayAgain: () => void,
    onNewRoom: () => void
  ): void {
    const winner = players.find((p) => p.id === winnerId);
    const counts = new Map<string, number>();
    for (const r of regions) {
      if (r.ownerId) counts.set(r.ownerId, (counts.get(r.ownerId) ?? 0) + 1);
    }

    const ranking = [...players].sort(
      (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)
    );

    this.container.innerHTML = `
      <section class="end-screen">
        <div class="end-winner" style="color: ${winner?.color ?? "#fff"}">
          <span class="end-winner-label">${t("end.winner")}</span>
          <span class="end-winner-name">${escapeHtml(winner?.name ?? "?")}</span>
        </div>

        <table class="end-ranking" aria-label="${t("end.ranking")}">
          <thead><tr><th>#</th><th>${t("end.ranking")}</th><th>${t("end.regions")}</th></tr></thead>
          <tbody>
            ${ranking.map((p, i) => `
              <tr class="${p.isEliminated ? "eliminated" : ""}">
                <td>${i + 1}</td>
                <td>
                  <span class="score-dot" style="background:${p.color}"></span>
                  ${escapeHtml(p.name)}
                </td>
                <td>${counts.get(p.id) ?? 0}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="end-actions">
          <button class="btn btn-primary" id="btn-play-again">${t("end.play_again")}</button>
          <button class="btn btn-secondary" id="btn-new-room">${t("end.new_room")}</button>
        </div>
      </section>
    `;

    this.container.querySelector("#btn-play-again")!.addEventListener("click", onPlayAgain);
    this.container.querySelector("#btn-new-room")!.addEventListener("click", onNewRoom);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
