# SHADOW FRONT — Multiplayer Design

## 1. Scope

Priority: **Co-op vs AI** (1–5 humans vs 1–5 AI). PvP 1v1 / 3v3 / 5v5 later.

## 2. Model

- **Server authoritative**. The NestJS server runs the same `game-core` `World` at 20 Hz.
- Clients send **commands** only (`move`, `attack`, `build`, `produce`, …) with a client sequence number.
- Server validates: ownership of entities, affordability, placement, prerequisites, rate limit (max 20 commands/s per player).
- Server broadcasts **snapshots** at 10 Hz: full snapshot on join/reconnect, then deltas (changed entity fields, created/removed ids, events). Fog-of-war interest management: each team only receives entities visible to its alliance.
- Clients interpolate between snapshots (100 ms buffer).

## 3. Room lifecycle

```text
LOBBY → (all ready, host starts) → LOADING → IN_MATCH → RESULTS → LOBBY/closed
```

Room settings: name, public/private (+ password), map, mission type, starting credits, max players (≤5), bots (faction, difficulty, personality, team).

## 4. Socket.IO namespace `/lobby` (implemented phase 0)

| Client → Server                  | Payload                                      | Effect                            |
| -------------------------------- | -------------------------------------------- | --------------------------------- |
| `room:create`                    | `{ name, playerName, isPrivate, password? }` | creates room, caller becomes host |
| `room:join`                      | `{ roomId, playerName, password? }`          | joins if not full                 |
| `room:leave`                     | —                                            | leaves; host migrates             |
| `room:list`                      | —                                            | returns public rooms              |
| `player:ready`                   | `{ ready }`                                  | toggles ready                     |
| `player:faction`                 | `{ faction }`                                | selects faction                   |
| `room:addBot` / `room:removeBot` | bot config / `{ botId }`                     | host only                         |
| `room:settings`                  | partial settings                             | host only                         |

Server → Client: `room:state` (full room object) after every change, `room:error`.

## 5. Reconnection

Each player receives a `reconnectToken`. On reconnect within 60 s the player regains its slot; during absence its units hold position (AI takeover optional later). The match continues without the player.

## 6. Security

- Never trust client damage/positions.
- Validate every payload shape (class-validator / manual guards).
- Rate limiting per socket.

## 7. Acceptance criteria (phase 6–7)

- Two browsers can create/join the same room and see synchronized state.
- Host can add AI and start the match; all clients receive identical world state.
- A disconnected player can rejoin.
