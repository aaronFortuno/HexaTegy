# HexaTegy — Architecture Reference

> Browser-based real-time turn-based territorial strategy game with simultaneous gameplay.
> The admin's browser acts as the authoritative game server. No backend game logic.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Build | Vite 6.1, TypeScript 5.7 (strict) |
| Frontend | Vanilla TS + DOM (no framework) |
| Rendering | Canvas 2D API |
| Network (local) | BroadcastChannel API |
| Network (online) | WebSocket (`ws` 8.18) |
| Server | Bun + relay.ts (stateless) |
| i18n | Custom TS modules (ca / es / en) |
| Storage | localStorage |

---

## Directory Map

```
HexaTegy/
├── server/
│   └── relay.ts              # WebSocket relay — stateless room router
│
├── client/
│   ├── index.html            # Shell: #app-header, #app-root, #version-history-modal
│   ├── vite.config.ts        # Port 5173, base "./"
│   ├── tsconfig.json         # ES2022, strict, noUnusedLocals
│   └── src/
│       ├── main.ts           # ENTRY POINT — view router, subsystem init
│       │
│       ├── core/
│       │   ├── map.ts        # Hex grid generation (axial coords)
│       │   ├── game.ts       # GameClient — state machine + event emitter
│       │   ├── combat.ts     # Combat resolution (simultaneous)
│       │   ├── production.ts # Troop production per round
│       │   └── victory.ts    # Victory condition checks
│       │
│       ├── network/
│       │   ├── protocol.ts   # All TS interfaces and MsgType enum
│       │   ├── relay-client.ts  # WS client to relay server
│       │   ├── local-relay.ts   # BroadcastChannel relay (no server)
│       │   └── admin-host.ts    # Game authority (runs in admin's browser)
│       │
│       ├── render/
│       │   ├── hex-renderer.ts  # Draws hex grid, owners, troops
│       │   ├── camera.ts        # Zoom/pan (wheel + touch pinch)
│       │   ├── arrows.ts        # Planning & animated result arrows
│       │   └── ui-overlay.ts    # HUD: timer, phase, round, scoreboard
│       │
│       ├── input/
│       │   └── input-handler.ts # Click/drag order planning
│       │
│       ├── ui/
│       │   ├── lobby.ts         # Room create/join screen
│       │   ├── config-panel.ts  # Admin game config (collapsible <details>)
│       │   ├── header.ts        # App name, theme toggle, language selector
│       │   ├── end-screen.ts    # Results screen
│       │   └── version-history.ts # Changelog modal
│       │
│       ├── i18n/
│       │   ├── index.ts         # t(), initI18n(), setLocale(), onLocaleChange()
│       │   ├── ca.ts            # Catalan (default)
│       │   ├── es.ts            # Spanish
│       │   └── en.ts            # English
│       │
│       └── styles/
│           ├── variables.css    # Design tokens (colors, fonts, spacing)
│           ├── main.css         # Global reset + layout
│           └── components/
│               ├── lobby.css
│               ├── hud.css
│               └── version-history.css
│
└── package.json                 # Root workspace scripts
```

---

## Key Symbols Reference

Quick lookup: file → exported symbols.

### `client/src/main.ts`
- `showLobby()` — renders LobbyView, subscribes locale changes
- `showWaitingRoom(relay, roomCode, clientId, isAdmin)` — pre-game room
- `showGame(relay, clientId, isAdmin, adminHost)` — main canvas view, wires all subsystems
- `showEndScreen(relay, winnerId, game, adminHost)` — results + Play Again / Leave
- `RELAY_URL` — `import.meta.env.VITE_RELAY_URL || "ws://localhost:3001"`

### `client/src/core/map.ts`
- `generateMap(config, players)` — returns `Region[]`, assigns starting hexes
- `hexDistance(a, b)` — axial distance between two HexCoords
- `hexNeighbors(coord)` — returns 6 adjacent HexCoords
- `generateHexGrid(radius)` — raw grid without player assignment

### `client/src/core/game.ts`
- `class GameClient` — central state holder (non-admin clients)
  - `.on(event, cb)` — subscribe to: `"state:updated"`, `"round:started"`, `"round:resolved"`, `"game:over"`
  - `.addOrder(order)` / `.removeOrder(order)` — manage local planned orders
  - `.submitOrders()` — sends `MoveOrder[]` to admin via relay
  - `.playerById(id)` / `.regionById(id)` — state accessors

