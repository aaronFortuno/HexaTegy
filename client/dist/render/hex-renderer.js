/**
 * HexRenderer — dibuixa el grid hexagonal al Canvas.
 *
 * Usa hexàgons de punta plana (flat-top) en coordenades axials.
 * La conversió axial → píxel segueix la fórmula estàndard de RedBlobGames.
 */
const HEX_SIZE = 48; // radi exterior en píxels (sense zoom)
// ─── Conversió axial → píxel (flat-top) ──────────────────────────────────────
export function hexToPixel(q, r, size = HEX_SIZE) {
    return {
        x: size * (3 / 2 * q),
        y: size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r),
    };
}
/** Convertir coordenades de píxel (món) a coordenades axials aproximades */
export function pixelToHex(x, y, size = HEX_SIZE) {
    const q = (2 / 3 * x) / size;
    const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / size;
    return hexRound(q, r);
}
function hexRound(q, r) {
    const s = -q - r;
    let rq = Math.round(q);
    let rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q);
    const dr = Math.abs(rr - r);
    const ds = Math.abs(rs - s);
    if (dq > dr && dq > ds)
        rq = -rr - rs;
    else if (dr > ds)
        rr = -rq - rs;
    return { q: rq, r: rr };
}
/** Vèrtexs d'un hexàgon flat-top centrat a (cx, cy) */
function hexVertices(cx, cy, size) {
    return Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 180) * (60 * i);
        return [cx + size * Math.cos(angle), cy + size * Math.sin(angle)];
    });
}
// ─── Renderitzador principal ──────────────────────────────────────────────────
export class HexRenderer {
    canvas;
    ctx;
    camera;
    /** Regió seleccionada (per planificar ordres) */
    selectedRegionId = null;
    /** Regions destacades (veïnes de la selecció) */
    highlightedRegionIds = new Set();
    /** Regió objectiu d'un drag dret: s'il·luminarà en vermell per confirmar eliminació */
    deleteTargetRegionId = null;
    /** Jugador local: només les seves regions mostren la producció */
    myPlayerId = null;
    /** Configuració de joc: necessària per calcular la producció */
    config = null;
    /** Mirall client-side del controlStreak de production.ts */
    ownerStreak = new Map();
    /**
     * Actualitza el comptador de rondes de control continu per cada regió.
     * S'ha de cridar un cop per ronda nova, just quan arriba el ROUND_START,
     * per sincronitzar-se amb applyProduction del servidor.
     */
    updateOwnerStreak(regions) {
        for (const region of regions) {
            if (!region.ownerId) {
                this.ownerStreak.delete(region.id);
                continue;
            }
            const streak = this.ownerStreak.get(region.id);
            if (streak && streak.ownerId === region.ownerId) {
                streak.rounds++;
            }
            else {
                this.ownerStreak.set(region.id, { ownerId: region.ownerId, rounds: 1 });
            }
        }
    }
    /** Reinicia el streak quan comença una nova partida */
    resetOwnerStreak() {
        this.ownerStreak.clear();
    }
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.camera = camera;
    }
    render(regions, players) {
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
    drawRegion(ctx, region, playerColor, allRegions) {
        const { x, y } = hexToPixel(region.coord.q, region.coord.r);
        const size = HEX_SIZE - 2; // marge entre cel·les
        const verts = hexVertices(x, y, size);
        ctx.beginPath();
        ctx.moveTo(verts[0][0], verts[0][1]);
        for (let i = 1; i < 6; i++)
            ctx.lineTo(verts[i][0], verts[i][1]);
        ctx.closePath();
        // Omplir
        const isSelected = region.id === this.selectedRegionId;
        const isHighlighted = this.highlightedRegionIds.has(region.id);
        if (region.ownerId) {
            const base = playerColor.get(region.ownerId) ?? "#888";
            ctx.fillStyle = isSelected ? lighten(base, 0.3) : isHighlighted ? lighten(base, 0.15) : base;
        }
        else {
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
    regionAt(px, py, regions) {
        const world = this.camera.canvasToWorld(px, py);
        const { q, r } = pixelToHex(world.x, world.y);
        return regions.find((reg) => reg.coord.q === q && reg.coord.r === r) ?? null;
    }
    resize() {
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
function calcProduction(region, allRegions, config, streakRounds) {
    const ownedNeighbors = region.neighbors.filter((nId) => {
        const neighbor = allRegions.find((r) => r.id === nId);
        return neighbor?.ownerId === region.ownerId;
    });
    const base = config.baseProduction + ownedNeighbors.length * config.productionPerNeighbor;
    const bonus = streakRounds >= config.bonusAfterRounds ? config.bonusTroops : 0;
    return base + bonus;
}
// ─── Utilitats de color ───────────────────────────────────────────────────────
function lighten(hex, amount) {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * amount));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
    const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
    return `rgb(${r},${g},${b})`;
}
