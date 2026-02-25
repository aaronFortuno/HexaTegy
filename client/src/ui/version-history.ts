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
    version: "0.1.6",
    date: "2026-02-25",
    changes: [
      "Correcció: les regions acabades de conquistar no reben producció el torn de la conquesta (evita inflació de tropes immediata)",
      "Correcció: múltiples ordres des de la mateixa regió ara es distribueixen proporcionalment al servidor, garantint que mai es creïn tropes del no-res",
      "Correcció: eliminar una ruta planificada ara redistribueix les tropes alliberades equitativament entre les rutes restants del mateix origen",
      "TODO: opció de configuració per al nombre de regions inicials per jugador (ara sempre 1)",
    ],
  },
  {
    version: "0.1.5",
    date: "2026-02-25",
    changes: [
      "La configuració de partida s'aplica immediatament en canviar cada camp, sense necessitat de prémer 'Desar'",
      "Sala d'espera redissenyada en dues columnes: configuració a l'esquerra, llista de jugadors a la dreta",
      "Mode de visibilitat 'Regions controlades' eliminat (no tenia comportament clar definit)",
      "Implementació real de la boira de guerra: 'Boira de guerra' oculta tropes enemigues; 'Boira estricta' amaga regions fora de l'abast immediat",
    ],
  },
  {
    version: "0.1.4",
    date: "2026-02-24",
    changes: [
      "Correcció: regions neutrals amb 0 tropes ara es capturen correctament (l'atacant hi entra amb totes les tropes enviades, sense reducció per fórmula)",
      "Correcció: regions que rebien 1 sola tropa quedaven permanentment neutrals sense color ni producció — resolt amb el cas especial anterior",
      "Correcció: el comptador de ronda usava setInterval acumulant ~300 ms de deriva; ara la crida d'enviament d'ordres usa setTimeout per disparar-se en el moment exacte",
      "Configuració de partida visible en temps real a la sala d'espera per a tots els clients",
      "Nou selector de mode de visibilitat a la configuració (Visibilitat total, Boira de guerra, Regions controlades, Boira estricta)",
    ],
  },
  {
    version: "0.1.3",
    date: "2026-02-24",
    changes: [
      "Indicador de producció (+N) a la cantonada superior esquerra de cada cel·la pròpia",
      "Feedback visual en drag dret: línia vermella i overlay vermell sobre la cel·la destí quan hi ha un ordre a eliminar",
      "Correcció: el drag dret ja no mou la càmera quan s'inicia sobre una regió pròpia",
    ],
  },
  {
    version: "0.1.2",
    date: "2026-02-24",
    changes: [
      "Format automàtic del codi de sala (XXX-XXX): el guionet s'insereix sol en escriure el 4t caràcter",
    ],
  },
  {
    version: "0.1.1",
    date: "2026-02-23",
    changes: [
      "Drag dret sobre una cel·la pròpia i arrossegament a un veí elimina l'ordre planificat de moviment",
      "Clic dret sobre una cel·la obre el menú contextual de la regió",
    ],
  },
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
