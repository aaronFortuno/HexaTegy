/**
 * Generació del mapa hexagonal.
 *
 * Usa coordenades axials (q, r) per representar el grid.
 * Vegeu: https://www.redblobgames.com/grids/hexagons/
 */

import { Region, HexCoord, GameConfig } from "../network/protocol.js";

// ─── Coordenades axials ───────────────────────────────────────────────────────

/** Distància entre dues cel·les en coordenades axials (mètrica hex) */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

/** Les 6 direccions axials veïnes */
export const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function hexNeighbors(coord: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((d) => ({ q: coord.q + d.q, r: coord.r + d.r }));
}

function coordKey(c: HexCoord): string {
  return `${c.q},${c.r}`;
}

// ─── Generació del mapa ───────────────────────────────────────────────────────

/**
 * Genera un mapa hexagonal de radi `radius` i assigna regions inicials
 * als jugadors indicats.
 */
export function generateMap(playerIds: string[], config: GameConfig, radius = 5): Region[] {
  const cells = generateHexGrid(radius);
  const coordMap = new Map(cells.map((c) => [coordKey(c), c]));

  // Construir adjacències
  const regionMap = new Map<string, Region>();
  const regions: Region[] = cells.map((coord, i) => {
    const region: Region = {
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
      .map((n) => regionMap.get(coordKey(n))!.id);
  }

  // Col·locar jugadors
  if (config.startPlacement === "random") {
    placePlayersRandom(regions, playerIds);
  } else {
    placePlayersClustered(regions, playerIds);
  }

  return regions;
}

/** Genera totes les cel·les d'un grid hexagonal de radi `r` (centre + anells) */
function generateHexGrid(r: number): HexCoord[] {
  const cells: HexCoord[] = [];
  for (let q = -r; q <= r; q++) {
    for (let row = Math.max(-r, -q - r); row <= Math.min(r, -q + r); row++) {
      cells.push({ q, r: row });
    }
  }
  return cells;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function placePlayersRandom(regions: Region[], playerIds: string[]): void {
  const shuffled = shuffle(regions);
  for (let i = 0; i < playerIds.length && i < shuffled.length; i++) {
    shuffled[i].ownerId = playerIds[i];
    shuffled[i].troops = 3;
  }
}

function placePlayersClustered(regions: Region[], playerIds: string[]): void {
  // Seleccionar punts de partida distribuïts equidistantment al perímetre
  const perimeter = regions.filter((r) =>
    hexDistance(r.coord, { q: 0, r: 0 }) >= Math.floor(Math.max(...regions.map((x) =>
      hexDistance(x.coord, { q: 0, r: 0 })
    )) * 0.6)
  );

  const starts = shuffle(perimeter).slice(0, playerIds.length);
  for (let i = 0; i < playerIds.length; i++) {
    if (starts[i]) {
      starts[i].ownerId = playerIds[i];
      starts[i].troops = 3;
    }
  }
}
