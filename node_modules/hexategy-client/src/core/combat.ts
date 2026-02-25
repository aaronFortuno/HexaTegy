/**
 * Resolució de combats simultanis.
 *
 * Tots els moviments s'executen alhora. Si múltiples jugadors
 * ataquen la mateixa regió, els atacs s'acumulen.
 */

import { Region, GameConfig, MoveOrder, RoundResult } from "../network/protocol.js";

interface AttackGroup {
  toRegionId: string;
  attacks: Array<{ playerId: string; fromRegionId: string; troops: number }>;
}

export function resolveRound(
  regions: Region[],
  orders: Array<MoveOrder & { playerId: string }>,
  config: GameConfig
): RoundResult {
  const regionById = new Map(regions.map((r) => [r.id, r]));

  // Pre-càlcul: limitar el total de tropes per regió origen de forma proporcional.
  // Evita que múltiples ordres des del mateix origen creïn tropes del no-res
  // quan el total sol·licitat supera les tropes disponibles (−1 guardia).
  const totalBySource = new Map<string, number>();
  for (const order of orders) {
    totalBySource.set(
      order.fromRegionId,
      (totalBySource.get(order.fromRegionId) ?? 0) + order.troops,
    );
  }
  for (const [srcId, total] of totalBySource.entries()) {
    const src = regionById.get(srcId);
    if (!src) continue;
    const available = Math.max(0, src.troops - 1);
    if (total > available && total > 0) {
      const scale = available / total;
      for (const order of orders) {
        if (order.fromRegionId === srcId) {
          order.troops = Math.max(0, Math.floor(order.troops * scale));
        }
      }
    }
  }

  // Agrupar ordres per regió destí
  const attackMap = new Map<string, AttackGroup>();
  const moveMap = new Map<string, Array<{ playerId: string; fromId: string; troops: number }>>();

  // Separar moviments amistosos d'atacs
  for (const order of orders) {
    const from = regionById.get(order.fromRegionId);
    const to = regionById.get(order.toRegionId);
    if (!from || !to) continue;
    if (!from.neighbors.includes(to.id)) continue; // no adjacents, ignorar

    // Clamp: no enviar més tropes de les disponibles
    const troops = Math.min(order.troops, Math.max(0, from.troops - 1));
    if (troops <= 0) continue;

    if (to.ownerId === order.playerId) {
      // Moviment amic
      if (!moveMap.has(to.id)) moveMap.set(to.id, []);
      moveMap.get(to.id)!.push({ playerId: order.playerId, fromId: from.id, troops });
      from.troops -= troops; // reservar tropes
    } else {
      // Atac
      if (!attackMap.has(to.id)) {
        attackMap.set(to.id, { toRegionId: to.id, attacks: [] });
      }
      attackMap.get(to.id)!.attacks.push({ playerId: order.playerId, fromRegionId: from.id, troops });
      from.troops -= troops;
    }
  }

  const deltas: RoundResult["regionDeltas"] = [];
  const eliminated = new Set<string>();

  // Processar atacs
  for (const [regionId, group] of attackMap.entries()) {
    const region = regionById.get(regionId)!;
    const result = resolveAttack(region, group.attacks, config);
    region.ownerId = result.newOwnerId;
    region.troops = result.newTroops;
    deltas.push({
      regionId,
      newOwnerId: result.newOwnerId,
      newTroops: result.newTroops,
      attackers: group.attacks.map((a) => ({ playerId: a.playerId, troops: a.troops })),
    });
  }

  // Processar moviments amistosos
  for (const [regionId, moves] of moveMap.entries()) {
    const region = regionById.get(regionId)!;
    for (const move of moves) {
      region.troops += move.troops;
    }
    const existing = deltas.find((d) => d.regionId === regionId);
    if (existing) {
      existing.newTroops = region.troops;
    } else {
      deltas.push({
        regionId,
        newOwnerId: region.ownerId,
        newTroops: region.troops,
        attackers: [],
      });
    }
  }

  // Detectar jugadors eliminats (sense regions)
  const regionOwners = new Set(regions.map((r) => r.ownerId).filter(Boolean));
  for (const region of regions) {
    if (region.ownerId && !regionOwners.has(region.ownerId)) {
      eliminated.add(region.ownerId);
    }
  }

  return {
    round: 0, // el round el posa AdminHost
    regionDeltas: deltas,
    eliminated: [...eliminated],
    winner: null,
  };
}

interface AttackResult {
  newOwnerId: string | null;
  newTroops: number;
}

function resolveAttack(
  defender: Region,
  attacks: Array<{ playerId: string; troops: number }>,
  config: GameConfig
): AttackResult {
  const totalAttack = attacks.reduce((sum, a) => sum + a.troops, 0);
  const defTroops = defender.troops;

  // Cas especial: cel·la buida (sense defensor).
  // L'atacant ocupa amb totes les tropes enviades — no hi ha combat.
  // Sense aquest cas, Math.round(N × 0.45) pot ser 0 i el "defensor buit"
  // guanyaria, deixant la regió neutral per sempre (Bug: regions amb 1 tropa
  // que no canvien de propietari, sense color ni producció).
  if (defTroops === 0) {
    const dominant = attacks.reduce((a, b) => (a.troops > b.troops ? a : b));
    return { newOwnerId: dominant.playerId, newTroops: totalAttack };
  }

  const defAdvantage = config.defenseAdvantage; // ex: 0.55

  // Combat probabilístic: cada "unitat" té chance de survivre
  const attackSurviveRate = 1 - defAdvantage;
  const defendSurviveRate = defAdvantage;

  const attackSurvivors = Math.round(totalAttack * attackSurviveRate);
  const defSurvivors = Math.round(defTroops * defendSurviveRate);

  if (attackSurvivors > defSurvivors) {
    // Atac guanya: elegir el jugador dominant (el que ha enviat més tropes)
    const dominant = attacks.reduce((a, b) => (a.troops > b.troops ? a : b));
    return { newOwnerId: dominant.playerId, newTroops: Math.max(1, attackSurvivors - defSurvivors) };
  } else {
    // Defensa aguanta
    return { newOwnerId: defender.ownerId, newTroops: Math.max(1, defSurvivors - attackSurvivors) };
  }
}
