/**
 * VersionHistory — modal amb el registre de canvis del projecte.
 *
 * S'obre fent clic a la icona discreta de la capçalera.
 */
import { t } from "../i18n/index.js";
/** Afegir aquí cada nova versió en ordre descendent */
const HISTORY = [
    {
        version: "0.1.9",
        date: "2026-02-25",
        changes: [
            "Correcció: l'editor de tropes de les fletxes s'obre en passar el cursor per sobre de l'etiqueta numèrica (cursor en forma de punter) i fent clic; la detecció anterior era massa discreta",
            "Nova configuració: 'Mida del tauler' (radi 3–8), que controla el nombre de cel·les del grid hexagonal",
            "Nova configuració: 'Forma del tauler' (interfície preparada; únicament Hexàgon disponible, Rectangle i Triangle pendents d'implementació)",
        ],
    },
    {
        version: "0.1.8",
        date: "2026-02-25",
        changes: [
            "L'administrador apareix a la llista de jugadors de la sala d'espera i pot editar el seu propi nom com qualsevol altre jugador",
            "Les etiquetes numèriques de les fletxes de planificació són editables: clic sobre el número per modificar les tropes assignades a aquell moviment",
            "Feedback visual (vora vermella) quan el valor introduït supera el màxim disponible o és menor que 1",
        ],
    },
    {
        version: "0.1.7",
        date: "2026-02-25",
        changes: [
            "Nova opció de configuració: 'Regions inicials per jugador' (1–5), vinculada al mode de col·locació inicial",
            "La col·locació expandeix el territori de cada jugador de forma aleatòria i equitativa entre veïns lliures",
            "Boira de guerra i Boira estricta: les regions adjacents directes ara mostren sempre el nombre de tropes actuals (sense increment de producció, que continua ocult per a regions alienes)",
        ],
    },
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
    modal;
    isOpen = false;
    constructor(modal) {
        this.modal = modal;
        this.modal.innerHTML = this.renderModal();
        this.bindEvents();
    }
    renderModal() {
        const entries = HISTORY.map((entry) => `
        <article class="version-entry">
          <header class="version-entry-header">
            <span class="version-tag">v${entry.version}</span>
            <time class="version-date" datetime="${entry.date}">${entry.date}</time>
          </header>
          <ul class="version-changes">
            ${entry.changes.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}
          </ul>
        </article>
      `).join("");
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
    bindEvents() {
        this.modal.addEventListener("click", (e) => {
            const el = e.target.closest("[data-action]");
            if (el?.getAttribute("data-action") === "close")
                this.close();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen)
                this.close();
        });
    }
    open() {
        this.modal.hidden = false;
        this.isOpen = true;
        // Focus al diàleg per accessibilitat
        this.modal.querySelector(".modal-dialog")?.focus();
    }
    close() {
        this.modal.hidden = true;
        this.isOpen = false;
    }
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
}
function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
