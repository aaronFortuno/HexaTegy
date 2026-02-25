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

/**
 * Aplica la producció de tropes a totes les regions controlades.
 *
 * @param skipTroopRegions  IDs de regions recentment conquistades aquest torn:
 *   s'actualitza el comptador de streak (per no perdre el compte) però NO
 *   s'afegeixen tropes — el jugador no genera producció el torn de la conquesta.
 */
export function applyProduction(
  regions: Region[],
  config: GameConfig,
  skipTroopRegions: Set<string> = new Set(),
): void {
  for (const region of regions) {
    if (!region.ownerId) continue;

    let production = config.baseProduction;

    // Bonus per veïns controlats pel mateix jugador
    const ownedNeighbors = region.neighbors.filter((nId) => {
      const neighbor = regions.find((r) => r.id === nId);
      return neighbor?.ownerId === region.ownerId;
    });
    production += ownedNeighbors.length * config.productionPerNeighbor;

    // Actualitzar streak (sempre, fins i tot per regions acabades de conquistar)
    const streak = controlStreak.get(region.id);
    if (streak && streak.ownerId === region.ownerId) {
      streak.rounds++;
      if (streak.rounds >= config.bonusAfterRounds) {
        production += config.bonusTroops;
      }
    } else {
      controlStreak.set(region.id, { ownerId: region.ownerId, rounds: 1 });
    }

    // No afegir tropes si la regió ha canviat de propietari durant l'últim torn
    if (skipTroopRegions.has(region.id)) continue;

    region.troops += production;
  }
}

/** Reiniciar el registre de control (nova partida) */
export function resetProductionState(): void {
  controlStreak.clear();
}
