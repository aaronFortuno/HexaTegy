/**
 * VersionHistory — modal amb el registre de canvis del projecte.
 *
 * S'obre fent clic a la icona discreta de la capçalera.
 */

import { t } from "../i18n/index.js";

interface VersionEntry {
  version: string;
  date: string;
  changes: string[];
}

/** Afegir aquí cada nova versió en ordre descendent */
const HISTORY: VersionEntry[] = [
  {
    version: "0.1.0",
    date: "2026-02-22",
    changes: [
      "Esquelet inicial del projecte",
      "Arquitectura Admin-as-Host via relay WebSocket",
      "Sistema de coordenades hexagonals axials",
      "Motor de combat i producció de tropes",
      "Condicions de victòria configurables",
      "Zoom i pan del canvas (roda, pinch, botons)",
      "i18n: Català, Castellà, Anglès",
      "Modo clar / fosc",
      "Historial de versions",
    ],
  },
];

export class VersionHistory {
  private modal: HTMLElement;
  private isOpen = false;

  constructor(modal: HTMLElement) {
    this.modal = modal;
    this.modal.innerHTML = this.renderModal();
    this.bindEvents();
  }

  private renderModal(): string {
    const entries = HISTORY.map(
      (entry) => `
        <article class="version-entry">
          <header class="version-entry-header">
            <span class="version-tag">v${entry.version}</span>
            <time class="version-date" datetime="${entry.date}">${entry.date}</time>
          </header>
          <ul class="version-changes">
            ${entry.changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
          </ul>
        </article>
      `
    ).join("");

    return `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-dialog" role="dialog" aria-modal="true"
           aria-labelledby="version-modal-title">
        <header class="modal-header">
          <h2 id="version-modal-title">${t("version.title")}</h2>
          <button class="modal-close" data-action="close" aria-label="${t("version.close")}">✕</button>
        </header>
        <div class="modal-body version-list">
          ${entries}
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    this.modal.addEventListener("click", (e) => {
      const el = (e.target as HTMLElement).closest("[data-action]");
      if (el?.getAttribute("data-action") === "close") this.close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isOpen) this.close();
    });
  }

  open(): void {
    this.modal.hidden = false;
    this.isOpen = true;
    // Focus al diàleg per accessibilitat
    (this.modal.querySelector(".modal-dialog") as HTMLElement)?.focus();
  }

  close(): void {
    this.modal.hidden = true;
    this.isOpen = false;
  }

  toggle(): void {
    this.isOpen ? this.close() : this.open();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
