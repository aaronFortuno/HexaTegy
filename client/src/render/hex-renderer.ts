/**
 * HexRenderer — dibuixa el grid hexagonal al Canvas.
 *
 * Usa hexàgons de punta plana (flat-top) en coordenades axials.
 * La conversió axial → píxel segueix la fórmula estàndard de RedBlobGames.
 */

import { Region, PlayerInfo } from "../network/protocol.js";
import { Camera } from "./camera.js";

const HEX_SIZE = 48; // radi exterior en píxels (sense zoom)

// ─── Conversió axial → píxel (flat-top) ──────────────────────────────────────

export function hexToPixel(q: number, r: number, size = HEX_SIZE): { x: number; y: number } {
  return {
    x: size * (3 / 2 * q),
    y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
  };
}

/** Convertir coordenades de píxel (món) a coordenades axials aproximades */
export function pixelToHex(x: number, y: number, size = HEX_SIZE): { q: number; r: number } {
  const q = (2 / 3 * x) / size;
  const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
  return hexRound(q, r);
}

function hexRound(q: number, r: number): { q: number; r: number } {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

/** Vèrtexs d'un hexàgon flat-top centrat a (cx, cy) */
function hexVertices(cx: number, cy: number, size: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)];
  });
}

// ─── Renderitzador principal ──────────────────────────────────────────────────

export class HexRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;

  /** Regió seleccionada (per planificar ordres) */
  selectedRegionId: string | null = null;

  /** Regions destacades (veïnes de la selecció) */
  highlightedRegionIds: Set<string> = new Set();

  constructor(canvas: HTMLCanvasElement, camera: Camera) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.camera = camera;
  }

  render(regions: Region[], players: PlayerInfo[]): void {
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    this.camera.applyToContext(ctx);

    const playerColor = new Map(players.map((p) => [p.id, p.color]));

    for (const region of regions) {
      this.drawRegion(ctx, region, playerColor);
    }

    ctx.restore();
  }

  private drawRegion(
    ctx: CanvasRenderingContext2D,
    region: Region,
    playerColor: Map<string, string>
  ): void {
    const { x, y } = hexToPixel(region.coord.q, region.coord.r);
    const size = HEX_SIZE - 2; // marge entre cel·les

    const verts = hexVertices(x, y, size);
    ctx.beginPath();
    ctx.moveTo(verts[0][0], verts[0][1]);
    for (let i = 1; i < 6; i++) ctx.lineTo(verts[i][0], verts[i][1]);
    ctx.closePath();

    // Omplir
    const isSelected = region.id === this.selectedRegionId;
    const isHighlighted = this.highlightedRegionIds.has(region.id);

    if (region.ownerId) {
      const base = playerColor.get(region.ownerId) ?? "#888";
      ctx.fillStyle = isSelected ? lighten(base, 0.3) : isHighlighted ? lighten(base, 0.15) : base;
    } else {
      ctx.fillStyle = isHighlighted ? "rgba(200,200,200,0.4)" : "rgba(120,120,120,0.3)";
    }
    ctx.fill();

    // Vora
    ctx.strokeStyle = isSelected ? "#fff" : "rgba(0,0,0,0.4)";
    ctx.lineWidth = isSelected ? 2.5 : 1.2;
    ctx.stroke();

    // Nombre de tropes
    if (region.troops > 0) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(11, HEX_SIZE * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(region.troops), x, y);
    }
  }

  /** Retorna la regió que conté el punt (px, py) en coordenades del canvas */
  regionAt(px: number, py: number, regions: Region[]): Region | null {
    const world = this.camera.canvasToWorld(px, py);
    const { q, r } = pixelToHex(world.x, world.y);
    return regions.find((reg) => reg.coord.q === q && reg.coord.r === r) ?? null;
  }

  resize(): void {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }
}

// ─── Utilitats de color ───────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}
