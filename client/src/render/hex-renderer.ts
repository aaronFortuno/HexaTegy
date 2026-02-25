/**
 * HexRenderer — dibuixa el grid hexagonal al Canvas.
 *
 * Usa hexàgons de punta plana (flat-top) en coordenades axials.
 * La conversió axial → píxel segueix la fórmula estàndard de RedBlobGames.
 */

import { Region, PlayerInfo, GameConfig } from "../network/protocol.js";
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

  /** Regió objectiu d'un drag dret: s'il·luminarà en vermell per confirmar eliminació */
  deleteTargetRegionId: string | null = null;

  /** Jugador local: només les seves regions mostren la producció */
  myPlayerId: string | null = null;

  /** Configuració de joc: necessària per calcular la producció */
  config: GameConfig | null = null;

  /** Mirall client-side del controlStreak de production.ts */
  private ownerStreak = new Map<string, { ownerId: string; rounds: number }>();

  /**
   * Actualitza el comptador de rondes de control continu per cada regió.
   * S'ha de cridar un cop per ronda nova, just quan arriba el ROUND_START,
   * per sincronitzar-se amb applyProduction del servidor.
   */
  updateOwnerStreak(regions: Region[]): void {
    for (const region of regions) {
      if (!region.ownerId) {
        this.ownerStreak.delete(region.id);
        continue;
      }
      const streak = this.ownerStreak.get(region.id);
      if (streak && streak.ownerId === region.ownerId) {
        streak.rounds++;
      } else {
        this.ownerStreak.set(region.id, { ownerId: region.ownerId, rounds: 1 });
      }
    }
  }

  /** Reinicia el streak quan comença una nova partida */
  resetOwnerStreak(): void {
    this.ownerStreak.clear();
  }

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
      this.drawRegion(ctx, region, playerColor, regions);
    }

    ctx.restore();
  }

  private drawRegion(
    ctx: CanvasRenderingContext2D,
    region: Region,
    playerColor: Map<string, string>,
    allRegions: Region[]
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

    // Overlay d'eliminació (drag dret apuntant a aquesta cel·la)
    if (region.id === this.deleteTargetRegionId) {
      ctx.fillStyle = "rgba(210, 45, 45, 0.35)";
      ctx.fill();
      ctx.strokeStyle = "rgba(210, 45, 45, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Nombre de tropes
    if (region.troops > 0) {
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(11, HEX_SIZE * 0.3)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(region.troops), x, y);
    }

    // Producció prevista (visible únicament per al jugador propietari)
    if (region.ownerId && region.ownerId === this.myPlayerId && this.config) {
      const streakRounds = (() => {
        const s = this.ownerStreak.get(region.id);
        return s?.ownerId === region.ownerId ? s.rounds : 0;
      })();
      const prod = calcProduction(region, allRegions, this.config, streakRounds);
      // Ancla prop del vèrtex superior-esquerre (angle 240°), amb marge interior
      const lx = x - size * 0.44;
      const ly = y - size * 0.60;
      const label = `+${prod}`;
      ctx.font = `bold 9px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      // Ombra lleugera per llegibilitat sobre qualsevol color de fons
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 3;
      ctx.fillStyle = "rgba(255,255,255,0.90)";
      ctx.fillText(label, lx, ly);
      ctx.shadowBlur = 0;
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

// ─── Càlcul de producció (client-side, sense streak de servidor) ──────────────

/**
 * Producció d'una regió: base + bonus per veïns + bonus de streak.
 * streakRounds ha de ser el nombre de rondes consecutives de control
 * (mirall de production.ts::controlStreak, actualitzat via updateOwnerStreak).
 */
function calcProduction(
  region: Region,
  allRegions: Region[],
  config: GameConfig,
  streakRounds: number,
): number {
  const ownedNeighbors = region.neighbors.filter((nId) => {
    const neighbor = allRegions.find((r) => r.id === nId);
    return neighbor?.ownerId === region.ownerId;
  });
  const base = config.baseProduction + ownedNeighbors.length * config.productionPerNeighbor;
  const bonus = streakRounds >= config.bonusAfterRounds ? config.bonusTroops : 0;
  return base + bonus;
}

// ─── Utilitats de color ───────────────────────────────────────────────────────

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `rgb(${r},${g},${b})`;
}
