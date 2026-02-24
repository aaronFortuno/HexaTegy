# HexaTegy — Agent Instructions

Rules for any AI agent (Claude, GPT, Gemini, etc.) working on this codebase.
Follow these steps strictly to avoid wasting context and producing incorrect changes.

---

## 1. Orient Before Acting

**Always start here:**

1. Read `ARCHITECTURE.md` — understand the module map, key symbols, and data flow.
2. Do NOT open source files until you know which file to open and why.
3. If `ARCHITECTURE.md` does not have the answer, use search (see §2) before reading files.

---

## 2. Search Before Reading

Never guess where a symbol lives. Search first.

### Find where a symbol is defined
```bash
grep -rn "functionName\|ClassName\|interfaceName" client/src/
```

### Find all usages of a symbol
```bash
grep -rn "symbolName" client/src/ server/
```

### Find a file by name pattern
```bash
find . -name "*.ts" | grep keyword
```

### Find which file exports something
```bash
grep -rn "export.*symbolName" client/src/
```

### Find all callers of a function
```bash
grep -rn "functionName(" client/src/
```

**Rule:** Only open a file after you have confirmed it contains what you need.

---

## 3. Minimal File Reads

- Read only the file(s) identified by search.
- If a function is large, read the specific lines (offset + limit), not the full file.
- Do NOT read every file in a directory to understand it — use `ARCHITECTURE.md` instead.
- Do NOT read files you are not going to modify.

---

## 4. Before Making Any Change

Mandatory checklist:

- [ ] Identified the exact file and line range to change (via search or ARCHITECTURE.md)
- [ ] Read that file (or the relevant section)
- [ ] Understood how the symbol is used by callers (`grep` for usages)
- [ ] Confirmed the change does not break the data flow described in ARCHITECTURE.md

If changing a **shared interface** (e.g., `protocol.ts`):
- Search for all files that import it
- Check every consumer before modifying the interface

If changing **AdminHost** or **GameClient**:
- Both must stay in sync — AdminHost is the source of truth; GameClient mirrors it
- Confirm the relevant `MsgType` in `protocol.ts` is still correct

---

## 5. Understand the Architecture Pattern First

Before touching network code:
- Re-read the "Admin-as-Host Pattern" section in ARCHITECTURE.md
- The relay server is stateless — it never holds game state
- AdminHost runs exclusively in the admin's browser
- `LocalRelay` and `RelayClient` share the same interface — changes must work for both

Before touching rendering:
- Canvas coordinate system uses Camera transform — always go through `camera.canvasToWorld()` for input
- HexRenderer uses axial coordinates (q, r) — never mix with pixel coords without conversion

Before touching i18n:
- All UI strings go through `t(key)` — never hardcode strings in components
- New strings must be added to all three locale files: `ca.ts`, `es.ts`, `en.ts`

---

## 6. Adding New Features

### New message type
1. Add to `MsgType` enum in `protocol.ts`
2. Add interface if needed in `protocol.ts`
3. Handle in `AdminHost` (sender/receiver as appropriate)
4. Handle in `GameClient` (receiver)
5. Handle in `relay.ts` only if routing changes are needed (usually not)

### New game config option
1. Add field to `GameConfig` interface in `protocol.ts`
2. Add default in `DEFAULT_CONFIG`
3. Add form field in `config-panel.ts`
4. Add i18n key to all three locale files
5. Use the config in the relevant core module (`combat.ts`, `production.ts`, `victory.ts`)

### New UI view
1. Create file in `client/src/ui/`
2. Add CSS in `client/src/styles/components/`
3. Add view transition in `main.ts`
4. Add all UI strings via `t()` with keys in all three locale files

### New victory condition
1. Add to `VictoryCondition` type in `protocol.ts`
2. Implement checker in `victory.ts`
3. Add option to `config-panel.ts`
4. Add i18n keys

---

## 7. What NOT to Do

- **Do not modify `relay.ts` to hold game state** — it must stay stateless
- **Do not instantiate `AdminHost` in non-admin browsers** — check `isAdmin` first
- **Do not draw directly to canvas without applying Camera transform** — it will misalign
- **Do not add hardcoded pixel sizes** — use `HEX_SIZE` constant from `hex-renderer.ts`
- **Do not add framework dependencies** — this project is intentionally vanilla TS
- **Do not skip `resetProductionState()` / `resetVictoryState()`** when starting a new game
- **Do not import game logic in `relay.ts`** — it's a pure message router

---

## 8. Testing Changes Locally

```bash
# Start both services
bun run dev:server    # relay at ws://localhost:3001
bun run dev:client    # client at http://localhost:5173

# Local mode (no relay needed) — open 2+ browser tabs
# Tab 1: Create Room → select "Local" mode
# Tab 2: Join Room with same code

# Type check before declaring done
cd client && bun run build   # tsc + vite build — must pass with 0 errors
```

---

## 9. Context Budget Rules

Follow this order to stay within context limits:

1. **ARCHITECTURE.md** — always read first (this is cheap)
2. **grep search** — find the exact file + line (free)
3. **Targeted file read** — read only what search found (cheap)
4. **Full file read** — only if the file is small (<150 lines) or you need full context
5. **Multiple files** — only when the task genuinely spans multiple files

If you find yourself reading more than 4 files for a single change, stop and re-read ARCHITECTURE.md — you probably missed the right entry point.

---

## 10. After Making Changes

1. Update `ARCHITECTURE.md` if you added/removed/renamed files, symbols, or changed the data flow
2. If you added a new exported symbol, add it to the Key Symbols Reference section
3. Keep `ARCHITECTURE.md` as the single source of truth for project structure
