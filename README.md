# HexaTegy

Joc d'estratègia territorial per torns simultanis en temps real, jugat íntegrament al navegador, accessible [aquí](https://aaronfortuno.github.io/HexaTegy/).

---

## Arquitectura tècnica

### Model Admin-as-Host

```
[Jugador A]──┐
[Jugador B]──┼──► [Relay WS Server] ◄──► [Navegador Admin]
[Jugador C]──┘      (sense estat)         (tota la lògica)
```

- **Relay server**: servidor WebSocket mínim i sense estat. Només encamina missatges per sala. No emmagatzema res.
- **Navegador admin**: autoritat del joc. Genera el mapa, resol combats, difon l'estat.
- **Jugadors**: reben l'estat de l'admin i envien les seves ordres via relay.

### Stack

| Capa | Tecnologia | Justificació |
|------|-----------|--------------|
| Build / Dev | Vite + TypeScript | Ràpid, modern, excellent DX |
| Render hex | Canvas API | Millor rendiment que SVG/DOM per grids grans |
| UI | HTML + CSS natiu | Sense framework pesat; la lògica no necessita reactivitat |
| Relay server | Bun + `ws` | Mínim, ràpid, un únic fitxer |
| Temes | CSS Custom Properties | Clar/fosc sense JS extra |
| i18n | Mòduls TS propis | Sense llibreries externes |

---

## Estructura de carpetes

```
hexategy/
├── server/
│   ├── relay.ts          # Relay WebSocket: encamina per sala, sense estat de joc
│   └── package.json
│
└── client/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.ts               # Punt d'entrada; router de vistes
        │
        ├── core/
        │   ├── map.ts            # Generació del mapa hexagonal (coordenades axials)
        │   ├── game.ts           # Màquina d'estats: lobby → planning → resolving → end
        │   ├── combat.ts         # Resolució de combats (avantatge defensiu configurable)
        │   ├── production.ts     # Producció de tropes per regió/ronda
        │   └── victory.ts        # Avaluació de condicions de victòria
        │
        ├── network/
        │   ├── protocol.ts       # Tipus de missatges WS (enums + interfícies TS)
        │   ├── relay-client.ts   # Connexió WS del jugador/admin al relay
        │   └── admin-host.ts     # Lògica admin: rep ordres, processa, difon estat
        │
        ├── render/
        │   ├── camera.ts         # Zoom + pan sobre el canvas
        │   ├── hex-renderer.ts   # Dibuixa el grid hexagonal al Canvas
        │   ├── arrows.ts         # Fletxes de planificació i animacions d'atac
        │   └── ui-overlay.ts     # HUD: comptador, scores, noms sobre el canvas
        │
        ├── input/
        │   └── input-handler.ts  # Click + drag per planificar moviments
        │
        ├── ui/
        │   ├── header.ts         # Nom del joc + icona historial de versions
        │   ├── version-history.ts # Modal amb historial de versions
        │   ├── lobby.ts          # Pantalla de sala: crear/unir-se, config
        │   ├── config-panel.ts   # Panell de configuració (admin)
        │   └── end-screen.ts     # Pantalla de fi de partida / rànquing temporal
        │
        ├── i18n/
        │   ├── index.ts          # t() helper i detecció d'idioma
        │   ├── ca.ts             # Català (per defecte)
        │   ├── es.ts             # Castellà
        │   └── en.ts             # English
        │
        └── styles/
            ├── variables.css     # Design tokens: colors, tipografia, radis
            ├── main.css          # Reset + layout base
            └── components/
                ├── lobby.css
                ├── hud.css
                └── version-history.css
```

---

## Protocol de missatges WebSocket

### Admin → Jugadors

| Missatge | Contingut |
|----------|-----------|
| `game:state` | Estat complet al connectar |
| `round:start` | Nova ronda, comptador inicia |
| `round:resolve` | Resultat de la ronda + diff d'estat |
| `game:over` | Guanyador i rànquing final |
| `player:joined` | Nou jugador a la sala |
| `player:left` | Jugador desconnectat |

### Jugadors → Admin

| Missatge | Contingut |
|----------|-----------|
| `player:ready` | Llest per iniciar |
| `player:orders` | Llista de moviments planificats |
| `player:cancel` | Cancel·lar un moviment |

---

## Flux d'una ronda

```
1. Admin difon round:start + estat actual
2. [Timer configurable: 5–30s] Jugadors planifiquen (click + arrossegament)
3. En expirar: jugadors envien player:orders
4. Admin resol combats simultàniament
5. Admin difon round:resolve amb diff d'estat
6. Canvas anima el resultat (~2s)
7. Tornem a 1 (o game:over si es compleix condició de victòria)
```

---

## Sistema de combat

- Base: 45% atacant / 55% defensor (configurable)
- Múltiples atacs simultanis a la mateixa regió: s'acumulen i resolen junts
- Tropes restants es redistribueixen proporcionalment

---

## Condicions de victòria (configurables)

- Conquesta total del mapa
- Màxima puntuació al cap de X rondes
- Controlar un % del mapa
- Control continu de la "regió clau" (hill control)

---

## Internacionalització

Idiomes suportats: **Català** (per defecte), **Castellà**, **Anglès**.

---

## Historial de versions

Accessible des de la interfície mitjançant una icona discreta (`⊕`) al costat del nom del joc, a la cantonada superior esquerra.

---

## Zoom i navegació del mapa

- **Roda del ratolí**: zoom in/out centrat al cursor
- **Click + arrossegament (mà)**: pan per moure's pel mapa
- **Botons HUD**: `+` / `−` / reset de zoom
- Límits de zoom configurables per evitar desorientació

---

## Desenvolupament local

```bash
# Instal·lar dependències del client (npm)
cd client && npm install --no-workspaces

# Iniciar el client (mode Local — sense servidor)
cd client && npx vite
```

Obre dues pestanyes al navegador. A la primera, crea una sala en **Mode Local**. A la segona, entra el codi generat i uneix-te. No cal cap servidor addicional.

### Mode en xarxa (opcional)

Per jugar entre màquines diferents cal el servidor relay:

```bash
# Requereix bun (https://bun.sh) o adaptar a Node.js
cd server && bun install && bun run relay.ts

# Seleccionar "En xarxa" al lobby del client
```

---

## Historial de versions

| Versió | Data | Canvis |
|--------|------|--------|
| 0.1.0 | 2026-02-22 | Esquelet inicial del projecte |
