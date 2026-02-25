/**
 * Generació del mapa hexagonal.
 *
 * Usa coordenades axials (q, r) per representar el grid.
 * Vegeu: https://www.redblobgames.com/grids/hexagons/
 */
// ─── Coordenades axials ───────────────────────────────────────────────────────
/** Distància entre dues cel·les en coordenades axials (mètrica hex) */
export function hexDistance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}
/** Les 6 direccions axials veïnes */
export const HEX_DIRECTIONS = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];
export function hexNeighbors(coord) {
    return HEX_DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}
function coordKey(c) {
    return `${c.q},${c.r}`;
}
// ─── Generació del mapa ───────────────────────────────────────────────────────
/**
 * Genera un mapa hexagonal de radi `radius` i assigna regions inicials
 * als jugadors indicats.
 */
export function generateMap(playerIds, config) {
    const radius = Math.max(3, Math.min(8, config.mapSize ?? 5));
    const cells = generateHexGrid(radius);
    const coordMap = new Map(cells.map((c) => [coordKey(c), c]));
    // Construir adjacències
    const regionMap = new Map();
    const regions = cells.map((coord, i) => {
        const region = {
            id: `r${i}`,
            coord,
            ownerId: null,
            troops: 0,
            neighbors: [],
        };
        regionMap.set(coordKey(coord), region);
        return region;
    });
    // Assignar veïns
    for (const region of regions) {
        region.neighbors = hexNeighbors(region.coord)
            .filter((n) => coordMap.has(coordKey(n)))
            .map((n) => regionMap.get(coordKey(n)).id);
    }
    // Col·locar jugadors (amb expansió si startRegions > 1)
    const startRegions = Math.max(1, config.startRegions ?? 1);
    if (config.startPlacement === "random") {
        placePlayersRandom(regions, playerIds, startRegions);
    }
    else {
        placePlayersClustered(regions, playerIds, startRegions);
    }
    return regions;
}
/** Genera totes les cel·les d'un grid hexagonal de radi `r` (centre + anells) */
function generateHexGrid(r) {
    const cells = [];
    for (let q = -r; q <= r; q++) {
        for (let row = Math.max(-r, -q - r); row <= Math.min(r, -q + r); row++) {
            cells.push({ q, r: row });
        }
    }
    return cells;
}
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
function placePlayersRandom(regions, playerIds, startRegions) {
    const shuffled = shuffle(regions);
    for (let i = 0; i < playerIds.length && i < shuffled.length; i++) {
        shuffled[i].ownerId = playerIds[i];
        shuffled[i].troops = 3;
    }
    if (startRegions > 1)
        expandTerritories(regions, playerIds, startRegions - 1);
}
function placePlayersClustered(regions, playerIds, startRegions) {
    // Seleccionar punts de partida distribuïts equidistantment al perímetre
    const perimeter = regions.filter((r) => hexDistance(r.coord, { q: 0, r: 0 }) >= Math.floor(Math.max(...regions.map((x) => hexDistance(x.coord, { q: 0, r: 0 }))) * 0.6));
    const starts = shuffle(perimeter).slice(0, playerIds.length);
    for (let i = 0; i < playerIds.length; i++) {
        if (starts[i]) {
            starts[i].ownerId = playerIds[i];
            starts[i].troops = 3;
        }
    }
    if (startRegions > 1)
        expandTerritories(regions, playerIds, startRegions - 1);
}
/**
 * Expandeix el territori inicial de cada jugador afegint `extraCount` regions
 * adjacents per jugador, de manera alternada i aleatòria.
 * En cas de conflicte (dos jugadors volen la mateixa regió), guanya
 * qui la demana primer en l'ordre aleatori del torn.
 */
function expandTerritories(regions, playerIds, extraCount) {
    const regionById = new Map(regions.map((r) => [r.id, r]));
    for (let step = 0; step < extraCount; step++) {
        for (const playerId of shuffle([...playerIds])) {
            const candidates = [];
            const seen = new Set();
            for (const r of regions) {
                if (r.ownerId !== playerId)
                    continue;
                for (const nId of r.neighbors) {
                    if (seen.has(nId))
                        continue;
                    seen.add(nId);
                    const n = regionById.get(nId);
                    if (n && !n.ownerId)
                        candidates.push(n);
                }
            }
            if (candidates.length > 0) {
                const pick = candidates[Math.floor(Math.random() * candidates.length)];
                pick.ownerId = playerId;
                pick.troops = 3;
            }
        }
    }
}
