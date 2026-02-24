/**
 * Producció de tropes per ronda.
 *
 * Cada regió controlada genera tropes en funció de:
 * - Producció base configurable
 * - Bonus per veïns controlats pel mateix jugador
 * - Bonus per control continuat de X rondes
 */

import { Region, GameConfig } from "../network/protocol.js";

// Registre de rondes continues de control per regió
const controlStreak = new Map<string, { ownerId: string; rounds: number }>();

export function applyProduction(regions: Region[], config: GameConfig): void {
  for (const region of regions) {
    if (!region.ownerId) continue;

    let production = config.baseProduction;

    // Bonus per veïns controlats pel mateix jugador
    const ownedNeighbors = region.neighbors.filter((nId) => {
      const neighbor = regions.find((r) => r.id === nId);
      return neighbor?.ownerId === region.ownerId;
    });
    production += ownedNeighbors.length * config.productionPerNeighbor;

    // Bonus per control continuat
    const streak = controlStreak.get(region.id);
    if (streak && streak.ownerId === region.ownerId) {
      streak.rounds++;
      if (streak.rounds >= config.bonusAfterRounds) {
        production += config.bonusTroops;
      }
    } else {
      controlStreak.set(region.id, { ownerId: region.ownerId, rounds: 1 });
    }

    region.troops += production;
  }
}

/** Reiniciar el registre de control (nova partida) */
export function resetProductionState(): void {
  controlStreak.clear();
}
