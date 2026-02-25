/**
 * ConfigPanel — panell de configuració de partida (només admin).
 */
import { t } from "../i18n/index.js";
import { DEFAULT_CONFIG } from "../network/protocol.js";
export class ConfigPanel {
    container;
    config;
    onChange;
    constructor(container, onChange) {
        this.container = container;
        this.config = { ...DEFAULT_CONFIG };
        this.onChange = onChange;
        this.render();
    }
    render() {
        this.container.innerHTML = `
      <details class="config-panel" open>
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
          ${this.field("number", "startRegions", t("config.start_regions"), 1, 5)}
          ${this.visibilitySelect()}
          ${this.mapSizeSelect()}
          ${this.mapShapeSelect()}
        </div>
      </details>
    `;
        this.bindEvents();
        this.fillValues();
    }
    field(type, key, label, min, max, step) {
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
    victorySelect() {
        const options = [
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
    placementSelect() {
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
    visibilitySelect() {
        const options = [
            ["full", t("config.visibility_full")],
            ["fog_of_war", t("config.visibility_fog_of_war")],
            ["fog_strict", t("config.visibility_fog_strict")],
        ];
        return `
      <label class="config-field">
        <span>${t("config.visibility_mode")}</span>
        <select data-key="visibilityMode">
          ${options.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
        </select>
      </label>
    `;
    }
    mapSizeSelect() {
        const sizes = [
            [3, "3 – Petit (37 cel·les)"],
            [4, "4 – Mig (61 cel·les)"],
            [5, "5 – Estàndard (91 cel·les)"],
            [6, "6 – Gran (127 cel·les)"],
            [8, "8 – Molt gran (217 cel·les)"],
        ];
        return `
      <label class="config-field">
        <span>${t("config.map_size")}</span>
        <select data-key="mapSize">
          ${sizes.map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}
        </select>
      </label>
    `;
    }
    mapShapeSelect() {
        const shapes = [
            ["hexagon", t("config.map_shape_hexagon"), false],
            ["rectangle", t("config.map_shape_rectangle"), true],
            ["triangle", t("config.map_shape_triangle"), true],
        ];
        return `
      <label class="config-field">
        <span>${t("config.map_shape")}</span>
        <select data-key="mapShape">
          ${shapes.map(([v, l, dis]) => `<option value="${v}"${dis ? " disabled" : ""}>${l}</option>`).join("")}
        </select>
      </label>
    `;
    }
    fillValues() {
        const inputs = this.container.querySelectorAll("[data-key]");
        inputs.forEach((el) => {
            const key = el.getAttribute("data-key");
            el.value = String(this.config[key] ?? "");
        });
    }
    bindEvents() {
        const inputs = this.container.querySelectorAll("[data-key]");
        inputs.forEach((el) => {
            el.addEventListener("change", () => {
                const key = el.getAttribute("data-key");
                const raw = el.value;
                if (el.tagName === "INPUT" && el.type === "number") {
                    const num = parseFloat(raw);
                    if (!isNaN(num)) {
                        this.config[key] = num;
                    }
                }
                else {
                    this.config[key] = raw;
                }
                this.onChange({ ...this.config });
            });
        });
    }
    getConfig() { return { ...this.config }; }
}
