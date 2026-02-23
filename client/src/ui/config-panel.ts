/**
 * ConfigPanel — panell de configuració de partida (només admin).
 */

import { t } from "../i18n/index.js";
import { GameConfig, DEFAULT_CONFIG, VictoryCondition } from "../network/protocol.js";

export class ConfigPanel {
  private container: HTMLElement;
  private config: GameConfig;
  private onChange: (config: GameConfig) => void;

  constructor(container: HTMLElement, onChange: (c: GameConfig) => void) {
    this.container = container;
    this.config = { ...DEFAULT_CONFIG };
    this.onChange = onChange;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <details class="config-panel">
        <summary>${t("config.title")}</summary>
        <div class="config-grid">
          ${this.field("number", "roundDuration", t("config.round_duration"), 5, 30)}
          ${this.field("number", "maxRounds", t("config.max_rounds"), 0, 999)}
          ${this.field("number", "baseProduction", t("config.base_production"), 1, 10)}
          ${this.field("number", "productionPerNeighbor", t("config.production_per_neighbor"), 0, 5)}
          ${this.field("number", "bonusAfterRounds", t("config.bonus_after_rounds"), 1, 20)}
          ${this.field("number", "bonusTroops", t("config.bonus_troops"), 0, 20)}
          ${this.field("number", "defenseAdvantage", t("config.defense_advantage"), 0, 1, 0.05)}
          ${this.victorySelect()}
          ${this.field("number", "victoryParam", t("config.victory_param"), 1, 100)}
          ${this.placementSelect()}
        </div>
        <button class="btn btn-secondary config-save">${t("config.save")}</button>
      </details>
    `;

    this.bindEvents();
    this.fillValues();
  }

  private field(
    type: string,
    key: keyof GameConfig,
    label: string,
    min?: number,
    max?: number,
    step?: number
  ): string {
    const minAttr = min !== undefined ? `min="${min}"` : "";
    const maxAttr = max !== undefined ? `max="${max}"` : "";
    const stepAttr = step !== undefined ? `step="${step}"` : "";
    return `
      <label class="config-field">
        <span>${label}</span>
        <input type="${type}" data-key="${key}" ${minAttr} ${maxAttr} ${stepAttr} />
      </label>
    `;
  }

  private victorySelect(): string {
    const options: Array<[VictoryCondition, string]> = [
      ["total_conquest", t("config.victory_total")],
      ["score_rounds", t("config.victory_score")],
      ["map_percent", t("config.victory_percent")],
      ["hill_control", t("config.victory_hill")],
    ];
    return `
      <label class="config-field">
        <span>${t("config.victory_condition")}</span>
        <select data-key="victoryCondition">
          ${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
        </select>
      </label>
    `;
  }

  private placementSelect(): string {
    return `
      <label class="config-field">
        <span>${t("config.start_placement")}</span>
        <select data-key="startPlacement">
          <option value="random">${t("config.placement_random")}</option>
          <option value="clustered">${t("config.placement_clustered")}</option>
        </select>
      </label>
    `;
  }

  private fillValues(): void {
    const inputs = this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-key]");
    inputs.forEach((el) => {
      const key = el.getAttribute("data-key") as keyof GameConfig;
      (el as HTMLInputElement).value = String(this.config[key] ?? "");
    });
  }

  private bindEvents(): void {
    this.container.querySelector(".config-save")!.addEventListener("click", () => {
      const inputs = this.container.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-key]");
      inputs.forEach((el) => {
        const key = el.getAttribute("data-key") as keyof GameConfig;
        const raw = el.value;
        // Camps numèrics
        if (el.tagName === "INPUT" && (el as HTMLInputElement).type === "number") {
          (this.config as unknown as Record<string, unknown>)[key] = parseFloat(raw);
        } else {
          (this.config as unknown as Record<string, unknown>)[key] = raw;
        }
      });
      this.onChange({ ...this.config });
    });
  }

  getConfig(): GameConfig { return { ...this.config }; }
}
