/**
 * Arrows — fletxes de planificació i animació de resolució.
 *
 * Les fletxes de planificació es dibuixen sobre el canvas en temps real
 * mentre el jugador arrossega. Les d'animació es mostren durant la resolució.
 */

import { Region } from "../network/protocol.js";
import { Camera } from "./camera.js";
import { hexToPixel } from "./hex-renderer.js";

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
    const color = arrow.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.85;
    ctx.setLineDash([6, 4]);

    drawArrowLine(ctx, from.x, from.y, to.x, to.y);

    // Etiqueta de tropes
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";

    ctx.fillText(String(arrow.troops), mx + 2, my + 2);
    ctx.fillStyle = color;
    ctx.fillText(String(arrow.troops), mx, my);
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

  /** Dibuixar una fletxa de cursor (drag en curs) */
  drawDragArrow(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: string
  ): void {
    const ctx = this.ctx;
    ctx.save();
    this.camera.applyToContext(ctx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.setLineDash([5, 4]);
    drawArrowLine(ctx, from.x, from.y, to.x, to.y);
    ctx.restore();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drawArrowLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 12;
  const endX = x2 - Math.cos(angle) * 14;
  const endY = y2 - Math.sin(angle) * 14;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  // Cap de fletxa
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}
