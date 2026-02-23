/**
 * Header — capçalera discreta: nom del joc, icona d'historial, tema i idioma.
 *
 * Els listeners s'afegeixen UNA SOLA VEGADA al constructor via event delegation
 * sobre `this.container`. Les crides posteriors a render() substitueixen el
 * innerHTML però no el container, de manera que els listeners segueixen actius.
 */

import { t, setLocale, getLocale, AVAILABLE_LOCALES } from "../i18n/index.js";
import { VersionHistory } from "./version-history.js";

export class AppHeader {
  private container: HTMLElement;
  private versionHistory: VersionHistory;
  private theme: "light" | "dark";

  constructor(container: HTMLElement, versionModal: HTMLElement) {
    this.container = container;
    this.versionHistory = new VersionHistory(versionModal);
    this.theme = (localStorage.getItem("hexategy_theme") as "light" | "dark") ?? "dark";
    document.documentElement.setAttribute("data-theme", this.theme);

    this.render();
    // Listeners afegits UNA SOLA VEGADA — event delegation sobre container
    this.container.addEventListener("click", this.handleClick);
    this.container.addEventListener("change", this.handleChange);
  }

  // ─── Handlers com a class properties (arrow fn) per mantenir `this` ────────

  private handleClick = (e: MouseEvent): void => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    if (btn.classList.contains("version-btn")) this.versionHistory.toggle();
    else if (btn.classList.contains("theme-btn")) this.toggleTheme();
  };

  private handleChange = (e: Event): void => {
    const select = e.target as HTMLSelectElement;
    if (select.classList.contains("locale-select")) {
      // setLocale notifica onLocaleChange, que re-renderitza la vista actual
      setLocale(select.value);
      // Re-renderitzar el propi header (listeners segueixen actius via delegation)
      this.render();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  render(): void {
    this.container.innerHTML = `
      <div class="header-left">
        <span class="app-name">${t("app.name")}</span>
        <button class="icon-btn version-btn"
                title="${t("app.version_history")}"
                aria-label="${t("app.version_history")}">?</button>
      </div>
      <div class="header-right">
        <select class="locale-select" aria-label="Idioma / Language">
          ${AVAILABLE_LOCALES.map(
            (l) => `<option value="${l.code}" ${l.code === getLocale() ? "selected" : ""}>${l.label}</option>`
          ).join("")}
        </select>
        <button class="icon-btn theme-btn" title="Tema" aria-label="Canviar tema">
          ${this.theme === "dark" ? "☀" : "☾"}
        </button>
      </div>
    `;
  }

  // ─── Accions ──────────────────────────────────────────────────────────────

  private toggleTheme(): void {
    this.theme = this.theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", this.theme);
    localStorage.setItem("hexategy_theme", this.theme);
    // Actualitzar només el botó (render() complet és opcional però net)
    this.render();
  }
}
