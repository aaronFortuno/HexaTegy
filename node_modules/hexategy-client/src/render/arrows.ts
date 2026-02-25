/**
 * Arrows — fletxes de planificació i animació de resolució.
 *
 * Les fletxes de planificació es dibuixen sobre el canvas en temps real
 * mentre el jugador arrossega. Les d'animació es mostren durant la resolució.
 */

import { Region } from "../network/protocol.js";
import { Camera } from "./camera.js";
import { hexToPixel } from "./hex-renderer.js";

const HEX_SIZE = 48; // radi exterior en píxels (sense zoom)

export interface ArrowData {
  fromRegionId: string;
  toRegionId: string;
  troops: number;
  color: string;
  animated?: boolean; // true durant la fase de resolució
  progress?: number;  // 0–1 per a l'animació
}

export class ArrowRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.ctx = canvas.getContext("2d")!;
    this.camera = camera;
  }

  render(arrows: ArrowData[], regions: Region[]): void {
    const ctx = this.ctx;
    const regionById = new Map(regions.map((r) => [r.id, r]));

    ctx.save();
    this.camera.applyToContext(ctx);

    for (const arrow of arrows) {
      const from = regionById.get(arrow.fromRegionId);
      const to = regionById.get(arrow.toRegionId);
      if (!from || !to) continue;

      const fp = hexToPixel(from.coord.q, from.coord.r);
      const tp = hexToPixel(to.coord.q, to.coord.r);

      if (arrow.animated && arrow.progress !== undefined) {
        this.drawAnimatedArrow(ctx, fp, tp, arrow);
      } else {
        this.drawPlanningArrow(ctx, fp, tp, arrow);
      }
    }

    ctx.restore();
  }

  private drawPlanningArrow(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    arrow: ArrowData
  ): void {
    const color = darkenColor(arrow.color, 0.72);

    ctx.save();

    // ── Línia: outline fosc + color del jugador ───────────────────────────────
    ctx.setLineDash([6, 4]);

    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.fillStyle  = "rgba(0,0,0,0.6)";
    ctx.lineWidth  = 5.5;
    drawArrowLine(ctx, from.x, from.y, to.x, to.y);

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 2.5;
    drawArrowLine(ctx, from.x, from.y, to.x, to.y);

    // ── Etiqueta de tropes ────────────────────────────────────────────────────
    const mx    = (from.x + to.x) / 2;
    const my    = (from.y + to.y) / 2;
    const label = String(arrow.troops);

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.font         = "bold 12px system-ui, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";

    const tw  = ctx.measureText(label).width;
    const bw  = tw + 12;
    const bh  = 20;
    const bx  = mx - bw / 2;
    const by  = my - bh / 2;

    // Fons fosc arrodonit
    ctx.fillStyle = "rgba(16, 18, 26, 0.88)";
    roundRect(ctx, bx, by, bw, bh, 5);
    ctx.fill();

    // Vora de color del jugador
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    roundRect(ctx, bx, by, bw, bh, 5);
    ctx.stroke();

    // Text blanc
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, mx, my);

    ctx.restore();
  }

  private drawAnimatedArrow(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    arrow: ArrowData
  ): void {
    const p = arrow.progress ?? 0;
    const cx = from.x + (to.x - from.x) * p;
    const cy = from.y + (to.y - from.y) * p;

    ctx.globalAlpha = 1 - p * 0.3;
    ctx.fillStyle = arrow.color;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Dibuixar la fletxa de drag dret (eliminar ordre): línia vermella cap al cursor. */
  drawDeleteDragArrow(
    from: { x: number; y: number },
    to: { x: number; y: number },
    hasValidTarget: boolean
  ): void {
    const ctx = this.ctx;
    const red = "rgba(210, 45, 45, 0.85)";

    ctx.save();
    this.camera.applyToContext(ctx);
    ctx.setLineDash([5, 4]);

    // Outline fosc
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth   = 5;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // Línia vermella
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = red;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = red;
    ctx.lineWidth   = 2.5;

    if (hasValidTarget) {
      // X (confirma que s'eliminarà l'ordre)
      const s = 9;
      ctx.beginPath();
      ctx.moveTo(to.x - s, to.y - s);
      ctx.lineTo(to.x + s, to.y + s);
      ctx.moveTo(to.x + s, to.y - s);
      ctx.lineTo(to.x - s, to.y + s);
      ctx.stroke();
    } else {
      // Cercle petit (drag actiu, sense destí vàlid)
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(to.x, to.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Dibuixar una fletxa de cursor (drag en curs) */
  drawDragArrow(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string
  ): void {
    const ctx = this.ctx;
    const darkColor = darkenColor(color, 0.72);

    ctx.save();
    this.camera.applyToContext(ctx);
    ctx.setLineDash([5, 4]);

    // Outline fosc
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.fillStyle   = "rgba(0,0,0,0.55)";
    ctx.lineWidth   = 5;
    drawArrowLine(ctx, from.x, from.y, to.x, to.y);

    // Color del jugador
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = darkColor;
    ctx.fillStyle   = darkColor;
    ctx.lineWidth   = 2;
    drawArrowLine(ctx, from.x, from.y, to.x, to.y);

    ctx.restore();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Fosc el color hexadecimal #RRGGBB multiplicant cada canal per `factor` (0–1). */
function darkenColor(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/** Dibuixar un rectangle amb cantonades arrodonides al path actual. */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function drawArrowLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 12;
  const margin = HEX_SIZE / 3;

  // Calcular els punts ajustats amb un marge de 1/3 del radi de l'hexàgon
  const startX = x1 + margin * Math.cos(angle);
  const startY = y1 + margin * Math.sin(angle);

  // El punt final de la línia s'ajusta pel marge i per deixar un petit espai d'encavalcament amb el cap
  const endX = x2 - margin * Math.cos(angle) - Math.cos(angle) * 5;
  const endY = y2 - margin * Math.sin(angle) - Math.sin(angle) * 5;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Cap de fletxa
  ctx.setLineDash([]);
  ctx.beginPath();
  // La punta de la fletxa se situa exactament al límit del marge de l'hexàgon destí
  const arrowTipX = x2 - margin * Math.cos(angle);
  const arrowTipY = y2 - margin * Math.sin(angle);

  ctx.moveTo(arrowTipX, arrowTipY);
  ctx.lineTo(arrowTipX - headLen * Math.cos(angle - Math.PI / 6), arrowTipY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(arrowTipX - headLen * Math.cos(angle + Math.PI / 6), arrowTipY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}
