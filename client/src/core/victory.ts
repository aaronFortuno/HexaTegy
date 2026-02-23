/**
 * Avaluació de condicions de victòria.
 */

import { Region, PlayerInfo, GameConfig } from "../network/protocol.js";

/**
 * Retorna l'id del jugador guanyador, o null si la partida continua.
 */
export function checkVictory(
  regions: Region[],
  players: PlayerInfo[],
  config: GameConfig,
  round: number
): string | null {
  const activePlayers = players.filter((p) => !p.isEliminated);
  if (activePlayers.length === 0) return null;
  if (activePlayers.length === 1) return activePlayers[0].id;

  switch (config.victoryCondition) {
    case "total_conquest":
      return checkTotalConquest(regions, activePlayers);

    case "score_rounds":
      if (config.maxRounds && round >= config.maxRounds) {
        return getLeader(regions, activePlayers);
      }
      return null;

    case "map_percent": {
      const target = config.victoryParam / 100; // ex: 0.75 per 75%
      return checkMapPercent(regions, activePlayers, target);
    }

    case "hill_control":
      return checkHillControl(regions, activePlayers, config, round);

    default:
      return null;
  }
}

function regionsByPlayer(regions: Region[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of regions) {
    if (r.ownerId) counts.set(r.ownerId, (counts.get(r.ownerId) ?? 0) + 1);
  }
  return counts;
}

function checkTotalConquest(regions: Region[], activePlayers: PlayerInfo[]): string | null {
  const counts = regionsByPlayer(regions);
  const total = regions.length;
  for (const player of activePlayers) {
    if ((counts.get(player.id) ?? 0) === total) return player.id;
  }
  return null;
}

function checkMapPercent(regions: Region[], activePlayers: PlayerInfo[], target: number): string | null {
  const counts = regionsByPlayer(regions);
  const total = regions.length;
  for (const player of activePlayers) {
    if ((counts.get(player.id) ?? 0) / total >= target) return player.id;
  }
  return null;
}

function getLeader(regions: Region[], activePlayers: PlayerInfo[]): string | null {
  const counts = regionsByPlayer(regions);
  let leader: string | null = null;
  let max = -1;
  for (const player of activePlayers) {
    const c = counts.get(player.id) ?? 0;
    if (c > max) { max = c; leader = player.id; }
  }
  return leader;
}

// ─── Hill control ─────────────────────────────────────────────────────────────
// La "hill region" és la cel·la central (q=0, r=0)
const hillControlStreak = new Map<string, number>(); // playerId → rondes consecutives

export function checkHillControl(
  regions: Region[],
  activePlayers: PlayerInfo[],
  config: GameConfig,
  _round: number
): string | null {
  const hill = regions.find((r) => r.coord.q === 0 && r.coord.r === 0);
  if (!hill || !hill.ownerId) return null;

  const current = hill.ownerId;
  const streak = hillControlStreak.get(current) ?? 0;
  hillControlStreak.set(current, streak + 1);

  // Reiniciar altres
  for (const p of activePlayers) {
    if (p.id !== current) hillControlStreak.set(p.id, 0);
  }

  if ((hillControlStreak.get(current) ?? 0) >= config.victoryParam) {
    return current;
  }
  return null;
}

export function resetVictoryState(): void {
  hillControlStreak.clear();
}
