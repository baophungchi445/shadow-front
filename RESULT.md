# SHADOW FRONT — Kết quả thực hiện

Nguồn: `docs/MASTER_GAME_DEVELOPMENT.md` (Part 10: Task A → E).

## Kế hoạch

| #   | Công việc                                                                                  | Trạng thái |
| --- | ------------------------------------------------------------------------------------------ | ---------- |
| 1   | TASK A — Kiểm tra workspace, đọc master doc                                                | ✅         |
| 2   | TASK B — Tạo bộ tài liệu docs/*.md                                                         | ✅         |
| 3   | TASK C — Khởi tạo monorepo pnpm (root config, 6 workspace)                                 | ✅         |
| 4   | game-data: config factions / units / buildings / maps                                      | ✅         |
| 5   | game-core: iso math, grid, A*, simulation (movement, economy, combat, fog) + tests         | ✅         |
| 6   | game-ai: AI Commander (economy, build, produce, attack, defend, difficulty, personalities) | ✅         |
| 7   | apps/web: React + Phaser isometric scene, camera, selection, move, HUD, minimap            | ✅         |
| 8   | apps/server: NestJS + Socket.IO skeleton (health + lobby rooms)                            | ✅         |
| 9   | TASK E — Install, typecheck, lint, test, build, chạy dev                                   | ✅         |
| 10  | Báo cáo cuối (theo mục 13 của master doc)                                                  | ✅         |

## Nhật ký công việc đã xong

### ✅ 1. TASK A — Inspect project

- Đọc toàn bộ `docs/MASTER_GAME_DEVELOPMENT.md` (2710 dòng, Part 1–13 + Autonomous Prompt).
- Workspace ban đầu: chỉ có `docs/MASTER_GAME_DEVELOPMENT.md` → giữ nguyên, không xóa.
- Môi trường: Node v22.23.2, npm 10.9.8, pnpm 9.15.1, git 2.47 (workspace chưa phải git repo).
- Phạm vi lần này (theo Part 10 + Definition of Done mục 12): Phase 0 + Phase 1, và tiến xa hơn tới
  milestone 1 (Part 13): chơi offline trên Desert Storm, xây căn cứ, khai thác, sản xuất, đánh với AI Commander.
- Quyết định kỹ thuật:
  - Map được định nghĩa bằng dữ liệu trong `packages/game-data` (định dạng grid giống Tiled), chưa dùng Tiled editor.
  - Asset là placeholder procedural (Phaser Graphics) — KHÔNG phải asset production.
  - Server: NestJS + Socket.IO lobby in-memory; PostgreSQL/Prisma/Redis để Phase 6 (ghi rõ ở phần còn lại).

### ✅ 2. TASK B — Documentation

Đã tạo 8 tài liệu tiếng Anh kỹ thuật trong `docs/` (có goals, scope, acceptance criteria, thống nhất với master doc):
`GAME_DESIGN.md`, `TECHNICAL_ARCHITECTURE.md`, `GAMEPLAY_SYSTEMS.md`, `AI_DESIGN.md`, `MULTIPLAYER_DESIGN.md`,
`ART_ASSET_GUIDE.md`, `DEVELOPMENT_ROADMAP.md`, `API_SPECIFICATION.md`.

### ✅ 3. TASK C — Initialize monorepo

- Root: `package.json` (scripts dev/build/typecheck/lint/test/check), `pnpm-workspace.yaml`, `tsconfig.base.json`
  (strict), `eslint.config.js` (flat config + typescript-eslint + react-hooks), `.prettierrc.json`, `.gitignore`, `.editorconfig`.
- Workspaces: `apps/web`, `apps/server`, `packages/shared-types`, `packages/game-data`, `packages/game-core`, `packages/game-ai`.
- Packages export TS source (`exports: ./src/index.ts`) → Vite/Vitest dùng trực tiếp, không cần build trung gian.
- `assets/{units,buildings,maps,effects,audio,ui}` tạo sẵn theo convention.
- `pnpm install` thành công (phaser 3.90.0, react 18.3.1, vite 5.4.21, zustand 5.1, tailwind 3.4.19, NestJS 10.4.22, socket.io 4.8).
- `packages/shared-types`: ids, definitions (Unit/Building/Weapon/Faction/Map), commands + events, lobby types — typecheck OK.

### ✅ 4. packages/game-data (config-driven content)

- `units.ts`: 9 unit types (Rifleman, AT Soldier, Recon Vehicle, APC, Main Battle Tank, Heavy Tank, Mobile Artillery,
  Attack Helicopter, Recon Drone) — cost, build time, HP, speed, vision, weapon, producer, prerequisites.
- `buildings.ts`: HQ, Power Plant, Resource Extractor, Barracks, War Factory, Airfield, Research Center, Defense Turret, SAM Site.
- `factions.ts`: 5 phe với modifier cân bằng (+/−).
- `balance.ts`: tick rate 20 Hz, bảng counter `weaponType × armorClass`, hằng số kinh tế/điện.
- `maps.ts`: Desert Storm + Urban Conflict (64×64, 4 spawn, ore fields, ridge/canal/street grid), deterministic seed.
- `ai.ts`: 4 difficulty profile + 5 personality profile (build order, unit weights, aggression).
- Test: 4/4 pass (đủ nội dung MVP, mọi spawn liên thông nhau & có ore gần căn cứ).

### ✅ 5. packages/game-core (simulation độc lập React/Phaser)

- `iso.ts`: world ↔ screen isometric 2:1 (64×32), đổi góc hướng world → screen.
- `grid.ts` (NavGrid: terrain + building occupancy, nearestWalkable, spreadTiles), `heap.ts`, `pathfinding.ts` (A* 8 hướng, octile, không cắt góc, partial path, làm mượt waypoint).
- `world.ts`: `World` — fixed tick 20 Hz, players, entities, ore, seeded RNG, `issue(command)`, events, fog, victory (Annihilation / Decapitation).
- `commands.ts`: validate ownership / cost / prerequisites / placement cho move, attack, attack-move, stop, hold, retreat, build, cancelBuild, produce, cancel, rally.
- `systems/economy.ts`: power, construction (HP tăng theo tiến độ), production queue (low power ×0.5), extractor rút ore hữu hạn.
- `systems/movement.ts`: group move (trải đích), đi theo waypoint, re-path khi có building mới, phát hiện kẹt, separation.
- `systems/combat.ts`: auto-acquire theo vision + fog, focus fire, attack-move, hold, leash, xoay turret, projectile bay thật (homing / artillery scatter + splash), counter table.
- `fog.ts`: visible/explored per team, cập nhật 4 Hz.
- Test: 16/16 pass (iso, A*, occupancy, damage counters, placement, credits, production/cancel refund, low power, ore extraction, movement, ownership validation, auto combat, fog, decapitation).

### ✅ 6. packages/game-ai (AI Commander)

- `AICommander`: FSM `opening → buildup ↔ attack / defend`, quyết định mỗi `thinkInterval` tick theo difficulty.
- Perception chỉ qua `world.visibleEnemies(team)` (tôn trọng Fog of War), nhớ building địch đã thấy; spawn của map là thông tin công khai để trinh sát.
- Base: build order theo personality, giữ điện dương, extractor trên ore còn trữ lượng, phòng thủ (turret/SAM khi thấy không quân), placement có viền trống để không tự chặn đường.
- Production: utility scoring (trọng số personality + counter theo giáp địch đã thấy ở Hard/Insane), để dành tiền cho building kế tiếp.
- Army: phòng thủ khi có địch gần căn cứ, trinh sát, tấn công khi đủ giá trị quân, Insane chia 2 mũi, Hard+ rút lui khi squad mất > 65% HP.
- Mọi hành động qua `world.issue()` → cùng luật, cùng chi phí với người chơi; không cộng tiền gian lận.
- Chẩn đoán AI vs AI (4 cặp difficulty/personality, 2 map): trận kết thúc với người thắng sau 5–15 phút, AI xây
  HQ/Power/Extractor/Barracks/War Factory/Research/Airfield/turret/SAM, sản xuất 30–90 unit.
- Cân bằng: tăng income Resource Extractor 20 → 25 credits/s sau khi thấy kinh tế quá chậm.
- Test: 3/3 pass (AI tự xây base + sản xuất, AI vs AI có giao tranh & phân thắng bại, không nhìn xuyên fog).

### ✅ 7. apps/web (React + Vite + Phaser 3 + Zustand + Tailwind)

- Màn hình: Main Menu (PLAY / MULTIPLAYER / ARMY / SETTINGS), Skirmish Setup (map + preview, mission, credits, phe,
  1–3 AI với faction/difficulty/personality/team — có thể chơi co-op với AI đồng minh), Game, Results (thống kê), Army Codex
  (sinh tự động từ game-data), Settings (edge scroll, tốc độ camera — lưu localStorage).
- `GameController`: sở hữu World + AICommander, fixed timestep 20 Hz theo wall-clock, selection, control groups, lệnh, placement.
- `PhaserGame.tsx`: đúng 1 `Phaser.Game` / trận, destroy khi unmount; React ↔ Phaser qua controller + emitter; HUD sync 10 Hz qua Zustand.
- `BattleScene`: terrain isometric bake vào RenderTexture; nhà cao tầng/đá/cây/ore là sprite depth-sorted; unit & building vẽ
  procedural (prism isometric thật theo hướng xe, tháp pháo xoay độc lập, cánh quạt trực thăng); fog of war bằng canvas texture
  - affine transform isometric (mép mềm); hiệu ứng muzzle flash, tracer, rocket trail, pháo bắn cầu vồng, nổ, khói, mảnh vỡ, vết cháy;
    công trình địch đã thấy được giữ dạng "ghost" trong vùng sương.
- Input: click / drag-box / double-click chọn; chuột phải move/attack/rally; F attack-move, X stop, G hold, R retreat, Q chọn toàn quân,
  Ctrl+1-9 nhóm, Space về căn cứ, WASD/mũi tên/edge/middle-drag pan, wheel zoom theo con trỏ, giới hạn camera; click HUD không lọt xuống game.
- HUD: credits, thanh điện (cảnh báo low power), đồng hồ + mục tiêu, minimap isometric (click để di chuyển camera, chuột phải để ra lệnh),
  team status, selection panel, command panel / production queue (hủy hoàn tiền), construction panel, toast thông báo, pause menu.
- Kiểm thử trình duyệt thật (Chrome qua puppeteer-core, script trong scratchpad): 9/9 bài tương tác PASS — pan WASD, chọn army,
  chuột phải di chuyển (5/5 unit), box select, đặt Power Plant qua HUD (trừ 600 credits), xây xong, click chọn building,
  click HUD không ảnh hưởng game, pause dừng simulation; 0 lỗi console. GPU thật: ~100 FPS, đúng 20 tick/s.
- Lỗi tìm ra & đã sửa khi test: (1) delta của Phaser bị làm mượt khiến sim chậm trên máy yếu → dùng wall-clock;
  (2) edge-scroll kích hoạt khi chuột chưa vào canvas; (3) panel Construction bị tràn; (4) cảnh báo "base under attack" bật cả khi chỉ unit bị bắn.

### ✅ 8. apps/server (NestJS 10 + Socket.IO)

- `GET /api/health`, `GET /api/rooms`; gateway `/lobby`: `room:create | join | leave | list | settings | addBot | removeBot | start`,
  `player:ready | faction`; broadcast `room:state`; ack `{ ok, room | error }`.
- `RoomsService` in-memory: phòng public/private + password, host migration, giới hạn slot, validate payload thủ công, quyền host,
  start chỉ khi mọi người ready và có team địch; rate limit 20 event/s mỗi socket; CORS qua `CORS_ORIGINS`; `.env.example`.
- Test: 3/3 unit test pass. Chạy thật: server khởi động, `/api/health` → `{"status":"ok",...}`; 2 client Socket.IO cùng vào 1 phòng,
  client B nhận đủ 5 lần cập nhật `room:state` (join, add bot, đổi faction, ready, start), B bị từ chối `NOT_HOST`, start bị chặn `NOT_ALL_READY`.
- Chưa làm (đúng phạm vi): PostgreSQL/Prisma, Redis, auth, simulation authoritative trên server (Phase 6–7).

### ✅ 9. TASK E — Validation

| Bước                             | Lệnh                                     | Kết quả                                                                              |
| -------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| Cài dependencies                 | `pnpm install`                           | ✅                                                                                   |
| TypeScript (strict, 6 workspace) | `pnpm typecheck`                         | ✅ 0 lỗi                                                                             |
| ESLint                           | `pnpm lint`                              | ✅ 0 lỗi (đã sửa 2 lỗi `consistent-type-imports`)                                    |
| Prettier                         | `prettier --write`                       | ✅ đã format toàn bộ source                                                          |
| Unit test                        | `pnpm test`                              | ✅ 26/26 (game-data 4, game-core 16, game-ai 3, server 3)                            |
| Production build                 | `pnpm build`                             | ✅ web (Vite) + server (tsc)                                                         |
| Dev server                       | `pnpm dev`                               | ✅ http://localhost:5173 trả 200                                                     |
| Runtime browser                  | Chrome + puppeteer-core                  | ✅ menu → setup → chơi → pause → surrender → results → rematch → quit; 0 lỗi console |
| Runtime server                   | `node dist/main.js` + 2 client Socket.IO | ✅                                                                                   |

- Bổ sung: `README.md`, `CHANGELOG.md`, `docs/TESTING.md`, `assets/manifest.json`, cập nhật `docs/DEVELOPMENT_ROADMAP.md`.

---

## 📋 BÁO CÁO CUỐI (theo mục 13 của master doc)

### 1. Project Structure

```text
shadow-front/
├── apps/web/            React + Vite + Phaser 3 (src/app, pages, components/hud, stores, game/{scenes,render})
├── apps/server/         NestJS + Socket.IO (src/health, src/rooms)
├── packages/shared-types/  ids, definitions, commands/events, lobby
├── packages/game-data/     units, buildings, factions, maps, ai profiles, balance, rng
├── packages/game-core/     iso, grid, pathfinding, world, commands, fog, combat, systems/{economy,movement,combat}
├── packages/game-ai/       commander, placement
├── assets/              units, buildings, maps, effects, audio, ui + manifest.json
├── docs/                MASTER + 8 tài liệu + TESTING.md
├── package.json · pnpm-workspace.yaml · tsconfig.base.json · eslint.config.js · .prettierrc.json · .gitignore · README.md · CHANGELOG.md
```

### 2. Documentation

GAME_DESIGN, TECHNICAL_ARCHITECTURE, GAMEPLAY_SYSTEMS, AI_DESIGN, MULTIPLAYER_DESIGN, ART_ASSET_GUIDE,
DEVELOPMENT_ROADMAP (có trạng thái từng phase), API_SPECIFICATION, TESTING.

### 3. Implemented Features (đã chạy thật, đã kiểm chứng)

- Skirmish offline hoàn chỉnh: 1 người vs 1–3 AI (có thể có AI đồng minh), 2 map, 2 loại nhiệm vụ, 5 phe.
- Bản đồ isometric, camera pan/zoom/bounds, minimap, fog of war, chọn/kéo chọn/nhóm, A* + group move.
- Kinh tế: credits, power (low power làm chậm), extractor rút ore hữu hạn, đặt + xây công trình, hàng đợi sản xuất, rally point.
- Combat: auto-acquire, focus fire, attack-move, hold, retreat, projectile thật, splash, counter table, hiệu ứng nổ/khói.
- AI Commander: tự xây base, khai thác, sản xuất theo utility, trinh sát, phòng thủ, tấn công, rút lui; 4 độ khó, 5 tính cách; tôn trọng fog.
- Lobby server Socket.IO (rooms, ready, faction, bots, host) — nền móng cho Phase 6.
- Đối chiếu Definition of Done mục 12: 14/14 mục đạt.

### 4. Technology

TypeScript 5.6 (strict) · pnpm 9 workspace · React 18.3 · Vite 5.4 · Phaser 3.90 · Zustand 5 · Tailwind 3.4 ·
NestJS 10.4 · Socket.IO 4.8 · Vitest 2.1 · ESLint 9 + typescript-eslint 8 · Prettier 3.

### 5. Validation

TypeScript ✅ · ESLint ✅ · Test 26/26 ✅ · Build ✅ · Runtime browser ✅ (≈100 FPS GPU, 20 tick/s) · Runtime server ✅.

### 6. How to Run

```bash
cd shadow-front
pnpm install
pnpm dev           # mở http://localhost:5173 → PLAY → Deploy
pnpm dev:server    # (tuỳ chọn) lobby server http://localhost:3000/api/health
pnpm check         # typecheck + lint + test + build
```

### 7. Remaining Tasks (chưa làm & lý do)

- **Online multiplayer (Phase 6–7)**: chưa có auth, PostgreSQL/Prisma, Redis, UI lobby trên web, simulation authoritative trên server,
  snapshot/delta, reconnect — vượt phạm vi lần đầu (master doc mục 12: "chưa yêu cầu multiplayer"). Màn MULTIPLAYER ghi rõ trạng thái, không giả lập.
- **Asset production**: toàn bộ đồ họa chiến trường là placeholder procedural; chưa có sprite, chưa có âm thanh.
- **Tiled**: map định nghĩa bằng script dữ liệu (cùng định dạng grid), chưa có importer Tiled JSON.
- **PvP, Survival, Campaign**: thuộc giai đoạn sau.
- Cân bằng game mới ở mức sơ bộ (AI vs AI kết thúc 5–15 phút; người chơi cần playtest thêm để đạt mục tiêu 20–35 phút).

### 8. Next Phase

Đề xuất **Phase 6 — Lobby**: guest auth, màn lobby web dùng `socket.io-client` nối vào gateway hiện có, Prisma schema
(players, matches), Redis adapter; sau đó **Phase 7**: chạy `World` + `AICommander` trong NestJS match service 20 Hz.

---

# ĐỢT 2 — Tập trung chơi local vs AI (tạm gác online)

Yêu cầu: "hiện tại làm với local trước, đánh với máy trước". Multiplayer (Phase 6–7) hoãn lại.

| #   | Công việc                                                                                                           | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2.1 | Nhịp trận vs AI: AI không tấn công quá sớm (mốc tấn công đầu tiên theo độ khó), kéo dài trận về mục tiêu 20–35 phút | ✅         |
| 2.2 | Tốc độ game 0.5× / 1× / 2× / 3× (nút trên top bar + phím `-` / `=`)                                                 | ✅         |
| 2.3 | Âm thanh procedural (WebAudio): bắn, pháo, rocket, nổ, xây xong, quân xong, cảnh báo + chỉnh âm lượng               | ✅         |
| 2.4 | Cảnh báo bị tấn công: ping đỏ trên minimap + Space nhảy tới chỗ bị đánh                                             | ✅         |
| 2.5 | Nhớ cấu hình skirmish lần trước; ẩn nút Multiplayer khỏi menu chính                                                 | ✅         |
| 2.6 | Kiểm tra lại: typecheck, lint, test, build, chơi thử trên trình duyệt                                               | ✅         |

## Nhật ký đợt 2

### ✅ 2.1 Nhịp trận vs AI

- `DifficultyProfile` thêm `firstAttackTick` và `attackCooldown`: Easy 9 phút / 2 phút, Normal 7 / 1.5, Hard 5 / 1, Insane 3.5 / 0.75.
  Personality co giãn mốc đầu (RUSH ×0.6 → sớm hơn, FORTRESS ×1.4 → muộn hơn). AI vẫn **phòng thủ** bất cứ lúc nào.
- HP mọi công trình ×1.6 (HQ 3000 → 4800…) để một đợt tấn công không xóa sổ căn cứ ngay.
- Đo AI vs AI (5 cặp): công trình đầu tiên bị phá lúc 3–10 phút (trước đây 2–4 phút); trận kết thúc 5–16 phút.
  Ghi chú trung thực: AI đối AI vẫn ngắn hơn mục tiêu 20–35 phút vì AI RUSH áp đảo AI đầu tư công nghệ; với người chơi,
  mục tiêu chính (có thời gian xây dựng trước đợt đánh đầu) đã đạt — cần playtest người thật để tinh chỉnh tiếp.
- Test 23/23 (packages) vẫn pass.

### ✅ 2.2 Tốc độ game

- `GameController.speed` (0.5× / 1× / 2× / 3×) nhân vào bước thời gian của fixed-timestep; nút chọn trên top bar, phím `-` / `=`.
- Đo thực tế: 1× = 20 tick/s, 3× = 60 tick/s.

### ✅ 2.3 Âm thanh procedural

- `apps/web/src/game/audio.ts`: tổng hợp bằng WebAudio (không file âm thanh → không vướng license): súng, pháo, rocket/tên lửa,
  pháo binh, nổ nhỏ/lớn, xây xong, quân xong, cảnh báo, click lệnh, lỗi lệnh. Có throttle chống ồn khi đánh lớn, giảm âm theo khoảng cách tới camera,
  chỉ phát âm thanh trận đánh nằm trong vùng nhìn thấy (tôn trọng fog).
- Âm lượng: thanh trượt trong Settings và trong menu Pause (lưu localStorage). AudioContext mở ở lần click đầu (đúng autoplay policy).

### ✅ 2.4 Cảnh báo bị tấn công

- Ping đỏ dạng vòng lan trên minimap tại chỗ bị đánh (6 giây); tiếng còi khi căn cứ bị đánh.
- `Space`: nhảy camera tới cảnh báo mới nhất (< 8 giây, chưa xem); bấm lần nữa → về căn cứ.

### ✅ 2.5 Tập trung local

- Màn Skirmish nhớ cấu hình lần trước (map, mission, credits, tên, phe, danh sách AI) — dữ liệu hỏng thì về mặc định.
- Ẩn nút Multiplayer khỏi menu chính (trang & server vẫn giữ để làm sau).

### ✅ 2.6 Kiểm tra lại

- `pnpm check`: typecheck ✅, lint ✅, test 26/26 ✅, build ✅.
- Trình duyệt (Chrome): smoke 9/9 ✅, bài đợt 2 8/8 ✅, luồng menu → trận → surrender → results → rematch → quit ✅, 0 lỗi console.
- **Lỗi tìm ra & đã sửa**: sự kiện `keydown` của Phaser bị phát lặp (2 lần bấm → 3–5 lần xử lý) khi focus đang ở nút HUD
  → mọi phím tắt lệnh chuyển sang listener gốc của trình duyệt (bỏ qua auto-repeat, ô nhập liệu, và khi đang pause).
  Đã xác minh: 2 lần bấm = đúng 2 lần xử lý.

---

# ĐỢT 3 — Tiếp tục các phase (chỉ local, chưa nâng cấp đồ họa)

Phạm vi: các mục còn thiếu của master doc chạy được offline. Không làm online, không đổi đồ họa.

| #   | Công việc                                                                                                      | Nguồn trong master doc                                    | Trạng thái |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| 3.1 | Strategic Control Points: chiếm điểm bằng quân mặt đất, cho thu nhập + tầm nhìn; hiển thị trên map/minimap/HUD | §2.1 "Control territory", §2.5, Part 4 "Strategic points" | ✅         |
| 3.2 | Nghiên cứu công nghệ tại Research Center (giáp, hỏa lực, quang học, khai thác)                                 | §1.1 "Nghiên cứu công nghệ", §2.5 "Nâng cấp công nghệ"    | ✅         |
| 3.3 | Sửa chữa công trình (tốn credits theo thời gian)                                                               | Phase 3 "Building health"                                 | ✅         |
| 3.4 | AI dùng cả 3 tính năng mới (chiếm điểm, nghiên cứu, sửa chữa) theo cùng luật                                   | §6.5, Part 3.2                                            | ✅         |
| 3.5 | Phase 9 (local): profiling hiệu năng trận lớn + tối ưu điểm nóng                                               | Phase 9 "Performance profiling"                           | ✅         |
| 3.6 | Phase 9 (local): test gameplay/AI, tương thích trình duyệt (Chrome + Edge), cập nhật docs                      | Phase 9                                                   | ✅         |

## Nhật ký đợt 3

### ✅ 3.1 Strategic Control Points (game-core)

- `world.points` sinh từ `map.strategicPoints` (mỗi map 3 điểm). `systems/points.ts`: quân **mặt đất** trong bán kính 3 ô chiếm điểm
  (12 giây với 1 unit, nhanh tới 3× khi đông quân); điểm của địch phải **trung lập hóa trước** rồi mới chiếm; có từ 2 team trong vùng → **đóng băng (contested)**;
  không quân không chiếm được. Điểm thuộc người chơi đã bị loại → chuyển cho đồng đội còn sống hoặc về trung lập.
- Lợi ích: +6 credits/s mỗi điểm cho người chiếm, tầm nhìn bán kính 7 quanh điểm cho cả team. Events `pointCaptured` / `pointNeutralized`.

### ✅ 3.2 Nghiên cứu công nghệ (game-core + game-data)

- `game-data/research.ts`: Composite Armor (xe & pháo +20% HP), Improved Munitions (+15% sát thương mọi unit & phòng thủ),
  Advanced Optics (+25% tầm nhìn), Efficient Extraction (extractor +30% credits).
- Lệnh `research` / `cancelResearch` (hoàn tiền) tại Research Center đã xây xong; mỗi Research Center 1 nghiên cứu một lúc; không nghiên cứu trùng;
  thiếu điện → chậm ×0.5. Hoàn thành thì áp dụng ngay cho unit đang có và unit mới.

### ✅ 3.3 Sửa chữa công trình

- Lệnh `repair` bật/tắt; hồi đầy 0→100% mất 25 giây và tốn 50% giá công trình, trừ tiền từng tick; tự dừng khi đầy máu hoặc hết tiền.
- Test: game-core 23/23 (thêm 7 test: chiếm điểm + thu nhập + tầm nhìn, trung lập hóa + contested, không quân không chiếm,
  nghiên cứu trừ tiền/thời gian/nâng giáp unit cũ & mới, hủy hoàn tiền + bonus sát thương, yêu cầu Research Center, sửa chữa đúng chi phí & tự dừng);
  game-data 4/4 (thêm kiểm tra điểm chiến lược nằm trên ô đi được).
- Phần hiển thị/HUD làm ở bước 3.4 cùng AI.

### ✅ 3.4 AI + giao diện cho 3 tính năng mới

- **AI** (`AICommander`): gửi tổ 3 quân mặt đất chiếm điểm gần căn cứ nhất chưa thuộc team (Easy chỉ giữ 1 điểm), quân ở lại làm đồn;
  nghiên cứu theo `researchOrder` của từng tính cách khi có Research Center và dư tiền (Normal+); bật sửa chữa công trình < 70% máu khi không có địch gần.
  Vẫn chỉ hành động qua `world.issue()`; vị trí/cờ của điểm là thông tin công khai trên bản đồ.
- Đo AI vs AI: điểm đổi chủ liên tục (giằng co thật), trận dài 11–19 phút (trước 5–16 phút).
- **Giao diện**: vòng tròn + cột cờ màu chủ sở hữu + tên điểm trên bản đồ, vòng sóng khi đang chiếm/tranh chấp, thanh tiến độ chiếm;
  ô vuông màu trên minimap; bộ đếm `⚑ x/3` trên top bar; thông báo + âm thanh khi chiếm/mất điểm, khi nghiên cứu xong;
  panel **Research** khi chọn Research Center (trạng thái ✓ / đang chạy / lý do bị khóa, click để hủy hoàn tiền), thanh tiến độ tím trên công trình;
  nút **Repair** ở panel Selection + dấu thập xanh nhấp nháy trên công trình đang sửa.
- Kiểm thử trình duyệt 7/7 PASS: bộ đếm điểm, chiếm North Ridge bằng Q + chuột phải, thông báo chiếm, panel Research hiện,
  click nghiên cứu trừ đúng 800, nghiên cứu hoàn thành, nút Repair hồi máu HQ; 0 lỗi console.

### ✅ 3.5 Profiling hiệu năng + tối ưu

**Simulation (Node, không render)**

| Kịch bản                                                           | Trung bình / tick | p99     | Max    |
| ------------------------------------------------------------------ | ----------------- | ------- | ------ |
| 4 AI Insane, 17.6 phút, tối đa 105 unit                            | 0.13 ms           | 0.73 ms | 7 ms   |
| 400 unit giao tranh tập trung                                      | 1.42 ms           | 3.9 ms  | 5.6 ms |
| → Ngân sách là 50 ms/tick, simulation và AI không phải điểm nghẽn. |

**Render (Chrome, GPU thật, 300 unit đánh nhau trong khung hình)**

- Trước: **25 FPS** (frame median 38 ms). CPU profile: ~75% thời gian nằm trong Phaser `Graphics` (earcut, sortLinked, batchFillPath)
  vì mỗi `Graphics` bị tam giác hóa lại mỗi frame; code game < 2%.
- Sửa: `render/texcache.ts` vẽ mỗi hình **một lần** thành texture và cache theo (loại, màu, hướng): thân xe 32 hướng + tháp pháo 32 hướng
  (sprite riêng, giật lùi khi bắn), bộ binh 16 hướng + nhún khi đi, cánh quạt trực thăng 6 khung; công trình cache theo 10 bước xây + 12 khung animation,
  đầu súng phòng thủ 32 hướng; hạt hiệu ứng dùng pool sprite (`fx-soft`, `fx-dot`) thay cho `fillCircle`; đạn dùng hình chữ nhật.
- Sau: **124 FPS** (frame median 1.6 ms, p95 9.3 ms) — nhanh ~5×; base trống ~300+ FPS. Hình ảnh giữ nguyên (đã chụp đối chiếu).
- Hồi quy: `pnpm check` ✅ (test 33/33), trình duyệt 9/9 + 8/8 + 7/7 PASS.

### ✅ 3.6 Test gameplay/AI, tương thích trình duyệt, tài liệu

- Thêm test AI: AI vs AI (Hard, Urban Conflict) có chiếm điểm chiến lược và hoàn thành nghiên cứu, không bị âm tiền.
  Ghi chú trung thực: hành vi **sửa chữa của AI** chạy trong các trận AI vs AI nhưng **chưa có assertion riêng**.
- Tương thích trình duyệt: cùng 3 bộ test tự động (24 bài) **PASS trên Chrome, Edge và Firefox**, 0 lỗi console
  (Firefox ~100 FPS, x3 = 59.5 tick/s). Script test chỉ phải đổi tên phím `Space` → `' '` cho driver của Firefox, game không phải sửa.
- `pnpm check` cuối: typecheck ✅, lint ✅, test **34/34** (game-data 4, game-core 23, game-ai 4, server 3) ✅, build ✅.
- Tài liệu cập nhật: `GAMEPLAY_SYSTEMS.md` (điểm chiến lược, nghiên cứu, sửa chữa), `AI_DESIGN.md` (nhịp tấn công, chiếm điểm, nghiên cứu, sửa chữa),
  `DEVELOPMENT_ROADMAP.md` (trạng thái Phase 8/9, ưu tiên local, bước tiếp theo), `TESTING.md`, `CHANGELOG.md` (0.3.0), `README.md`.

## Tổng kết đợt 3

- Hoàn thành các mục local còn thiếu của master doc: Strategic Control Points, nghiên cứu công nghệ, sửa chữa công trình; AI dùng cả 3 theo cùng luật.
- Phase 9 phần local: đã profiling, tìm ra điểm nghẽn render thật và tăng FPS trận lớn 25 → 124; xác minh trên 3 trình duyệt.
- Chưa làm (theo yêu cầu): online multiplayer, nâng cấp đồ họa.
- Đề xuất đợt sau (đều offline): playtest người thật để cân bằng độ khó/độ dài trận; chế độ Survival (sóng AI); tutorial; importer Tiled + map thứ 3.

---

# ĐỢT 4 — Nội dung chơi offline mới (chỉ local, chưa nâng cấp đồ họa)

Phạm vi: các bước tiếp theo đã đề xuất ở cuối đợt 3, đều chạy offline. Không làm online, không đổi đồ họa.
Ghi chú: "playtest người thật" mình không tự làm được — thay bằng mô phỏng headless để đo độ dài trận; bạn chơi thử rồi báo lại để chỉnh tiếp.

| #   | Công việc                                                                                                                 | Trạng thái |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 4.1 | Đóng lỗ hổng test: assertion riêng cho AI tự sửa công trình                                                               | ✅         |
| 4.2 | Chế độ **Survival** trong game-core: các đợt địch tấn công tăng dần, thắng khi sống sót hết đợt, có test                  | ✅         |
| 4.3 | Survival trên giao diện: chọn ở màn Skirmish, HUD đếm đợt / thời gian tới đợt sau, cảnh báo hướng tấn công, màn kết quả   | ✅         |
| 4.4 | **Tutorial**: chuỗi mục tiêu hướng dẫn (chọn quân, di chuyển, xây, sản xuất, chiếm điểm, phá đồn địch) + AI địch thụ động | ✅         |
| 4.5 | **Importer Tiled JSON** → `MapDef` + **map thứ 3** làm bằng định dạng Tiled                                               | ✅         |
| 4.6 | Mô phỏng cân bằng (độ dài trận theo độ khó), `pnpm check`, test trình duyệt Chrome/Edge/Firefox, cập nhật docs            | ✅         |

## Nhật ký đợt 4

### ✅ 4.1 Test riêng cho AI tự sửa công trình

- Thêm test `repairs damaged buildings when safe, but not while enemies are close` (game-ai): HQ của AI còn 50% máu, đặt xe tăng địch cạnh HQ
  → AI **không** bật sửa chữa; xóa xe tăng → trong 8 giây AI bật sửa và máu HQ tăng lên. Lỗ hổng ghi ở đợt 3 đã được đóng.
- game-ai 5/5 test pass.

### ✅ 4.2 Chế độ Survival (game-core + game-data)

- Mission mới `survival` + `MatchConfig.survival { difficulty, waves }`. Tất cả người phòng thủ chung team; phải chừa ít nhất 1 điểm spawn trống
  (Desert Storm/Urban Conflict: tối đa 3 người phòng thủ).
- Bên tấn công là người chơi đặc biệt **Hostile Forces** (`raider`): không có căn cứ, không có AI Commander. Các đợt quân do hệ thống
  `systems/waves.ts` sinh ra — đây là luật của chế độ chơi (như kịch bản), không phải AI ăn gian. Người phòng thủ vẫn theo luật kinh tế bình thường.
- Nhịp: đợt 1 sau **3:00**, sau đó mỗi **1:30** một đợt; báo trước **20 giây** (event `waveIncoming` kèm vị trí); vào map ở một spawn trống ngẫu nhiên
  (`waveSpawned`) rồi attack-move vào công trình gần nhất; quân rảnh được nhắm lại mỗi 5 giây.
- Quy mô (`game-data/survival.ts`): ngân sách = 450 + 420·n + 45·n² credits (đợt thứ 5, 10, 15 ×1.3), nhân theo độ khó Easy 0.6 / Normal 1 / Hard 1.35 / Insane 1.75;
  đợt 1–2 bộ binh + xe trinh sát, từ đợt 3 có APC + tăng, đợt 5 có pháo + trực thăng, đợt 7 có tăng hạng nặng; tối đa 36 quân/đợt; cùng seed → cùng đợt.
- Thắng: tất cả đợt đã vào map và bị tiêu diệt. Thua: mọi người phòng thủ bị loại.
- AI đồng minh trong Survival: không trinh sát và không đi tấn công các spawn trống, ở nhà phòng thủ + chiếm điểm.
- Test: game-core +5 (người tấn công không có căn cứ + entry là spawn trống; từ chối team lẫn lộn / quá nhiều người; báo trước đúng 20 s, sinh quân tại entry,
  quân attack-move, lịch đợt sau; thắng khi hết đợt; thua khi bị loại), game-data +1 (đợt tất định, tăng theo số đợt và độ khó, giới hạn quân),
  game-ai +1 (AI đồng minh giữ được 10 đợt Easy).
- **Đo cân bằng** (AI phòng thủ cấp Normal, tính cách Fortress, 10 đợt, 3 seed / 2 map):

  | Sức mạnh đợt | Kết quả AI phòng thủ     |
  | ------------ | ------------------------ |
  | Easy         | thắng 3/3 (17–19 phút)   |
  | Normal       | thắng 1/3, thua ở đợt 10 |
  | Hard         | thua ở đợt 7–9           |
  | Insane       | thua ở đợt 6–8           |

  → Người chơi tập trung phòng thủ nên qua được Normal; Hard/Insane là thử thách. Cần bạn chơi thử để chỉnh tiếp.

### ✅ 4.3 Survival trên giao diện

- Màn Skirmish: thêm "Survival — hold out against enemy waves"; khi chọn thì danh sách AI thành **AI Allies (optional)** (khóa team 1, cho phép 0 AI),
  thêm ô **Wave strength** và **Waves** (5/10/15), minimap xem trước tô đỏ các spawn sẽ là cửa vào của địch. Lựa chọn được nhớ như cũ.
- HUD: ô giữa trên cùng hiện `WAVE 1/10 · NEXT IN 01:25 · 4 HOSTILES` (đỏ khi còn ≤ 20 s); cảnh báo + âm thanh + điểm ping trên minimap
  khi đợt sắp tới; **Space** nhảy camera tới cửa vào; danh sách người chơi ghi "Enemy" cho Hostile Forces.
- Màn kết quả: **SURVIVED** / **OVERRUN** + "all N waves repelled" hoặc "fell during wave x/N"; Rematch giữ nguyên thiết lập Survival.
- Sửa thêm lỗi có từ trước: bảng Match Setup bị tràn ngang (nút map thứ 2 bị cắt + thanh cuộn) → nới rộng bảng, nút map xếp lưới 2 cột.
- Kiểm thử trình duyệt (Chrome) 8/8 PASS: hiện tùy chọn Survival, trận bắt đầu đúng cấu hình, bộ đếm đợt, cảnh báo đợt, ping minimap,
  đợt 1 xuất hiện, bộ đếm hostiles, màn SURVIVED; 0 lỗi console.

### ✅ 4.4 Tutorial

- Mục **Tutorial** mới ở menu chính → trận cố định trên Desert Storm, 8000 credits, đối thủ là **Enemy Outpost** ở góc xa
  (HQ + 5 quân ban đầu, **không có AI Commander**: quân của đồn chỉ tự vệ, không xây, không tấn công).
- 8 mục tiêu làm **theo thứ tự** (`game-core/tutorial.ts`, `TutorialTracker`): chọn quân → di chuyển → Power Plant → Resource Extractor → Barracks
  → huấn luyện 3 quân → chiếm 1 điểm chiến lược → phá đồn địch. Làm trước một bước sau (vd. xây Power Plant trước) thì không bỏ qua bước trước,
  nhưng khi tới lượt sẽ tự tính là xong.
- HUD: khung **TUTORIAL x/8** ở góc trên trái với tên mục tiêu, hướng dẫn cụ thể (bấm gì, ở đâu) và danh sách ✓ / ▶; thông báo + âm thanh khi xong một bước;
  thanh trên cùng ghi "Tutorial: follow the objectives". Phá xong đồn → VICTORY.
- Test: game-core +3 (thiết lập cố định 1v1 xa nhau; mục tiêu đúng thứ tự, nhiều bước xong cùng lúc; xong khi phá đồn và thắng trận).
- Kiểm thử trình duyệt (Chrome) 12/12 PASS: chọn quân bằng **Q** và di chuyển bằng **chuột phải** thật, xây Power Plant / Extractor / Barracks bằng nút HUD + click map,
  huấn luyện 3 Rifleman bằng nút HUD, khung tiến độ 7/8, chiếm điểm, thông báo hoàn thành, màn VICTORY; 0 lỗi console.

### ✅ 4.5 Importer Tiled JSON + map thứ 3 "River Crossing"

- `game-data/src/tiled.ts` — `parseTiledMap(json, id) → MapDef` cho map Tiled dạng orthogonal, lưu JSON (.json/.tmj), tileset nhúng:
  - layer ô `terrain`: mỗi ô của tileset có thuộc tính `kind` (sand/grass/road/concrete/ore/rock/water/urban); bỏ qua cờ lật/xoay trong gid;
  - layer object `spawns` (sắp theo thuộc tính `index`) và `points` (tên object = tên điểm chiến lược); tọa độ pixel → ô;
  - thuộc tính map `name`, `description`, `oreAmount`.
  - Báo lỗi rõ ràng (`TiledImportError`) cho các lỗi soạn map thường gặp: sai orientation, map infinite, thiếu layer, layer nén base64 thay vì CSV,
    sai số ô, gid không có `kind`, `kind` lạ, tileset rời (.tsx), thiếu spawn/điểm, spawn nằm ngoài map.
- **Map thứ 3 — River Crossing** (`game-data/src/maps/river-crossing.json` + ảnh tileset `terrain-tiles.png` để mở được trong Tiled):
  thung lũng cỏ bị chia đôi bởi một con sông uốn lượn, **3 cây cầu** (cũng là 3 điểm chiến lược: West / Central / East Bridge) và **2 bãi cạn** đi bộ qua được;
  đồi đá, bãi cát, quặng ở mỗi căn cứ và quặng tranh chấp gần các chỗ qua sông; **đối xứng xoay 180°** nên công bằng cho 1v1 và 2v2.
  File được tạo lần đầu bằng `tools/gen-river-crossing.mjs`; từ giờ file JSON là bản gốc — mở bằng Tiled, sửa, lưu là game dùng ngay.
- Map tự động có trong màn Skirmish (nút map xếp lưới), Survival và minimap xem trước.
- Test: game-data +3 (chuyển đổi ô / cờ lật / thứ tự spawn / điểm / thuộc tính; 9 lỗi soạn map đều báo đúng thông báo; River Crossing 64×64, 4 spawn,
  3 cầu, đối xứng 180°) + test chung cho mọi map tự áp dụng (spawn và điểm chiến lược đi tới được, có quặng gần mỗi căn cứ).
- AI vs AI trên River Crossing (Normal/Hard, 6 trận): AI xây mỏ, giành cầu qua lại (4–18 lần đổi chủ), trận nào cũng có kết quả (5.7–20.3 phút).
- Kiểm thử trình duyệt (Chrome) 4/4 PASS: map có trong danh sách + mô tả, vào trận đúng map, quân qua sông bằng cầu theo lệnh chuột phải; 0 lỗi console.

### ✅ 4.6 Mô phỏng cân bằng, kiểm tra cuối, tài liệu
- **Mô phỏng AI vs AI** (3 map × Normal/Hard × 3 cặp tính cách = 18 trận) cho thấy trận kết thúc quá sớm (thường 5–9 phút).
  Truy vết từng 30 s: AI **Rush** bị giữ "chưa được tấn công" tới 4:12 nhưng vẫn sản xuất liên tục → dồn **61 quân / 12.100 credits** rồi quét sạch
  đối thủ đang đầu tư công trình (Warlord chỉ có 15 quân).
- Sửa (AI): trước giờ được tấn công lần đầu, AI **dừng sản xuất quân khi giá trị quân đạt 1.5× ngưỡng tấn công** (giữ tiền lại; phòng thủ vẫn ưu tiên).
  Kết quả: trận Normal dài thêm ~1–1.5 phút (vd. 6.9→8.0, 7.0→8.2, 7.8→9.3 phút), hết hiện tượng "dồn 60 quân".
- **Ghi chú trung thực:** độ dài trận AI vs AI vẫn ngắn hơn mục tiêu 20–35 phút (đa số 8–15 phút; Hard Rush vs Warlord ~6 phút vì Warlord tham phát triển —
  quan hệ khắc chế bình thường của RTS). AI vs AI không đại diện cho trận có người chơi, nên mình **dừng tinh chỉnh ở đây** và cần bạn chơi thử.
  Câu hỏi thiết kế để ngỏ: có thêm **giới hạn quân số (population cap)** không — master doc có nhắc "unit limitations" nhưng đó là thay đổi luật lớn.
- `pnpm check`: typecheck ✅, lint ✅, test **49/49** (game-data 9, game-core 31, game-ai 6, server 3) ✅, build ✅.
- **Trình duyệt:** 6 bộ test tự động (smoke 9, đợt 2: 8, đợt 3: 7, Survival 8, Tutorial 12, River Crossing 4 = **48 bài**) **PASS trên Chrome, Edge và Firefox**, 0 lỗi console.
  Lần chạy đầu Tutorial trên Chrome hỏng 5 bài do mình sửa file menu đúng lúc test đang chạy (Vite tải lại trang); sau đó phát hiện thêm 1 bài kiểm tra
  đọc HUD quá sớm (HUD cập nhật mỗi 100 ms) → sửa script cho chờ; chạy lại 5 lần liên tiếp đều 12/12. Game không phải sửa.
- Tài liệu: `GAMEPLAY_SYSTEMS.md` (§5e Survival, §5f Tutorial), `AI_DESIGN.md` (§6c), `TECHNICAL_ARCHITECTURE.md` (quy trình map + chuẩn soạn map Tiled),
  `TESTING.md`, `ART_ASSET_GUIDE.md`, `DEVELOPMENT_ROADMAP.md`, `CHANGELOG.md` (0.4.0), `README.md`; menu ghi v0.4.

## Tổng kết đợt 4
- Nội dung offline mới: **Survival** (5/10/15 đợt, 4 mức sức mạnh, AI đồng minh tùy chọn), **Tutorial** 8 bước, **importer Tiled** + map thứ 3 **River Crossing**.
- Đóng lỗ hổng test AI sửa chữa; sửa lỗi tràn khung Match Setup; AI không còn "dồn quân" trước đợt tấn công đầu.
- Chưa làm (theo yêu cầu / cần bạn): playtest người thật để chỉnh độ khó & độ dài trận; quyết định population cap; online; nâng cấp đồ họa.

---

# ĐỢT 5 — Tiếp tục phần offline còn lại (chưa online, chưa nâng cấp đồ họa)

Phạm vi: các mục còn lại làm được mà không cần người chơi thật. Giới hạn quân số làm thành **tùy chọn** (bạn chơi thử rồi quyết định giữ hay tắt).

| # | Công việc | Trạng thái |
|---|---|---|
| 5.1 | **Giới hạn quân số** (population cap): mỗi loại quân tốn điểm quân số, chọn 100 / 150 / 200 / không giới hạn; AI theo cùng luật; HUD hiển thị | ✅ |
| 5.2 | **Chiến dịch** offline: khung nhiệm vụ có briefing + mục tiêu, 3 nhiệm vụ nối tiếp, lưu tiến độ, màn Campaign | ✅ |
| 5.3 | **Map thứ 4** vẽ bằng định dạng Tiled | ✅ |
| 5.4 | Mô phỏng lại độ dài trận với giới hạn quân số, `pnpm check`, test trình duyệt 3 trình duyệt, docs | ✅ |

## Nhật ký đợt 5

### ✅ 5.1 Giới hạn quân số (tùy chọn)
- Mỗi loại quân tốn điểm quân số (`UNIT_SUPPLY`): bộ binh / drone 1, xe trinh sát / APC 2, tăng chủ lực / pháo / trực thăng 3, tăng hạng nặng 4.
  Quân đang chờ trong hàng sản xuất cũng được tính. `MatchConfig.unitCap` (0 = không giới hạn).
- Lệnh `produce` vượt giới hạn bị từ chối: "Unit limit reached (150)"; quân chết thì trả lại chỗ. AI theo **cùng luật** (không xếp hàng khi đã đầy).
  Quân của đợt Survival không bị tính (đó là luật của chế độ chơi).
- Màn Match Setup: ô **Unit limit** 100 / **150 (mặc định)** / 200 / Unlimited, được nhớ như các lựa chọn khác; Tutorial dùng 150.
  HUD: bộ đếm `👥 45/150` trên thanh trên cùng (đỏ khi đầy), nút sản xuất bị khóa với lý do "Unit limit (150)".
- Test: game-core +2 (chặn khi vượt, hàng chờ được tính, quân chết trả chỗ; mặc định không giới hạn).
- **Đo trung thực:** 18 trận AI vs AI với giới hạn 100 và 150 cho độ dài **gần như y hệt** không giới hạn — sau bản sửa ở 4.6, quân AI hiếm khi chạm 100 điểm,
  trận vẫn thường kết thúc khi đợt tấn công đầu thành công. Giới hạn quân số chặn "biển quân" cuối trận chứ **không** làm trận dài hơn.
  Vì vậy để mặc định 150; giữ hay tắt tùy bạn sau khi chơi thử.

### ✅ 5.2 Chiến dịch offline (3 nhiệm vụ)
- Khung nhiệm vụ `game-core/missions.ts`: mỗi nhiệm vụ có tên, briefing, thiết lập trận cố định và danh sách mục tiêu. **Thắng trận = hoàn thành nhiệm vụ**.
  `ObjectiveTracker` dùng chung: mục tiêu **theo thứ tự** (tutorial) hoặc **độc lập** (nhiệm vụ thường; xong rồi thì giữ trạng thái xong kể cả khi mất lại điểm).
- 3 nhiệm vụ mở khóa lần lượt:
  1. **Boot Camp** (Desert Storm) — chính là Tutorial 8 bước.
  2. **Hold the River** (River Crossing, Survival 6 đợt Normal, 6000 credits) — xây Defense Turret, chiếm Central Bridge, đẩy lui 6 đợt.
  3. **Iron Fist** (Urban Conflict, Decapitation 2v2 có AI đồng minh, 8000 credits) — xây War Factory, xây SAM Site, nghiên cứu Improved Munitions,
     phá HQ của cả 2 đối thủ (Iron Guard – Fortress, Desert Hawks – Eagle chuyên trực thăng).
- Giao diện: menu chính có **Campaign** (thay mục Tutorial); màn **Operations** liệt kê nhiệm vụ (✓ complete / available / 🔒 locked), briefing, map, credits,
  giới hạn quân, mục tiêu, nút Start mission; trong trận có khung mục tiêu (tên nhiệm vụ, `1/3 done`, ✓); màn kết quả ghi "mission complete / mission failed",
  nút **Next mission ▶**, **Retry mission**, **Campaign**. Tiến độ lưu trong trình duyệt (`shadow-front.campaign`).
- **Cân bằng bằng mô phỏng** (thay người chơi bằng AI Normal, 3–6 seed):
  - Hold the River: thắng 3/3 (~11 phút) → phù hợp nhiệm vụ 2.
  - Iron Fist ban đầu (2 địch Normal, 6000 credits): **thua 6/6**. Hạ dần độ khó vẫn thua 5/6; thử thay Eagle bằng Rush thì thắng → nguyên nhân là **trực thăng**:
    AI Normal không chọn quân khắc chế không quân (người chơi thì có). Giữ Eagle làm bài học của nhiệm vụ, thêm mục tiêu "Build a SAM Site" + cảnh báo trong briefing,
    đối thủ về Easy, credits 8000. Mô phỏng với AI thay người không đại diện tốt cho nhiệm vụ này → cần bạn chơi thử.
- **Sửa lỗi phát hiện khi mô phỏng:** bộ ngẫu nhiên của AI chỉ phụ thuộc id người chơi, **không phụ thuộc seed trận** → mỗi trận vs AI diễn ra y hệt nhau nếu người chơi làm giống nhau.
  Giờ AI dùng seed của trận (`World.seed`), các trận khác nhau thật.
- Test: game-core +4 (mọi nhiệm vụ tạo được world hợp lệ; mở khóa theo thứ tự; mục tiêu độc lập và giữ trạng thái; Iron Fist chỉ thắng khi cả 2 HQ địch bị phá).
- Kiểm thử trình duyệt (Chrome) 11/11 PASS: danh sách 3 nhiệm vụ, chỉ nhiệm vụ 1 mở, nhiệm vụ khóa không bắt đầu được, Boot Camp có khung mục tiêu,
  thắng → "mission complete" + lưu tiến độ, Next mission → Hold the River (Survival, River Crossing), mục tiêu hoàn thành không theo thứ tự,
  thua → "mission failed" + Retry, màn Campaign hiện tiến độ; bộ Tutorial cũ (12 bài) chạy lại qua đường Campaign: PASS; 0 lỗi console.

### ✅ 5.3 Map thứ 4 "Highland Pass" (Tiled) + nhiệm vụ 4
- **Highland Pass** (`game-data/src/maps/highland-pass.json`): thị trấn có tường đá trên cao nguyên giữa map, có **quặng giàu** bên trong,
  chỉ vào được qua **4 hẻm núi** (B/N/Đ/T); vùng thấp có đồng cỏ và tảng đá; đối xứng xoay 180°. Điểm chiến lược: North Pass, Town Square, South Pass.
- Công cụ: phần chung của các generator tách ra `tools/tiled-lib.mjs` (canvas + vẽ + ghi Tiled JSON + ảnh tileset);
  đã kiểm tra River Crossing sinh lại **giống từng byte** bản cũ. Map mới: `tools/gen-highland-pass.mjs`.
- Map tự có trong Skirmish / Survival. AI vs AI trên map này (6 trận Normal/Hard): xây mỏ, chiếm hẻm, trận nào cũng có kết quả (6–12 phút).
- **Nhiệm vụ 4 — Highland Siege** (1v1 vs AI Normal Warlord, Annihilation): chiếm Town Square, giữ cả 3 điểm cùng lúc, tiêu diệt toàn bộ địch.
- Test: game-data +1 (Highland Pass: tên điểm, đối xứng, tường đá, 4 hẻm đi được, đủ quặng) + test chung cho mọi map (kết nối, quặng gần căn cứ);
  game-core: thứ tự mở khóa đủ 4 nhiệm vụ, mỗi nhiệm vụ dùng đúng map.

### ✅ 5.4 Kiểm tra cuối, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **57/57** (game-data 11, game-core 37, game-ai 6, server 3) ✅, build ✅.
- **Trình duyệt** (Chrome, Edge, Firefox — không phải Internet Explorer, IE đã ngừng hỗ trợ và React 18 / Phaser 3 không chạy trên IE):
  7 bộ test tự động (smoke 9, đợt 2: 8, đợt 3: 7, Survival 8, Tutorial 12, River + 4 map + giới hạn quân 7, Campaign 11 = **62 bài**) — **PASS trên cả 3 trình duyệt**, 0 lỗi console.
  Ghi chú trung thực: trong lượt chạy tổng, Tutorial trên Firefox hỏng 1 lần ở bước click đặt Power Plant; chạy lại 6 lần liên tiếp đều 12/12 →
  lỗi chập chờn của script test (thời điểm click), game không phải sửa.
- Mô phỏng độ dài trận: xem 5.1 (giới hạn quân số không làm trận dài hơn trong AI vs AI) và 5.2 (cân bằng nhiệm vụ).
- Tài liệu: `GAMEPLAY_SYSTEMS.md` (§5g giới hạn quân, §5h chiến dịch), `AI_DESIGN.md` (§6d), `TECHNICAL_ARCHITECTURE.md` (generator map),
  `TESTING.md`, `DEVELOPMENT_ROADMAP.md`, `CHANGELOG.md` (0.5.0), `README.md`; menu ghi v0.5.

## Tổng kết đợt 5
- Mới: **Chiến dịch 4 nhiệm vụ** (Boot Camp → Hold the River → Iron Fist → Highland Siege) có briefing, mục tiêu, mở khóa, lưu tiến độ;
  **giới hạn quân số** tùy chọn (mặc định 150); **map thứ 4 Highland Pass** (Tiled).
- Sửa: AI không dùng seed trận → các trận vs AI giống hệt nhau; nay mỗi trận khác nhau.
- Còn lại (cần bạn / đang hoãn): chơi thử thật để chỉnh độ khó & độ dài trận (AI vs AI vẫn 6–15 phút) và quyết định giữ giới hạn quân số;
  online (Phase 6–7); đồ họa thật.

---

# ĐỢT 6 — Bổ sung tính năng còn thiếu theo `docs/PLAN.md` (phần chơi offline)

Đã đối chiếu toàn bộ 18 nhóm trong `docs/PLAN.md` với game → bảng chi tiết ở **`docs/PLAN_STATUS.md`**.
Phần cần online (tài khoản, bạn bè, chat, lobby online, PvP/Co-op online, matchmaking, ranking, admin) và đồ họa/âm thanh thật vẫn **hoãn** theo yêu cầu trước.
Đợt này làm các mục còn thiếu chơi được offline:

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 6.1 | Điều khiển: lệnh **Patrol**, **bán công trình (Sell)**, **kinh nghiệm/cấp bậc unit** | §7, §9 | ✅ |
| 6.2 | Unit mới: **Sniper, Medic, Engineer** + **1 unit đặc trưng cho mỗi faction** | §5, §9 | ✅ |
| 6.3 | Công trình mới: **Radar Station, Wall, Missile Launcher** | §7 | ✅ |
| 6.4 | Chế độ **Domination** + **Random Map** | §4, §6 | ✅ |
| 6.5 | **Hồ sơ người chơi offline**: nickname, level/XP, thống kê, lịch sử trận, thành tích | §2, §15 | ✅ |
| 6.6 | Settings & âm thanh: **toàn màn hình**, **nhạc nền procedural**, âm lượng nhạc/hiệu ứng riêng, bảng phím tắt | §13, §14, §16 | ✅ |
| 6.7 | AI dùng nội dung mới, test, trình duyệt Chrome/Edge/Firefox, docs | §11 | ✅ |

## Nhật ký đợt 6

### ✅ 6.1 Patrol, bán công trình, kinh nghiệm/cấp bậc unit
- **Patrol** (phím **T** rồi click, hoặc nút Patrol): mỗi unit attack-move qua lại giữa chỗ đang đứng và điểm được chọn, gặp địch thì đánh rồi đi tiếp;
  HUD ghi "Patrolling". Lệnh mới `patrol` (chỉ unit có vũ khí).
- **Sell**: nút "$ Sell (+giá)" khi chọn công trình đã xây xong của mình (trừ HQ): hoàn **50% giá × % máu còn lại**, quân trong hàng chờ và nghiên cứu
  đang chạy được hoàn đủ; ô đất được giải phóng; không tính là "mất công trình" trong thống kê. Lệnh mới `sell`, event `sold`.
- **Veterancy**: unit nhận XP = giá trị thứ nó tiêu diệt (công trình tính 50%); đạt 1× / 2.5× / 5× giá của chính nó → **Veteran / Elite / Heroic**:
  mỗi cấp +10% sát thương và +10% máu tối đa; Heroic tự hồi 1% máu/giây. Trụ phòng thủ không lên cấp. Event `promoted` → thông báo + âm thanh;
  trên bản đồ có chữ V vàng (▲) trên đầu unit theo cấp; panel chọn unit ghi cấp bậc.
- Test: game-core +6 (patrol đi tới rồi quay về và vẫn tiếp tục tuần tra; patrol từ chối unit không vũ khí; sell hoàn đúng tiền + giải phóng ô + không tính mất;
  không bán được HQ / công trình địch / đang xây; XP → cấp → +sát thương/+máu, event; Heroic tự hồi máu; trụ phòng thủ tiêu diệt không lỗi).
- Kiểm thử trình duyệt: gộp ở bước 6.7.

### ✅ 6.2 Unit mới: Sniper, Medic, Engineer + unit đặc trưng cho mỗi faction
- **Sniper** (Barracks, cần War Factory, 350): tầm 9 (bộ binh thường 5), 70 sát thương — 2 phát hạ một Rifleman; không bắn được xe giáp hiệu quả hay máy bay.
- **Medic** (Barracks, 200): không vũ khí, tự hồi **8 máu/giây** cho bộ binh đồng minh bị thương gần nhất trong bán kính 3.
- **Engineer** (Barracks, 300): không vũ khí, tự sửa **15 máu/giây** cho xe và công trình đồng minh trong bán kính 3, miễn phí (`systems/support.ts`).
- **Unit đặc trưng** (chỉ faction đó sản xuất được; faction khác bị từ chối "not available to your faction" và không thấy nút):
  | Faction | Unit | Vai trò |
  |---|---|---|
  | Western Alliance | **Ranger** (Special Forces) | bộ binh tinh nhuệ: nhanh, 160 máu, súng mạnh |
  | Eastern Legion | **Rocket Launcher (MLRS)** | pháo phản lực bắn loạt, vùng nổ rộng |
  | Pacific Technology | **Gunship** | trực thăng pháo xoay, diệt bộ binh |
  | Desert Corps | **Light Tank** | xe tăng nhẹ rất nhanh để đánh tạt sườn |
  | Iron Republic | **IFV** | xe chiến đấu bộ binh bọc giáp, bắn được cả máy bay |
- Đồ họa: vẫn procedural — Sniper súng dài, Medic mũ trắng + chữ thập đỏ, Engineer mũ vàng + ba lô; unit faction dùng lại mô hình khung gần nhất
  (trường `look`); icon HUD tương ứng. Giới hạn quân số đã có giá trị cho tất cả unit mới.
- **AI**: chỉ chọn unit hợp faction; mọi tính cách đều thích unit đặc trưng; xây tối đa 2 Medic / 2 Engineer khi đã có ≥ 6 quân (ngẫu nhiên 15% mỗi lần chọn để không lấn quân chiến đấu).
  Mô phỏng 3 trận Hard: AI dùng Ranger (13–47), Sniper (14–17), IFV, Medic / Engineer 2–6. Gunship / MLRS chỉ xuất hiện khi tính cách AI có sân bay / thích pháo.
- Test: game-core +5 (mỗi faction đúng 1 unit đặc trưng; chỉ faction đó sản xuất được; Medic hồi bộ binh không hồi xe; Engineer sửa công trình, không sửa địch; Sniper vượt tầm).
- **Phát hiện về quy trình kiểm tra:** lệnh `pnpm -s typecheck` (chế độ im lặng) **ẩn cả thông báo lỗi**, nên các lần kiểm tra nhanh giữa chừng bằng lệnh đó không đáng tin.
  Các đợt trước vẫn ổn vì cuối mỗi đợt đều chạy `pnpm check` đầy đủ và lọc dòng lỗi; từ giờ không dùng `-s` nữa.

### ✅ 6.3 Công trình mới: Radar Station, Wall, Missile Launcher
- **Radar Station** (2×2, 1000, −40 điện, cần War Factory): tầm nhìn **20 ô** quanh căn cứ để thấy địch tới sớm; đĩa radar quay (animation).
- **Wall** (1×1, 50, cần Barracks): khối bê tông 1500 máu chặn đường quân mặt đất; giữ **Shift + click** để đặt liên tiếp.
- **Missile Launcher** (1×1, 1200, −40 điện, cần Research Center): bệ tên lửa chống mặt đất tầm **12** (xa hơn xe tăng), nổ lan nhỏ, **không bắn được máy bay**.
- Bảng Construction đổi sang lưới 6 cột (11 công trình vừa 2 hàng). Icon + hình procedural cho cả 3.
- AI: tính cách phòng thủ (Fortress, Warlord) xây 1 Missile Launcher khi có Research Center; AI Hard/Insane xây 1 Radar Station. AI không xây tường (tránh tự chặn đường).
- Test: game-core +1 (tường chặn ô đi + xây được bằng lệnh; radar thấy xa 18+ ô; Missile Launcher bắn xe tăng, không bắn trực thăng).

### ✅ 6.4 Chế độ Domination + Random Map
- **Domination** (mission `domination`): mỗi điểm chiến lược team đang giữ cho **+1 điểm/giây**; team đầu tiên đạt **1500** thắng
  (luật tiêu diệt vẫn áp dụng). Thanh trên cùng hiện `DOMINATION · YOU 240 · ENEMY 310 / 1500`.
  Mốc ban đầu 600 làm trận kết thúc sau ~6.3 phút trong mô phỏng → nâng lên 1500 (giữ 2 điểm ≈ 12.5 phút, giữ cả 3 ≈ 8.3 phút).
  Mô phỏng AI vs AI sau đó: trận kết thúc 7.8–9.6 phút do một bên bị tiêu diệt trước khi đạt điểm — cùng vấn đề nhịp trận như các chế độ khác.
- **Random Map**: nút **🎲 Random** trong danh sách map + nút **🎲 New map** để đổi; map 64×64 sinh từ `mapSeed`, 3 chủ đề (Dunes / Valley / Outskirts),
  đá, hồ, dãy núi, quặng nhà + quặng tranh chấp, đường, 3 điểm chiến lược (Centre + cặp Outpost), **đối xứng xoay 180°**;
  ứng viên nào bị chặn (spawn / điểm không đi tới được, thiếu quặng gần căn cứ) sẽ bị **sinh lại** (`mapIsPlayable`). Xem trước trên minimap, seed được nhớ.
  Dùng được cho Skirmish, Survival và Domination.
- Test: game-data +1 (cùng seed → cùng map, khác seed → khác map, **40 seed đều chơi được**, cache); game-core +2 (Domination tính điểm & thắng ở mốc;
  World dùng `mapSeed`). Sửa test MVP cũ ("8–12 loại unit" → bộ unit chung 8–12 + đúng 5 unit faction).

### ✅ 6.5 Hồ sơ người chơi offline: level/XP, thống kê, lịch sử, thành tích
- Logic thuần trong `game-core/progression.ts` (test được), lưu trong trình duyệt (`shadow-front.profile`, dữ liệu hỏng được làm sạch / tạo mới).
- **XP mỗi trận** = 100 + 250 nếu thắng + 3/kill + 1/unit xây + 10/phút (tối đa 60 phút), × độ khó AI địch (Easy 1, Normal 1.25, Hard 1.6, Insane 2).
  **Level**: lên cấp n → n+1 cần 500 + 250·(n−1) XP.
- **Thống kê**: số trận, thắng/thua, tỉ lệ thắng, địch bị tiêu diệt, unit xây/mất, credits kiếm được, thời gian chơi, số trận thắng theo từng faction.
- **Lịch sử**: 20 trận gần nhất (kết quả, chế độ, map, faction, thời gian, kill, XP).
- **13 thành tích**: First Blood, First Victory, Veteran Commander (10 thắng), Hard Target, Beyond Insane, Blitzkrieg (< 10 phút), Last Stand (Survival ≥ 10 đợt),
  Dominator, Explorer (thắng map ngẫu nhiên), Hero of the Front (unit lên Heroic), Centurion (100 kill), Campaign Complete, Master of Arms (thắng với cả 5 faction).
- Giao diện: menu chính có **Profile** + thẻ góc phải (nickname, level, thanh XP, số thành tích); màn **Profile** (đổi nickname, chọn emblem faction, level,
  thống kê, lưới thành tích 🏆/🔒, bảng lịch sử, nút reset có xác nhận); màn kết quả hiện **+XP**, **Level up!** và thành tích mới mở khóa.
  Nickname của hồ sơ là tên mặc định trong Skirmish và Campaign.
- Test: game-core +5 (bảng level; XP theo thắng/độ khó; cập nhật thống kê + lịch sử + mở khóa đúng một lần; các thành tích đặc biệt; giới hạn lịch sử + làm sạch dữ liệu lưu).

### ✅ 6.6 Settings & âm thanh
- **Nhạc nền procedural** (`game/music.ts`, Web Audio, không dùng file → không vướng bản quyền): menu là pad hợp âm chậm (Am–F–C–G),
  trong trận thêm bass + trống nhịp đều. Tự đổi theo màn hình; bật sau thao tác đầu tiên của người chơi (chính sách autoplay của trình duyệt).
- **Âm lượng riêng**: "Effects volume" và "Music volume" (mặc định 35%), có trong Settings và menu Pause; được lưu.
- **Toàn màn hình**: nút "⛶ Toggle fullscreen" trong Settings và menu Pause.
- **Bộ đếm FPS**: tùy chọn "Show FPS counter" — trước đây giá trị `showFps` có trong cài đặt nhưng **không được dùng ở đâu**; giờ hiện FPS thật ở góc màn hình trận.
- **Bảng phím tắt** trong Settings (15 dòng, có phím mới T = Patrol, Shift+click đặt nhiều tường). Đổi phím (rebinding) chưa làm.
- Ghi chú: mình không nghe được âm thanh — chỉ kiểm tra được bằng trạng thái AudioContext / lịch phát trong trình duyệt (bước 6.7). Chất lượng nhạc cần bạn nghe thử.


---

# ĐỢT 7 — Tiếp tục tính năng còn thiếu trong `docs/PLAN.md` (offline)

Nguồn: các mục ⬜ trong `docs/PLAN_STATUS.md`. Vẫn chưa làm online / đồ họa thật.

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 6.7 | (hoàn tất đợt 6) chạy lại test trình duyệt lỗi, ghi kết quả | — | ✅ |
| 7.1 | **Chở quân**: APC chở 5 bộ binh, unit mới **Transport Helicopter** chở 6; công trình **Bunker** cho 4 bộ binh vào trú và bắn ra | §7, §9 | ✅ (AI chưa dùng) |
| 7.2 | **Nâng cấp công trình** (cấp 2 cho phòng thủ & Power Plant) + **công nghệ riêng từng faction** | §5, §7 | ✅ |
| 7.3 | Chế độ **Capture the Flag** | §4 | ✅ |
| 7.4 | Địa hình mới **tuyết, rừng** + 4 map trong PLAN: **Snowfield, Forest Warfare, Island Conflict, Industrial Zone** | §6 | ✅ |
| 7.5 | **Chọn màu quân đội**, **chuyển tiền cho đồng đội**, **đổi phím tắt**, **chế độ hiệu năng** | §3, §8, §13, §16 | ✅ |
| 7.6 | **Nhiệm vụ ngày / tuần** + **danh hiệu** (offline) | §15 | ✅ |
| 7.7 | AI dùng nội dung mới, test, trình duyệt Chrome/Edge/Firefox, docs | — | ✅ |

## Nhật ký đợt 7

### ✅ 6.7 AI dùng nội dung mới, kiểm tra, tài liệu
- AI: xem 6.2 (unit faction, Medic/Engineer) và 6.3 (Radar, Missile Launcher); Domination dùng logic chiếm điểm sẵn có.
- `pnpm check`: typecheck ✅, lint ✅, test **78/78** (game-data 13, game-core 56, game-ai 6, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round6** (23 bài): thẻ hồ sơ + trang Profile + đổi nickname, Settings (âm lượng nhạc/hiệu ứng, toàn màn hình, bảng phím, FPS),
  nhạc menu → nhạc trận, Domination trên map ngẫu nhiên + đổi map, nút công trình mới, đội hình theo faction (Ranger/Sniper/Medic/Engineer có, Light Tank/IFV ẩn),
  sản xuất Medic, Sell qua HUD, Patrol bằng T + click (panel ghi "Patrolling"), lên cấp Heroic, +XP và thành tích ở màn kết quả, lịch sử trong Profile.
- Kết quả 8 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS, 0 lỗi console** sau khi xử lý:
  - `round2` "volume slider in pause menu" hỏng trên Chrome + Edge: test tìm nhãn cũ "Sound volume" — ở 6.6 đã đổi thành "Effects volume" + "Music volume"
    → cập nhật test (game đúng).
  - `smoke2` (Power Plant) và `tutorial` (Extractor) hỏng 1 lần trên Chrome, `river` / `campaign` trên Firefox lỗi "detached Frame" của driver
    → chạy lại riêng đều PASS (lỗi chập chờn của script / driver, game không phải sửa).

## Tổng kết đợt 6
- Đã đối chiếu toàn bộ `docs/PLAN.md` → `docs/PLAN_STATUS.md`. Đã làm các mục offline giá trị nhất: Patrol, Sell, Veterancy, 8 unit mới (3 chung + 5 faction),
  3 công trình mới, Domination, Random Map, hồ sơ người chơi offline (level/XP/thống kê/lịch sử/13 thành tích), nhạc nền, âm lượng riêng, toàn màn hình, bộ đếm FPS, bảng phím.
- Phát hiện & sửa: `showFps` có trong cài đặt nhưng không dùng; `pnpm -s` che lỗi typecheck (đã đổi cách kiểm tra).

### Kiểm tra đối chiếu PLAN / PLAN_STATUS / RESULT với code và docs (2026-11-19)
- Code: `pnpm typecheck` ✅; `pnpm test` ✅ **78/78** (game-data 13, game-core 56, game-ai 6, server 3). Lần chạy đầu game-core báo lỗi dù mọi test đều qua;
  chạy riêng và chạy lại toàn bộ đều pass → lỗi chập chờn khi chạy song song, chưa tìm ra nguyên nhân.
- Các mục ✅ của đợt 6 trong `PLAN_STATUS.md` đều có trong code (unit, công trình, lệnh, Domination, Random Map, hồ sơ, nhạc, FPS, toàn màn hình).
- **Đợt 7.1 đã làm một phần mà chưa ghi**: lệnh `load` / `unload`, `systems/transport.ts`, APC chở 5, Transport Helicopter chở 6, Bunker 4 chỗ (bắn khi có quân).
  Chưa có nút HUD, AI chưa dùng, chưa có test → ghi 🟡.
- Docs đã bổ sung phần còn thiếu:
  - `GAME_DESIGN.md` (vẫn ở mức v0.1): thêm unit/công trình v0.6, unit faction, chế độ Survival/Campaign/Domination (trước ghi "future"), 4 map + Random Map, hồ sơ offline.
  - `GAMEPLAY_SYSTEMS.md`: Sniper, quân số của unit mới, điều kiện tiên quyết mới, lệnh Patrol/Sell, công thức XP hồ sơ, §5j chở quân / Bunker (đang làm).
  - `TECHNICAL_ARCHITECTURE.md`: đúng thứ tự system trong `World.step`, đủ danh sách event, module missions/progression, Random Map, âm thanh/nhạc procedural.
  - `ART_ASSET_GUIDE.md`: texture cache, `UnitDef.look` cho unit mới, âm thanh procedural (không có file).
  - `TESTING.md`: số test 13 / 56 / 6 / 3 và phạm vi mới.
  - `PLAN_STATUS.md`: bỏ dòng §9 bị lặp; thêm Avatar (🟡 emblem), Bunker / Transport Heli / chở quân (🟡), §16 camera zoom, điều khiển bàn phím, độ nhạy chuột, độ phân giải.

### ✅ 7.1 Chở quân + Bunker
- **APC** chở **5** bộ binh; unit mới **Transport Helicopter** (Airfield, 900, không vũ khí) chở **6**, bay qua mọi địa hình,
  chỉ thả quân được khi bên dưới có đất trống (trên mặt nước sẽ báo "No open ground below to unload").
- Công trình mới **Bunker** (2×2, 600, 2200 máu, cần Barracks): tối đa **4** bộ binh trú bên trong; **chỉ bắn khi có người**, sát thương × số người trú;
  người trú được che chắn hoàn toàn. Bunker bị phá hoặc bị bán → người bên trong thoát ra.
- Cách dùng: chọn bộ binh → **chuột phải** lên APC / trực thăng / Bunker của mình để vào; panel hiện `👥 3/5 inside` + nút **Unload** (phím **U**).
  Lính đang đi tới xe hiện trạng thái "Getting in"; xe đang chạy thì lính tự đuổi theo.
- Luật: chỉ bộ binh lên được; quá sức chứa bị từ chối "Transport is full"; người bên trong vẫn tính vào giới hạn quân số;
  xe bị phá → người bên trong chết theo (tính vào thống kê mất quân). Lệnh mới `load` / `unload`, event `boarded` / `unloaded`.
- Cách làm: người lên xe tạm rời khỏi bản đồ (lưu trong `passengers` của xe/bunker) nên di chuyển, chiến đấu, sương mù, chọn quân tự bỏ qua họ.
- AI: chưa dùng chở quân / bunker (không xây Transport Helicopter) — ghi nhận là giới hạn hiện tại.
- Đồ họa procedural: Bunker bê tông màu ô liu có khe bắn, bao cát, súng máy trên nóc; icon mới. Trực thăng vận tải dùng mô hình trực thăng có sẵn.
- Test: game-core +5 (lên APC, theo xe, thả quân cạnh xe; sức chứa + chết theo xe; trực thăng không thả trên nước nhưng thả được trên đất;
  Bunker im lặng khi trống, bắn khi có 4 người, phá thì người thoát ra; chỉ bộ binh vào bunker + bán bunker thả người).
  Lần chạy đầu test thất bại do **mình đặt lính ngay trên dãy đá** của map (không phải lỗi code) → dời vị trí test.

### ✅ 7.2 Công nghệ riêng từng faction + nâng cấp công trình
- **Công nghệ faction** (Research Center, chỉ faction đó nghiên cứu được; faction khác không thấy và bị từ chối):
  | Faction | Công nghệ | Hiệu ứng |
  |---|---|---|
  | Western Alliance | Combat Medkits | bộ binh +25% máu tối đa |
  | Eastern Legion | Reactive Armor | unit giáp nặng nhận ít hơn 15% sát thương |
  | Pacific Technology | Nano Repair | xe và máy bay tự hồi 0.5% máu/giây |
  | Desert Corps | Turbo Engines | xe và pháo nhanh hơn 15% |
  | Iron Republic | Fortified Structures | mọi công trình +25% máu tối đa |
  Áp dụng cho cả unit/công trình đang có và cái mới.
- **Nâng cấp công trình lên Level 2** (nút "⬆ Upgrade (giá)" trong panel, hiện % tiến độ; tên ghi "★ Level 2"; thiếu điện thì chậm lại):
  Power Plant (400: +20% máu, **+50% điện**), Defense Turret / SAM Site (500: +50% máu, **+50% sát thương**),
  Missile Launcher (700: +40% / +40%), Bunker (400: +60% máu). Bán công trình đang nâng cấp → hoàn tiền nâng cấp. Lệnh `upgrade`, event `upgraded`.
- **AI**: nghiên cứu công nghệ faction sau danh sách theo tính cách; tính cách có phòng thủ nâng cấp công trình khi dư ≥ giá + 800.
- Test: game-core +5 (mỗi faction đúng 1 công nghệ + chặn faction khác; Medkits / Turbo / Fortified áp cho cái cũ và mới;
  Reactive Armor giảm sát thương, Nano Repair hồi máu; nâng cấp trừ tiền, mất thời gian, ra chỉ số Level 2, chặn nâng cấp lặp;
  Power Plant Level 2 +50% điện, HQ không nâng cấp được).

### ✅ 7.3 Chế độ Capture the Flag
- Mission `ctf`: mỗi team có **1 lá cờ** cắm cách HQ vài ô (về phía giữa map). Quân **mặt đất** của địch chạm cờ → nhặt cờ (máy bay không nhặt được);
  lính cầm cờ **chậm còn 60%**; lính cầm cờ chết (hoặc lên xe) → cờ **rơi tại chỗ**; quân của chủ cờ chạm vào cờ rơi → cờ **về nhà ngay**;
  mang cờ địch về **điểm cắm cờ của mình khi cờ mình đang ở nhà** → +1. **3 lần** trước thì thắng (luật tiêu diệt vẫn áp dụng).
- Giao diện: chọn "Capture the Flag" trong Match Setup; bản đồ có vòng tròn điểm cắm cờ + cờ màu team (cờ được mang theo lính, cờ rơi nhấp nháy);
  minimap có hình thoi màu cho từng cờ; thanh trên cùng `CAPTURE THE FLAG · YOU 1 · ENEMY 0 / 3 · OUR FLAG TAKEN`;
  thông báo + âm thanh + ping minimap khi cờ mình bị cướp; thông báo khi cờ rơi / về nhà / bị chiếm.
- AI: tổ 4 quân nhanh nhất đi cướp cờ địch (vị trí cờ là thông tin công khai), lính cầm cờ chạy thẳng về nhà, quân ở nhà truy đuổi khi cờ mình bị mất.
- Mô phỏng AI vs AI (3 map): có cướp / rơi / trả cờ thật; trận 5–8.5 phút. **Rush luôn thắng** vì tấn công sớm — cùng vấn đề nhịp độ AI đã ghi nhận;
  đã thêm luật cầm cờ chậm 60% (trước đó 4.9–7.3 phút) nhưng không đổi kết quả. Cần chơi thử để chỉnh.
- Test: game-core +4 (mỗi team 1 cờ trên ô đi được gần HQ, chế độ khác không có cờ; nhặt → mang → chiếm, trả cờ về, 3 lần thì thắng;
  lính cầm cờ chết → rơi, chủ cờ chạm → về nhà; không chiếm được khi cờ mình đang bị cướp, máy bay không nhặt cờ).

### ✅ 7.4 Địa hình tuyết / rừng + 4 map trong PLAN
- Loại ô mới: **snow** (đi được, nền trắng có vệt tuyết) và **forest** (chặn đường, vẽ 1–2 cây mỗi ô). Thêm vào **cuối** danh sách loại ô
  để mã ô của các map Tiled cũ không đổi (đã kiểm tra bằng git: River Crossing chỉ đổi metadata tileset, không đổi dòng địa hình nào).
- 4 map mới (Tiled JSON, sinh bằng `tools/gen-plan-maps.mjs`, đối xứng xoay 180°, 4 spawn, 3 điểm chiến lược):
  | Map | Đặc điểm |
  |---|---|
  | **Snowfield** | đồng tuyết, rừng thông, hồ băng, dãy đá — tầm nhìn xa, ít nút thắt |
  | **Forest Warfare** | rừng rậm chia bởi đường mòn và khoảng trống — phục kích, quân phải đi theo lối |
  | **Island Conflict** | căn cứ trên đảo nối bằng các con đường đắp cát quanh một đảo giữa — máy bay mạnh, quân bộ dồn ở chỗ qua |
  | **Industrial Zone** | nhà máy, bãi đường ray, kênh đào có cầu — phố hẹp hợp bộ binh và giáp tầm gần |
- **Lỗi bắt được nhờ test kết nối**: bản đầu của Island Conflict có căn cứ không đi tới được — (1) đảo giữa không được vẽ vì truyền tâm 31.5
  (tọa độ lẻ làm `set` ghi vào chỉ số không nguyên), (2) đường đắp phía tây chỉ có ở nửa bắc. Đã sửa map và cho `set` làm tròn tọa độ.
- Sửa test MVP: bộ unit chung giờ 13 loại (thêm Transport Helicopter) → giữ mức tối thiểu 8 của MVP, bỏ giới hạn trên 12.
- Mô phỏng AI vs AI Normal (12 trận): mọi map chơi được; trận **9–31 phút** (1 trận hòa 40 phút ở Island Conflict) — dài hơn các map cũ nhờ nhiều nút thắt.

### ✅ 7.5 Chọn màu quân, chuyển tiền cho đồng đội, đổi phím tắt, chế độ hiệu năng
- **Màu quân đội**: Match Setup có hàng "Army colour" (auto = màu faction, hoặc 8 màu); màu đã có người dùng thì tự đổi sang màu trống. `MatchSlot.color`.
- **Chuyển tiền cho đồng đội**: nút **+500◆** cạnh tên đồng minh còn sống trong bảng người chơi (góc phải); lệnh `transfer` chỉ cho đồng đội,
  không cho người đã bị loại, không âm, không quá số tiền đang có; thông báo cho cả hai bên.
- **Đổi phím tắt**: Settings → Controls: bấm vào phím của hành động rồi nhấn phím mới (Esc hủy); trùng phím thì hai hành động **đổi chỗ**;
  các phím cố định (WASD / mũi tên, 1–9, Esc, - / =, F10, Tab) không gán được; có nút "Reset keys to defaults". Áp dụng ngay trong trận
  (Attack-move, Patrol, Stop, Hold, Retreat, Select army, Unload, Alert, Pause). Được lưu, dữ liệu hỏng thì trở về mặc định.
- **Chế độ hiệu năng**: Settings → "Performance mode": giữ khoảng 1/3 hạt hiệu ứng (giới hạn 350 thay vì 1400), bỏ vết cháy trên mặt đất.
- Test: game-core +2 (chuyển tiền: hợp lệ / khác team / quá tiền / âm / đồng đội bị loại; màu được chọn + màu trùng tự đổi). Đổi phím kiểm tra trên trình duyệt (7.7).

### ✅ 7.6 Nhiệm vụ ngày / tuần + danh hiệu (offline)
- **Nhiệm vụ**: mỗi ngày 3 nhiệm vụ (chọn từ 6), mỗi tuần 3 nhiệm vụ (chọn từ 5) — chọn **cố định theo ngày / tuần ISO (UTC)** nên ổn định, không đổi khi mở lại game.
  Ví dụ: thắng 1 trận (+150 XP), tiêu diệt 30 địch, xây 25 unit, chơi 20 phút, thắng Domination/CTF, vượt 5 đợt Survival; tuần: thắng 5 trận (+600),
  tiêu diệt 300 địch, thắng AI Hard/Insane (+800), chơi 2 giờ, thắng với 3 faction khác nhau (+700).
  Tiến độ cộng sau mỗi trận, xong thì **tự nhận XP** (chỉ một lần mỗi kỳ); sang ngày / tuần mới thì tiến độ kỳ đó làm lại.
- **Danh hiệu**: Recruit → Lieutenant (lv 5) → Captain (10) → Major (20) → Colonel (35) → General (50), và Hero of the Front / Survivor / Strategist / Warmaster
  theo thành tích. Chọn trong Profile (danh hiệu chưa mở bị khóa + ghi điều kiện); hiện trên thẻ ở menu chính; danh hiệu bị khóa thì hiển thị Recruit.
- Giao diện: Profile có mục **Challenges** (thanh tiến độ, ✔ khi xong, phần thưởng) và ô **Title**; màn kết quả hiện nhiệm vụ vừa hoàn thành (+XP) và danh hiệu mới.
- Test: game-core +4 (khóa tuần ISO đúng cả các ngày biên: 2021-01-01 → 2020-W53, 2024-12-30 → 2025-W01; 3+3 nhiệm vụ ổn định trong kỳ và thay đổi giữa các ngày;
  phần thưởng chỉ nhận một lần, sang ngày mới làm lại; danh hiệu mở theo level / thành tích, danh hiệu bị khóa hiển thị Recruit).

### ✅ 7.7 AI dùng nội dung mới, kiểm tra, trình duyệt, tài liệu
- AI: dùng unit / công nghệ riêng của faction, nâng cấp công trình (khi dư tiền), chơi CTF (giữ cờ nhà + cử nhóm nhanh đi cướp cờ);
  RNG của AI lấy theo seed trận nên mô phỏng lặp lại được. **Chưa dùng** chở quân (APC / Transport Helicopter) và Bunker.
- `pnpm check`: typecheck ✅, lint ✅, test **102/102** ✅, build ✅.
- Bộ test trình duyệt mới **round7** (27 bài):
  - Đổi phím Patrol → V, phím W bị từ chối vì là phím cố định; chế độ hiệu năng; Profile có nhiệm vụ ngày/tuần + danh hiệu bị khóa.
  - CTF trên Snowfield với màu tự chọn + AI đồng minh; +500 tiền cho đồng minh; cảnh báo "Our flag has been taken".
  - Chuột phải vào APC → bộ binh lên xe, hàng chở hiện "n/5", U thả quân; sau khi đổi phím, T không còn tác dụng và V = patrol (panel ghi đúng "Patrol V").
  - Nâng cấp turret "Upgrade (500)", có Bunker trong bảng xây, Research Center chỉ hiện công nghệ của faction mình.
  - Thắng CTF → màn kết quả có +XP; Forest / Island / Industrial tải được.
- Sửa trong lúc test: nhãn phím trên panel lệnh và gợi ý giờ **đổi theo phím đã gán** (trước đó vẫn ghi phím mặc định).
- Kết quả 9 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS (112/112 bài mỗi trình duyệt), 0 lỗi console**.
  Lần chạy đầu trên Firefox bị dừng vì lỗi `fork` của shell (không phải lỗi game) → chạy lại toàn bộ Firefox đều PASS.
- Tài liệu cập nhật v0.7: CHANGELOG, README, GAMEPLAY_SYSTEMS, AI_DESIGN, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS
  (giữ nguyên phần người khác đã sửa, chỉ cập nhật các mục liên quan); chữ phiên bản ở menu chính → v0.7.

## Tổng kết đợt 7
- Đã xong: chở quân (APC, Transport Helicopter, Bunker), nâng cấp công trình, công nghệ riêng từng faction, chế độ Capture the Flag,
  địa hình tuyết / rừng và 4 map mới (tổng 8 map + map ngẫu nhiên), chọn màu quân, chuyển tiền cho đồng đội, đổi phím tắt, chế độ hiệu năng,
  nhiệm vụ ngày / tuần, danh hiệu.
- Chất lượng: 102 unit test, 9 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Còn lại (offline): AI chưa dùng chở quân / Bunker; nhịp chơi Rush còn quá mạnh; chưa có Fighter Jet, Bomber, Mobile Command Vehicle;
  chưa có đội hình (formation), trình sửa map, chọn ngôn ngữ, tùy chỉnh chất lượng đồ họa.
- Tạm hoãn theo yêu cầu: toàn bộ phần online (tài khoản, chat, lobby, PvP, xếp trận, admin) và đồ họa / âm thanh thật.
