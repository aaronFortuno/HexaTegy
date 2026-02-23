/** Català — idioma per defecte */
export const ca = {
  // Capçalera
  "app.name": "HexaTegy",
  "app.version_history": "Historial de versions",

  // Lobby
  "lobby.title": "HexaTegy",
  "lobby.mode_local": "Local",
  "lobby.mode_online": "En xarxa",
  "lobby.mode_local_hint": "Juga en múltiples pestanyes al mateix navegador, sense servidor.",
  "lobby.mode_online_hint": "Requereix el servidor relay actiu (ws://localhost:3001).",
  "lobby.create": "Crear sala",
  "lobby.join": "Unir-se a sala",
  "lobby.room_code": "Codi de sala",
  "lobby.your_name": "El teu nom",
  "lobby.join_btn": "Unir-se",
  "lobby.create_btn": "Crear",
  "lobby.connecting": "Connectant…",
  "lobby.waiting": "Esperant jugadors…",
  "lobby.players": "Jugadors",
  "lobby.ready": "Llest",
  "lobby.start_game": "Iniciar partida",
  "lobby.room_created": "Sala creada:",
  "lobby.share_code": "Comparteix aquest codi",
  "lobby.not_found": "Sala no trobada",

  // Configuració
  "config.title": "Configuració",
  "config.round_duration": "Durada de ronda (s)",
  "config.max_rounds": "Rondes màximes (0 = il·limitades)",
  "config.base_production": "Producció base",
  "config.production_per_neighbor": "Bonus per veí controlat",
  "config.bonus_after_rounds": "Rondes per bonus continuat",
  "config.bonus_troops": "Tropes de bonus",
  "config.defense_advantage": "Avantatge defensor (0–1)",
  "config.victory_condition": "Condició de victòria",
  "config.victory_param": "Paràmetre de victòria",
  "config.start_placement": "Col·locació inicial",
  "config.placement_random": "Aleatòria",
  "config.placement_clustered": "Agrupada",
  "config.victory_total": "Conquesta total",
  "config.victory_score": "Puntuació per rondes",
  "config.victory_percent": "% del mapa",
  "config.victory_hill": "Control de la colina",
  "config.save": "Desar configuració",

  // Fases de joc
  "phase.lobby": "Sala d'espera",
  "phase.planning": "Planificació",
  "phase.resolving": "Resolent…",
  "phase.ended": "Partida acabada",

  // HUD
  "hud.round": "Ronda",
  "hud.submit_orders": "Confirmar ordres",
  "hud.cancel_all": "Cancel·lar tot",

  // Zoom
  "zoom.controls": "Controls de zoom",
  "zoom.in": "Apropar",
  "zoom.out": "Allunyar",
  "zoom.reset": "Reiniciar zoom",

  // Fi de partida
  "end.winner": "Guanyador",
  "end.ranking": "Classificació",
  "end.play_again": "Tornar a jugar",
  "end.new_room": "Nova sala",
  "end.regions": "regions",

  // Errors
  "error.connection": "Error de connexió",
  "error.room_not_found": "Sala no trobada",
  "error.generic": "S'ha produït un error",

  // Historial de versions
  "version.title": "Historial de versions",
  "version.close": "Tancar",
} as const;