### `client/src/core/combat.ts`
- `resolveRound(regions, orders, config)` — main resolver, returns `RoundResult`
- `resolveAttack(attackers, defenders, config)` — single-region math (45/55 base)

### `client/src/core/production.ts`
- `applyProduction(regions, config)` — adds troops, mutates in place
- `resetProductionState()` — clears `controlStreak` map (call on new game)

### `client/src/core/victory.ts`
- `checkVictory(regions, players, round, config)` — evaluates all conditions, returns winner or null
- `resetVictoryState()` — clears `hillControlStreak` map

### `client/src/network/protocol.ts`
- `MsgType` enum — all message type constants (includes `PLAYER_KICK: "player:kick"`)
- `interface Region` — `{ id, coord: HexCoord, ownerId, troops, neighbors[] }`
- `interface PlayerInfo` — `{ id, name, color, isAdmin, isReady, isEliminated }`
- `interface GameConfig` — all config fields + `DEFAULT_CONFIG`
- `type GamePhase` — `"lobby" | "planning" | "resolving" | "ended"`
- `interface MoveOrder` — `{ fromRegionId, toRegionId, troops }`
- `interface RoundResult` — `{ round, regionDeltas[], eliminated[], winner }`

### `client/src/network/relay-client.ts`
- `class RelayClient`
  - `.connect(url)` — opens WebSocket
  - `.send(type, payload)` — sends via WS **and** dispatches locally (relay excludes sender from broadcast, so local dispatch mirrors LocalRelay behaviour — admin receives own GAME_STATE, ROUND_START, etc.)
  - `.on(msgType, cb)` — registers handler
  - `.disconnect()` — closes connection
  - `.clientId` / `.roomCode` — set by `lobby.ts` after ROOM_CREATED/ROOM_JOINED handshake

### `client/src/network/local-relay.ts`
- `class LocalRelay` — same interface as RelayClient, uses BroadcastChannel
  - Channels: `hexategy:{code}:to-admin`, `hexategy:{code}:from-admin`, `hexategy:{code}:to-{id}`

### `client/src/network/admin-host.ts`
- `class AdminHost` — game authority (only instantiated in admin browser)
  - `.startGame()` — generates map, kicks off first round
  - `RESOLVE_GRACE_MS = 1000` — grace period added to roundTimer so player orders (async via WS/BroadcastChannel) arrive before `resolveRound()` fires
  - `.updateConfig(config)` — update settings before start
  - `.kickPlayer(id)` — removes player, broadcasts `PLAYER_KICK`, updates state
  - `.broadcastState()` — sends `GAME_STATE` to all players
  - `.destroy()` — clears timers
  - Internal: `startRound()`, `resolveRound()`, `syncState()`

### `client/src/render/hex-renderer.ts`
- `HEX_SIZE = 48` — flat-top hexagon pixel size
- `hexToPixel(coord)` — axial → canvas px
- `pixelToHex(x, y)` — canvas px → axial
- `hexRound(coord)` — snap float coord to nearest hex
- `class HexRenderer`
  - `.render(regions, players)` — full canvas redraw
  - `.selectedRegionId` / `.highlightedRegionIds` — selection state

### `client/src/render/camera.ts`
- `class Camera`
  - `.applyToContext(ctx)` — applies zoom+pan transform
  - `.canvasToWorld(x, y)` — screen → world coords
  - `.zoomIn()` / `.zoomOut()` / `.zoomAt(cx, cy, delta)` / `.resetZoom()`
  - `.onChange` — callback fired after any transform change
  - State: `x`, `y`, `scale` (min 0.25, max 5.0)

### `client/src/render/arrows.ts`
- `interface ArrowData` — `{ fromRegionId, toRegionId, troops, color, animated?, progress? }`
- `class ArrowRenderer`
  - `.render(arrows, regions)` — draws all arrows (planning = dashed, animated = solid)

### `client/src/render/ui-overlay.ts`
- `class UIOverlay`
  - `.updateRound(round)` / `.updatePhase(phase)` / `.updateScoreboard(players, regions)`
  - `.startCountdown(seconds, onEnd)` / `.stopCountdown()`
  - `.bindZoom(camera)` — wires zoom buttons

### `client/src/input/input-handler.ts`
- `class InputHandler`
  - `.updateState(regions, orders)` — refresh world state used for hit testing
  - `.onOrderChange` — callback when user adds/removes an order
  - `.detach()` — removes all canvas event listeners

### `client/src/ui/lobby.ts`
- `class LobbyView`
  - `.render(container)` — injects lobby HTML
  - `.onJoined(relay, roomCode, clientId, isAdmin)` — callback after successful join/create

### `client/src/ui/config-panel.ts`
- `class ConfigPanel`
  - `.render(container, config)` — injects form
  - `.onChange(config)` — fires on save

### `client/src/ui/header.ts`
- `class AppHeader`
  - `.render(container)` — mounts header to `#app-header`
  - `.toggleTheme()` — light ↔ dark, persists in localStorage

### `client/src/i18n/index.ts`
- `t(key)` — translation lookup (returns key if missing)
- `initI18n()` — detects language from localStorage or browser
- `setLocale(locale)` — change language + notify
- `onLocaleChange(cb)` — subscribe to language changes
- `AVAILABLE_LOCALES` — `["ca", "es", "en"]`

### `server/relay.ts`
- `generateId()` — random XXX-XXX room code
- `membersOf(roomCode)` — returns `RoomMember[]`
- `broadcast(roomCode, msg, exclude?)` — send to all in room
- `sendTo(ws, msg)` — send to specific socket
- `removeMember(ws)` — disconnect cleanup
- Port: `process.env.PORT || 3001`

---

## Architecture: Admin-as-Host Pattern

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Player Browser  │     │  Player Browser  │     │  Admin Browser   │
│                  │     │                  │     │                  │
│  GameClient      │     │  GameClient      │     │  AdminHost       │
│  (rx state only) │     │  (rx state only) │     │  (game authority)│
│  RelayClient/    │     │  RelayClient/    │     │  RelayClient/    │
│  LocalRelay      │◄────┼──LocalRelay      │◄────┼──LocalRelay      │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                          │
         └────────────────────────┼──────────────────────────┘
                                  ▼
                        ┌──────────────────┐
                        │  relay.ts        │
                        │  (stateless WS   │
                        │   message router)│
                        └──────────────────┘
```

**Single source of truth:** AdminHost → broadcasts `GAME_STATE` to all.
**Players** only read state + send `PLAYER_ORDERS`.
**Local mode:** BroadcastChannel replaces WebSocket (same interface).

---

## Game Phase State Machine

```
LOBBY ──(admin starts)──► PLANNING ──(timer+orders)──► RESOLVING ──► PLANNING
                                                                │
                                                          (victory?)
                                                                │
                                                              ENDED
```

| Phase | Who controls | Duration |
|-------|-------------|----------|
| planning | all players | 5–30 s (configurable) |
| resolving | admin auto | ~2.5 s (animation) |
| ended | admin | until Play Again / Leave |

---

## Message Flow (one round)

1. `AdminHost.startRound()` → broadcasts `ROUND_START` + `GAME_STATE`
2. Players: InputHandler captures drag orders → stored locally
3. Timer fires → `GameClient.submitOrders()` → sends `PLAYER_ORDERS` to admin
4. Admin collects all orders in `pendingOrders` map
5. `AdminHost.resolveRound()` → calls `resolveRound()` (combat) + `checkVictory()`
6. Admin broadcasts `ROUND_RESOLVE` + new `GAME_STATE` (+ `GAME_OVER` if winner)
7. `GameClient` updates state → render loop draws new frame

---

## Key Data Types (protocol.ts)

```ts
Region        { id, coord: HexCoord, ownerId, troops, neighbors[] }
PlayerInfo    { id, name, color, isAdmin, isReady, isEliminated }
MoveOrder     { fromRegionId, toRegionId, troops }
RoundResult   { round, regionDeltas[], eliminated[], winner }
GameConfig    { roundDuration, maxRounds, baseProduction, productionPerNeighbor,
                bonusAfterRounds, bonusTroops, defenseAdvantage,
                victoryCondition, victoryParam, startPlacement }
GamePhase     "lobby" | "planning" | "resolving" | "ended"
```

---

## CSS Theming

- Design tokens in `styles/variables.css` (CSS Custom Properties)
- Theme class toggled on `<html>`: `data-theme="light"` / `data-theme="dark"`
- Persisted to `localStorage` key `hexategy_theme`
- Locale persisted to `localStorage` key `hexategy_locale`

---

## Running the Project

```bash
# Local mode (no relay server needed)
cd client && bun run dev        # http://localhost:5173
# Open in 2+ tabs, use "Local" mode

# Online mode
bun run dev:server              # relay at ws://localhost:3001
bun run dev:client              # client at http://localhost:5173

# Build
bun run build                   # → client/dist/
```
