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

---

## Đợt 8 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 8.1 | **AI dùng chở quân và Bunker** (APC chở bộ binh ra trận, trực thăng thả quân, cho quân vào Bunker) + **AI đồng minh phối hợp** (cùng tấn công, cứu nhau) | §9, §10 | ✅ |
| 8.2 | **Cân bằng lối đánh Rush** (đo bằng mô phỏng AI đấu AI) | §10, §17 | ✅ |
| 8.3 | Unit mới: **Fighter Jet, Bomber, Mobile Command Vehicle** | §7 | ✅ |
| 8.4 | **Chọn đội hình** khi di chuyển (rải đều / hàng ngang / hàng dọc / mũi tên) | §8 | ✅ |
| 8.5 | Settings: **chất lượng đồ họa**, tốc độ zoom, độ nhạy chuột | §16 | ✅ |
| 8.6 | **Thành thạo faction** trong Profile | §15 | ✅ |
| 8.7 | Kiểm tra (unit test + trình duyệt Chrome/Edge/Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 8

### ✅ 8.1 AI dùng chở quân, Bunker, phối hợp đồng minh
- **Bunker**: AI phòng thủ (Fortress, Warlord) xây 1 Bunker và cho bộ binh rẻ nhất vào trú; luôn giữ lại ít nhất 4 bộ binh để cơ động.
- **APC**: khi mở đợt tấn công, bộ binh gần APC lên xe (APC chờ tối đa 6 giây); tới gần mục tiêu hoặc gặp địch trong 7 ô thì thả quân xuống đánh.
- **Trực thăng thả quân**: AI thích không quân (Eagle, Shadow, Warlord; từ Normal trở lên) giữ 1 Transport Helicopter, chở 6 bộ binh bay tới
  mỏ / nhà điện của địch đã biết, thả quân cách mục tiêu 3 ô rồi bay về. Trực thăng bị bắn còn dưới 40% máu thì thả quân ngay.
- **Phối hợp đồng minh**: AI mở đợt tấn công thì báo cho đồng đội; đồng đội có đủ quân (≥ 50% ngưỡng tấn công) sẽ **cùng đánh một mục tiêu**.
  Căn cứ bị ≥ 3 địch tấn công thì AI **gọi cứu viện**; đồng minh ở gần (≤ 50 ô) gửi một nửa quân đang rảnh (tối đa 1 lần / 30 giây).
  AI vẫn chỉ hành động qua lệnh và chỉ thấy những gì sương mù cho phép.
- Mô phỏng 2v2 Hard: mọi hành vi đều xuất hiện (vào Bunker, lên/xuống APC, 2–12 lần thả quân mỗi trận, 1–5 lần cứu viện, 1–3 lần cùng tấn công).
- Test: game-ai +4 (`tactics.test.ts`: Bunker có quân trú và vẫn giữ 4 bộ binh; APC chở ≥ 3 lính rồi thả xuống; đồng minh cùng tấn công;
  trực thăng chở và thả ≥ 4 lính).

### ✅ 8.2 Cân bằng lối đánh Rush
- Đo trước khi sửa: Rush đấu 4 tính cách còn lại × 3 map × 2 độ khó × 2 phía = 48 trận → **Rush thắng 46/48**, đa số trong 6–10 phút.
- Nguyên nhân (theo dõi từng trận): các AI khác tiêu ~70% tiền vào công trình / công nghệ trong 4 phút đầu, đem nhóm 3 lính đi chiếm điểm
  rồi bị tiêu diệt dần; Rush có 2 mỏ + giữ hết điểm chiến lược nên thu nhập cao hơn ~40%. Đổi chỉ số unit (đạn tăng mạnh hơn với bộ binh,
  rifleman đắt hơn, Normal cũng khắc chế) **không** thay đổi kết quả → vấn đề ở cách AI chi tiền, không ở chỉ số.
- Sửa:
  - **Quân thường trực tối thiểu**: từ phút 2, nếu quân yếu hơn mức tối thiểu (tăng dần theo thời gian) hoặc yếu hơn 80% quân địch
    đã thấy, AI chỉ xây công trình kinh tế / sản xuất / phòng thủ, tạm dừng nghiên cứu và nâng cấp, không để dành tiền.
  - Nhóm chiếm điểm chỉ đi khi ở nhà có ≥ 6 quân mặt đất và đủ quân tối thiểu.
  - **Rush đánh đổi kinh tế lấy tốc độ**: chỉ 1 mỏ và giữ tối đa 1 điểm chiến lược; đợt đầu muộn hơn một chút (×0,75 thay vì ×0,6)
    và không gom quân quá 1,25 × ngưỡng trước đợt đầu.
- Kết quả (48 trận như trên): **Rush thắng 17/48 (35%)**; vẫn thường thắng Fortress (lối "rùa"), thua Warlord / Eagle / Shadow nếu không
  thắng sớm. Trận dài **8–23 phút**. Với người chơi: Rush ở Normal tấn công lần đầu khoảng phút 5 (trước đây khoảng phút 4).
- Test cũ "đồng minh AI giữ được Survival" bị hỏng lúc đầu (quy tắc chiếm điểm làm AI mất thu nhập trong Survival) → Survival dùng điều kiện cũ.
  Tổng: **106/106** test.

### ✅ 8.3 Fighter Jet, Bomber, Mobile Command Vehicle
- **Fighter Jet** (Airfield, cần Radar Station, 1100◆): máy bay nhanh nhất game, tên lửa đối không (mạnh ×1,8 với máy bay),
  **không bắn được mục tiêu mặt đất**. Khắc chế trực thăng, drone, Bomber.
- **Bomber** (Airfield, cần Research Center, 1800◆): bay tới trên đầu mục tiêu và thả bom (150 sát thương, nổ lan 1,8 ô, rất mạnh với
  công trình); chậm và không tự vệ được trên không → cần Fighter / SAM yểm trợ.
- **Mobile Command Vehicle (MCV)** (War Factory, cần Research Center, 2500◆): xe không vũ khí, bấm **Deploy** (hoặc phím Unload, mặc định U)
  để **triển khai thành Headquarters ngay tại chỗ**, ở bất kỳ đâu (không cần gần căn cứ) → mở căn cứ tiền tuyến, xây công trình quanh đó.
  HQ mới bắt đầu ở 60% và tự hoàn thiện sau khoảng 12 giây. Không hủy được để lấy lại tiền HQ (chặn lỗi lách tiền 2500 → 3000).
- **Sửa lỗi lệnh tấn công**: trước đây chọn cả nhóm rồi chuột phải vào máy bay thì các unit không bắn được máy bay (tăng…) nhận lệnh
  rồi đứng im. Giờ chúng di chuyển kèm tấn công tới chỗ mục tiêu; nếu không unit nào bắn được thì lệnh bị từ chối kèm lý do.
- AI: xây Fighter Jet khi đã thấy máy bay địch; Eagle và Warlord dùng Bomber. **AI chưa dùng MCV**.
- Hình tạm (vẽ bằng code): Fighter cánh tam giác, Bomber cánh dài 2 động cơ, MCV xe 6 bánh có ăng-ten / chảo; icon riêng cho cả 3.
  Phím Unload trên panel giờ hiện đúng phím đã gán (trước đây luôn ghi "U").
- Test: game-core +4 (MCV triển khai ở xa căn cứ thành HQ, xây được quanh HQ mới, không hủy được; unit thường / chỗ bị chặn / người khác
  không triển khai được; Fighter bắn rơi trực thăng nhưng không nhắm xe tăng; Bomber phá HQ). Tổng **110/110**.

### ✅ 8.4 Chọn đội hình khi di chuyển
- 4 kiểu: **Spread** (rải đều quanh điểm đến như trước, mỗi unit đi tốc độ riêng), **Line** (hàng ngang vuông góc với hướng đi, tối đa 8
  một hàng), **Column** (hai hàng dọc, hợp đi đường / cầu), **Wedge** (mũi tên, unit nhiều máu nhất ở mũi).
- Line / Column / Wedge: cả nhóm **đi cùng tốc độ của unit chậm nhất** để giữ đội hình (bộ binh không bỏ xe tăng lại phía sau);
  đội hình quay theo hướng từ tâm nhóm tới điểm đến; ô bị chặn thì unit lấy ô trống gần nhất; bấm vào ô đá / nước thì đội hình đặt ở
  chỗ trống gần nhất. Máy bay vẫn bay theo vòng tròn.
- Giao diện: hàng **Formation** trong panel lệnh (4 nút, có chú thích khi rê chuột), phím **B** đổi lần lượt (đổi phím được trong Settings);
  lựa chọn được lưu lại. Áp dụng cho chuột phải di chuyển và attack-move.
- Lệnh `move` có thêm trường `formation` (không bắt buộc), vẫn đi qua `world.issue()` như mọi lệnh khác.
- Test: game-core +3 (hình dạng 3 kiểu đội hình; nhóm Line chung tốc độ, trải theo chiều ngang hướng đi, mỗi unit một ô, bộ binh đi cùng
  xe tăng; Wedge đặt xe tăng ở mũi, Spread không giới hạn tốc độ). Tổng **113/113**.

### ✅ 8.5 Settings: chất lượng đồ họa, tốc độ zoom, độ nhạy chuột
- **Graphics quality** Low / Medium / High (thay cho ô "Performance mode" của v0.7; ai đã bật Performance mode được tự chuyển sang Low):
  - Low: tối đa 350 hạt hiệu ứng, chỉ giữ 1/3 khói / mảnh vỡ, không có vết cháy, **tắt khử răng cưa** (anti-aliasing);
  - Medium: 800 hạt, giữ 1/2 khói / mảnh vỡ, vết cháy chỉ khi công trình nổ;
  - High (mặc định): 1400 hạt, đầy đủ hiệu ứng như trước.
  Hiệu ứng đổi ngay khi chỉnh trong trận; khử răng cưa áp dụng từ trận sau (WebGL không đổi được khi đang chạy).
- **Mouse-wheel zoom speed** 0,5–2 (mỗi nấc lăn zoom 5–20%) và **Mouse drag-pan sensitivity** 0,5–2 (kéo chuột giữa để cuộn bản đồ).
- Giá trị lưu lại; dữ liệu cũ / hỏng trở về mặc định. Cập nhật bộ test trình duyệt round7 cho ô chất lượng mới.
- Còn thiếu (offline): chọn ngôn ngữ (giao diện hiện chỉ có tiếng Anh), độ phân giải (trình duyệt tự theo cửa sổ).

### ✅ 8.6 Thành thạo faction (offline)
- Mỗi faction có **cấp thành thạo 0–10**, tăng theo XP của các trận chơi bằng faction đó (không tính XP thưởng nhiệm vụ ngày / tuần,
  vì nhiệm vụ không gắn với faction). Mốc XP: 300, 800, 1500, 2400, 3500, 5000, 7000, 9500, 12 500, 16 000.
- Profile có mục **Faction mastery** (5 ô: cấp, thanh tiến độ, XP còn thiếu; đạt cấp 10 ghi MAX); màn kết quả ghi
  "<faction> mastery +N XP · level a → b".
- 2 danh hiệu mới: **Specialist** (một faction đạt cấp 5), **Grandmaster** (một faction đạt cấp 10).
- Hồ sơ cũ (trước v0.8) được **tính lại thành thạo từ lịch sử trận**; dữ liệu hỏng (âm, faction không tồn tại) bị bỏ.
- Sửa nhỏ: lịch sử trận trong Profile ghi đúng tên chế độ "Capture the Flag".
- Test: game-core +4 (mốc cấp; chỉ faction đã chơi tăng, đúng bằng XP trận; mở Specialist / Grandmaster; dựng lại từ lịch sử + lọc dữ liệu hỏng).

### ✅ 8.7 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **117/117** (game-data 17, game-core 87, game-ai 10, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round8** (18 bài): chuyển "Performance mode" cũ sang Low, lưu chất lượng / zoom / độ nhạy kéo chuột,
  bảng thành thạo + danh hiệu Specialist bị khóa, hàng Formation + phím B + chuột phải đi hàng ngang đúng tốc độ unit chậm nhất,
  nút Wedge, Fighter / Bomber / MCV trong menu sản xuất, triển khai MCV bằng nút, ra lệnh đánh trực thăng (jet bắn, tăng attack-move),
  jet bắn rơi trực thăng, thắng trận → màn kết quả và Profile có thành thạo.
- Kết quả 10 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS, 0 lỗi console**. Lần chạy đầu có 3 lỗi chập chờn —
  Chrome `tutorial` (bước chiếm điểm kiểm tra quá sớm), Firefox `smoke2` (trình duyệt không khởi động được), Firefox `round7`
  (chuột phải vào APC) — chạy lại riêng đều PASS, game không phải sửa.
- Tài liệu cập nhật v0.8: CHANGELOG, README (phím T / U / B), GAMEPLAY_SYSTEMS §5k, AI_DESIGN §6g, TESTING, DEVELOPMENT_ROADMAP,
  PLAN_STATUS (chỉ sửa các mục liên quan); menu chính ghi v0.8.

## Tổng kết đợt 8
- Đã xong: AI dùng APC / trực thăng thả quân / Bunker và phối hợp đồng minh; cân bằng Rush (thắng 96% → 35% trong 48 trận mô phỏng);
  3 unit mới (Fighter Jet, Bomber, Mobile Command Vehicle); chọn đội hình; Settings chất lượng đồ họa / zoom / độ nhạy chuột;
  thành thạo faction + 2 danh hiệu; sửa lệnh tấn công máy bay.
- Chất lượng: 117 unit test, 10 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Còn lại (offline): chọn ngôn ngữ, trình sửa map, Long-range Missile System, chí mạng / áp chế / lựu đạn khói / cháy,
  công trình riêng từng faction, nâng cấp từng unit, thời tiết / ngày đêm, AI dùng MCV.
- Tạm hoãn theo yêu cầu: toàn bộ phần online và đồ họa / âm thanh thật.

---

## Đợt 9 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 9.1 | **Chọn ngôn ngữ**: giao diện tiếng Việt / tiếng Anh | §16 | ✅ |
| 9.2 | **Trình sửa map** trong game: vẽ địa hình, mỏ, điểm xuất phát, điểm chiến lược; lưu và chơi map tự làm | §6 | ✅ |
| 9.3 | Chiến đấu: unit **Long-range Missile System**, **áp chế** bộ binh, **đạn cháy** | §7, §10 | ✅ |
| 9.4 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 9

### ✅ 9.1 Chọn ngôn ngữ (tiếng Việt / tiếng Anh)
- Settings → **Ngôn ngữ / Language**: English (mặc định) hoặc **Tiếng Việt**; đổi là áp dụng ngay, được lưu lại.
- Hàm dịch `t()` (`apps/web/src/i18n`): khóa là chuỗi tiếng Anh, có tham số `{n}`; thiếu bản dịch thì hiện tiếng Anh nên không bao giờ trống.
  `t.msg()` dịch thông báo lúc chạy (toast, lý do lệnh bị từ chối từ phần mô phỏng) theo câu cố định + mẫu có tên / số
  (vd. "Đã chiếm điểm chiến lược: Central Field", "Đã đạt giới hạn quân (150)").
- Đã dịch: menu chính, thiết lập trận, Settings + bảng phím, Profile, màn kết quả, Chiến dịch (khung), menu tạm dừng, thanh trên,
  panel chọn / lệnh / sản xuất / nghiên cứu / xây dựng, đội hình, mục tiêu, khoảng 70 thông báo trong trận và lý do lỗi.
- Giữ tiếng Anh (là dữ liệu game, có thể dịch sau): tên + mô tả unit / công trình / phe / map / công nghệ, nội dung nhiệm vụ chiến dịch,
  thành tích, nhiệm vụ ngày / tuần.
- Menu chính ghi v0.9.

### ✅ 9.2 Trình sửa map trong game
- Menu chính → **Map editor** (hoặc nút "✎ Map editor" trong Thiết lập trận). Bản đồ nhìn từ trên xuống, kéo chuột để vẽ:
  - 10 loại địa hình (cát, cỏ, đường, bê tông, quặng, tuyết; đá / nước / nhà / rừng chặn đường), cỡ cọ 1 / 3 / 5 / 9;
  - **điểm xuất phát** (2–4, ô HQ 3×3) và **điểm chiến lược** (tối đa 8) — bấm lại để xóa;
  - **Đối xứng** (bật sẵn): vẽ / đặt xoay 180° để hai phía công bằng; cỡ map 48 / 64 / 80.
- **Kiểm tra trực tiếp** bằng đúng luật của game (`customMapErrors` trong game-data): cỡ map, 2–4 điểm xuất phát có 3×3 đất trống
  không quặng / không sát mép, không quá gần nhau, điểm chiến lược trên đất trống, mọi căn cứ / điểm đi bộ tới được, mỗi căn cứ có
  quặng (≥ 5 ô) trong 12 ô. Lỗi được liệt kê (có tiếng Việt); chỉ map hợp lệ mới bấm **Play this map** được.
- **Lưu** trong trình duyệt (tối đa 20 map, gọn: 1 ký tự / ô), danh sách Load / Delete; dữ liệu hỏng bị bỏ qua.
  Thiết lập trận có mục **Custom maps** (map chưa hợp lệ bị khóa); trận dùng `mapId: 'custom'` + `customMap`, World kiểm tra lại
  map trước khi chạy. Chơi được mọi chế độ (kể cả Survival, CTF) với máy.
- **Sửa lỗi phát hiện khi test**: khi khung game hiện ra dưới con chuột đang đứng yên (vd. vừa bấm Deploy), camera **tự trôi sang trái**
  vì Phaser coi chuột ở (0, 0) = mép trái. Giờ cuộn theo mép chỉ bật sau khi chuột thật sự di chuyển trong khung game.
- Test: game-data +4 (mã hóa ô; map hợp lệ; thiếu điểm xuất phát / đặt trên đá / quá gần / bị chia cắt / điểm trên đá; sai cỡ / hỏng dữ liệu),
  game-core +2 (trận chạy trên map tự làm, HQ đúng vị trí; từ chối map thiếu / không hợp lệ).

### ✅ 9.3 Long-range Missile System, áp chế, đạn cháy
- **Long-range Missile System** (War Factory, cần Research Center + Radar Station, 2000◆): tầm **20 ô** (xa nhất game), không bắn được
  trong 6 ô, tên lửa 150 sát thương nổ lan + gây cháy. Cần quân trinh sát / radar để thấy mục tiêu ở xa. AI Fortress có dùng.
- **Đạn cháy** (`WeaponDef.burn`): Missile System (6 sát thương/giây × 5 giây) và MLRS của Eastern Legion (4/giây × 4 giây) làm mục tiêu
  mặt đất / công trình **cháy tiếp** sau khi trúng; trúng lại thì làm mới thời gian, không cộng dồn; máy bay không cháy. Có lửa nhỏ trên
  mục tiêu đang cháy.
- **Áp chế**: bộ binh trúng đạn thường / pháo tích "điểm áp chế" bằng sát thương nhận (tối đa 120); từ 40 trở lên thì **đi chậm 45%** và
  **bắn chậm 40%**, panel ghi "Suppressed / Bị áp chế"; giảm dần khi hết bị bắn. Tên lửa không gây áp chế; xe không bị áp chế.
- Kiểm tra lại cân bằng (48 trận như 8.2): Rush thắng 15/48 (31%), trận 7–26 phút (trung vị 12).
- Test: game-core +4 (cháy đúng tổng sát thương rồi tắt; máy bay không cháy, cháy lại không cộng dồn; bộ binh bị áp chế đi chậm rồi hồi
  phục, rocket / xe không bị; Missile System tầm xa nhất, có tầm tối thiểu, cần Radar). Tổng **127/127**.

### ✅ 9.4 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **127/127** (game-data 21, game-core 93, game-ai 10, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round9** (20 bài): đổi sang tiếng Việt (Settings, menu, thiết lập trận, HUD, thông báo từ mô phỏng, menu tạm dừng)
  rồi về tiếng Anh; trình sửa map (báo lỗi, đối xứng điểm xuất phát, cọ quặng / nước / điểm chiến lược, lưu, tự chọn trong thiết lập trận);
  trận trên map tự làm với camera đúng căn cứ; Missile System trong menu nhà máy; trạng thái bị áp chế; công trình cháy mất máu.
- Kết quả 11 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS, 0 lỗi console**. Lần chạy đầu Chrome `tutorial` hỏng ở bước
  di chuyển (script chỉ chờ 0,4 giây sau chuột phải) → chạy lại riêng 3 lần đều 12/12, game không phải sửa.
- Tài liệu cập nhật v0.9: CHANGELOG, README, GAMEPLAY_SYSTEMS §5l, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS.

## Tổng kết đợt 9
- Đã xong: giao diện **tiếng Việt / tiếng Anh**; **trình sửa map** (vẽ, kiểm tra, lưu, chơi); **Long-range Missile System**,
  **đạn cháy**, **áp chế bộ binh**; sửa lỗi camera tự trôi lúc vào trận.
- Chất lượng: 127 unit test, 11 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Còn lại (offline): dịch tên / mô tả unit, map, nội dung chiến dịch sang tiếng Việt; công trình riêng từng faction; nâng cấp từng unit;
  chí mạng, lựu đạn khói; thời tiết / ngày đêm; AI dùng MCV; độ cao địa hình, môi trường phá hủy được.
- Tạm hoãn theo yêu cầu: toàn bộ phần online và đồ họa / âm thanh thật.

---

## Đợt 10 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 10.1 | Dịch **dữ liệu game** sang tiếng Việt (unit, công trình, công nghệ, phe, map, chiến dịch, hướng dẫn, thành tích, nhiệm vụ, danh hiệu) | §16 | ✅ |
| 10.2 | **Công trình riêng từng phe** (mỗi phe 1 công trình) | §5 | ✅ |
| 10.3 | **Lựu đạn khói** và **đòn chí mạng** | §10 | ✅ |
| 10.4 | **AI dùng MCV** mở căn cứ tiền tuyến | §11 | ✅ |
| 10.5 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 10

### ✅ 10.1 Dịch dữ liệu game sang tiếng Việt
- 247 chuỗi dữ liệu: tên + mô tả 23 unit, 14 công trình, 9 công nghệ; 5 phe + phong cách; 5 tính cách AI; mô tả 9 map; 4 nhiệm vụ chiến dịch
  (tên, phụ đề, lời dẫn, mục tiêu, gợi ý) + hướng dẫn; 13 thành tích; 11 nhiệm vụ ngày / tuần; 12 danh hiệu.
  Giữ nguyên tên riêng: tên map, tên điểm chiến lược, tên chỉ huy máy.
- Hiển thị ở: panel chọn / sản xuất / nghiên cứu / xây dựng, mục tiêu trong trận, Chiến dịch, Profile, màn kết quả, Sổ tay quân đội,
  thiết lập trận (phe, mô tả map, tính cách), danh hiệu trên menu chính.
- Thông báo có tên bên trong cũng được dịch phần tên (vd. "Requires Barracks, War Factory" → "Cần Doanh trại, Nhà máy chiến xa").

### ✅ 10.2 Công trình riêng từng phe
| Phe | Công trình | Tác dụng |
|---|---|---|
| Western Alliance | **Field Hospital** (Bệnh viện dã chiến), 900◆, cần Barracks | hồi 5 máu/giây cho **mọi** bộ binh phe ta trong 6 ô |
| Eastern Legion | **Howitzer Emplacement** (Trận địa lựu pháo), 1400◆, cần War Factory | pháo cố định tầm 13 ô, 90 sát thương nổ lan, không bắn trong 3 ô; nâng cấp được |
| Pacific Technology | **Repair Bay** (Trạm sửa chữa), 900◆, cần War Factory | sửa 12 máu/giây cho mọi xe, máy bay, công trình phe ta trong 5 ô |
| Desert Corps | **Oil Derrick** (Giàn khoan dầu), 1200◆, cần Barracks | +4 tiền/giây ở bất kỳ đâu, không cần quặng, không cạn |
| Iron Republic | **Bastion** (Pháo đài), 1600◆, cần War Factory | 5200 máu, pháo 70 sát thương tầm 8; nâng cấp được |

- Bệnh viện / trạm sửa chỉ hoạt động khi đủ điện. Lệnh `build` từ chối công trình của phe khác; bảng xây dựng chỉ hiện công trình của
  phe mình (giờ 7 cột). Mỗi công trình có hình và icon riêng (chữ thập đỏ, cần cẩu, tháp khoan có cần bơm chuyển động, nòng pháo dài).
- AI: xây công trình phe mình sau War Factory (Desert Corps xây 2 giàn khoan).
- **Sửa AI**: test "đồng minh AI giữ được Survival" hỏng — đợt cuối còn 1 xe tăng hạng nặng, AI Normal (không tự khắc chế) cứ sản xuất
  Ranger súng trường nên không hạ được. Giờ **mọi độ khó**, khi căn cứ bị xe bọc thép tấn công, AI ưu tiên vũ khí rocket / pháo tăng.
- Test: game-core +5 (mỗi phe đúng 1 công trình, phe khác không xây được; bệnh viện chữa bộ binh không chữa xe; trạm sửa sửa xe;
  giàn khoan +4/giây không cần quặng; lựu pháo bắn mục tiêu cách 10 ô).

### ✅ 10.3 Lựu đạn khói và đòn chí mạng
- **Lựu đạn khói** (Rifleman, Ranger, Engineer): chọn lính → nút **Smoke** hoặc phím **Z** (đổi được) → bấm chỗ cần thả (tối đa 7 ô).
  Lính gần nhất còn lựu đạn sẽ ném; đám khói bán kính 2,5 ô, tồn tại 20 giây; mỗi lính hồi 30 giây (panel ghi "Smoke grenade ready /
  in N s"). Quân mặt đất trong khói **địch không nhìn thấy** (nên không nhắm bắn được), trừ khi địch đứng sát trong 2 ô; phe mình vẫn thấy.
  Khói vẽ bằng nhiều lớp xám mờ dần. AI ném khói che bộ binh bị thương khi đang bị công trình phòng thủ bắn.
- **Đòn chí mạng**: mỗi phát bắn 8% cơ hội (+3% mỗi cấp cựu binh) gây **×1,5 sát thương**; có dấu vàng ở điểm trúng. Dùng RNG theo seed
  của trận nên vẫn tái lập được.
- Test: game-core +3 (ném khói: đúng tầm, unit không có lựu đạn bị từ chối, hồi chiêu, khói tan; unit trong khói bị ẩn với địch ở xa,
  phe mình vẫn thấy, địch tới sát thì thấy; tỉ lệ chí mạng đúng khoảng cấu hình). Tổng **135/135**.

### ✅ 10.4 AI dùng MCV mở căn cứ tiền tuyến
- AI Khó / Cực khó (trừ Rush) từ phút 10, khi đã có ≥ 2 mỏ, đủ quân thường trực và có Research Center: **để dành tiền** xây 1 MCV,
  chọn mỏ quặng còn trống gần nhất cách căn cứ chính ≥ 20 ô, cách căn cứ địch đã biết ≥ 16 ô, tìm chỗ 3×3 trống cách quặng 3–6 ô,
  lái MCV tới và **triển khai thành HQ**; chỗ bị chặn thì chọn chỗ khác. Sau đó để dành tiền và xây **2 máy khai thác** quanh HQ mới.
- Mô phỏng (Hard / Insane, 4 trận trên Desert Storm, River Crossing, Snowfield): cả 4 trận AI đều mở căn cứ tiền tuyến
  (phút 18–24) và xây 1–2 máy khai thác ở đó.
- Lỗi tìm ra khi mô phỏng: AI tiêu tiền liên tục nên không bao giờ đủ 2500◆ cho MCV và 800◆ cho máy khai thác → thêm cơ chế để dành tiền
  (giống khi chờ xây công trình).
- Test: game-ai +1 (AI Hard xây MCV, triển khai cách căn cứ > 15 ô, xây máy khai thác cạnh HQ mới).

### ✅ 10.5 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **136/136** (game-data 21, game-core 101, game-ai 11, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round10** (14 bài): Sổ tay quân đội / Chiến dịch / Profile / panel chọn unit / tên trong thông báo bằng tiếng Việt;
  menu xây dựng phe Western chỉ có Field Hospital; bệnh viện hồi máu bộ binh; ném khói bằng phím Z + bấm chuột, hiện thời gian hồi;
  Desert Corps xây được Oil Derrick sau Barracks.
- Kết quả 12 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS** (36/36 lượt). Lần chạy đầu Edge `survival` có 1 lỗi console
  `ERR_CONNECTION_TIMED_OUT` (tải tài nguyên mạng) dù 8/8 bài PASS → chạy lại riêng 4 lần đều 8/8 và 0 lỗi, game không phải sửa.
- Tài liệu v0.10 đã cập nhật: CHANGELOG, README, GAMEPLAY_SYSTEMS §5m, AI_DESIGN §6h, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS; menu chính ghi v0.10.

## Tổng kết đợt 10
- Đã xong: dịch **toàn bộ dữ liệu game** sang tiếng Việt; **công trình riêng từng phe** (Field Hospital, Howitzer Emplacement, Repair Bay,
  Oil Derrick, Bastion); **lựu đạn khói** và **đòn chí mạng**; **AI mở căn cứ tiền tuyến bằng MCV**; AI mọi độ khó chống xe bọc thép đánh căn cứ.
- Chất lượng: 136 unit test, 12 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Còn lại (offline): nâng cấp từng unit; thời tiết / ngày đêm; độ cao địa hình, môi trường phá hủy được; đường đạn đạo thật.
- Tạm hoãn theo yêu cầu: toàn bộ phần online và đồ họa / âm thanh thật.

---

## Đợt 11 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 11.1 | **Nâng cấp từng unit**: mỗi loại unit nâng 1 cấp ở công trình sản xuất (+máu, +sát thương, áp dụng cả unit đang có); AI cũng dùng | §8 | ✅ |
| 11.2 | **Thành thạo từng unit** trong Profile (theo số unit đã sản xuất / hạ địch qua các trận) | §14 | ✅ |
| 11.3 | **Thời tiết / ngày đêm**: chọn khi thiết lập trận; ban đêm và mưa / bão cát giảm tầm nhìn, mưa làm chậm xe; hiệu ứng hình ảnh | §12 | ✅ |
| 11.4 | **Đường đạn đạo thật**: pháo / tên lửa bay theo cung, ngắm đón mục tiêu đang di chuyển | §10 | ✅ |
| 11.5 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 11

### ✅ 11.1 Nâng cấp từng unit
- Chọn công trình sản xuất (Barracks, War Factory, Airfield) → hàng **Nâng cấp** cạnh hàng chờ: mỗi unit công trình đó đào tạo có 1 nút.
  Nâng cấp mất 25 giây (chậm hơn khi thiếu điện), giá = 1,5 × giá unit (làm tròn 50, tối thiểu 300◆; vd. Rifleman 300◆).
- Hiệu quả: **+20% máu tối đa, +15% sát thương** cho **mọi** unit loại đó của người chơi — cả unit đang có, unit đang ngồi trong xe /
  bunker, và unit sản xuất sau. Bấm lại nút đang chạy để hủy (hoàn tiền); bán công trình đang nâng cấp cũng được hoàn tiền nâng cấp.
  Mỗi công trình nâng cấp 1 loại một lúc, chạy song song với sản xuất; loại đã nâng có dấu ★.
- AI (từ Normal): khi dư tiền và có ≥ 4 unit cùng loại có vũ khí, nâng cấp loại nhiều nhất.
- Test: game-core +3 (giá; chỉ đúng loại unit được tăng, cả hành khách và unit mới, địch không bị ảnh hưởng; từ chối sai công trình /
  đang nâng / đã nâng, hủy hoàn tiền), game-ai +1 (AI nâng cấp Rifleman khi có 8 lính và dư tiền).

### ✅ 11.2 Thành thạo từng unit
- Mô phỏng ghi lại theo từng loại unit: số đã sản xuất và số địch bị unit loại đó hạ. Hết trận cộng vào Profile.
- Điểm = 1 / unit sản xuất + 2 / lần hạ địch; 5 cấp (10 / 30 / 75 / 150 / 300 điểm), hiện bằng sao ★.
- Profile có mục **Thành thạo unit** (icon, sao, thanh tiến độ; rê chuột xem số đã sản xuất / hạ địch / điểm), sắp theo điểm.
  Màn kết quả báo unit nào lên cấp. Danh hiệu mới **Chuyên gia vũ khí** (Weapons Expert) khi 1 unit đạt cấp 5.
- Hồ sơ cũ (trước v0.11) tự có mục rỗng; dữ liệu hỏng / unit không tồn tại bị bỏ.
- Test: game-core +4 (cấp theo ngưỡng; cộng dồn qua trận và báo lên cấp; danh hiệu; hồ sơ cũ / hỏng; mô phỏng đếm sản xuất và hạ địch).

### ✅ 11.3 Thời tiết và ngày / đêm
- Thiết lập trận có 2 ô mới (được nhớ cho lần sau):
  - **Thời tiết**: Quang đãng · **Mưa** (tầm nhìn −15%, xe chậm 15%) · **Bão cát** (tầm nhìn −35%, xe chậm 5%, bộ binh chậm 10%) ·
    **Tuyết** (tầm nhìn −10%, bộ binh chậm 15%, xe chậm 10%). Máy bay không bị chậm.
  - **Thời gian**: Ban ngày · **Ban đêm** (tầm nhìn −30%) · **Luân phiên** (5 phút ngày → 30 giây hoàng hôn → 2 phút đêm → 30 giây bình minh).
- Tác động lên cả sương mù chiến tranh (thấy ít hơn) lẫn tầm tự tìm mục tiêu của unit; tầm nhìn không giảm dưới 2,5 ô. Áp dụng cho cả
  người và máy (AI chỉ thấy những gì unit của nó thấy, nên ban đêm / bão cát AI cũng "mù" như người chơi). Đội hình đi theo tốc độ
  unit chậm nhất **sau** khi tính thời tiết.
- Hình ảnh: màn tối xanh đậm khi đêm (đậm nhạt dần lúc hoàng hôn / bình minh), lớp màu theo thời tiết, hạt mưa xiên / bông tuyết rơi /
  vệt cát bay ngang (số hạt theo chất lượng đồ họa Low / Medium / High). Thanh trên có ô ☀ / ☾ + biểu tượng thời tiết + giai đoạn
  ngày (rê chuột xem % tầm nhìn).
- Test: game-core +4 (mặc định / giá trị sai; đêm + bão cát giảm tầm nhìn có mức sàn, unit cách HQ 8 ô thấy được ban ngày nhưng bị ẩn
  trong bão cát ban đêm; chu kỳ ngày → hoàng hôn → đêm → bình minh; mưa làm chậm xe, tuyết làm chậm bộ binh, trực thăng không đổi).
  Kiểm tra bằng trình duyệt: mưa đêm, bão cát, tuyết luân phiên đều hiện đúng, 0 lỗi console.

### ✅ 11.4 Đường đạn đạo thật
- Pháo (Mobile Artillery, MLRS, Missile System, Howitzer) bắn **đạn bay theo cung parabol**: tốc độ ngang không đổi, độ cao đỉnh =
  0,35 × khoảng cách (bắn càng xa cung càng cao, bay càng lâu). Bom của Bomber rơi thẳng từ trên cao, không có cung.
- **Ngắm đón**: xạ thủ tính vị trí mục tiêu đang chạy sau thời gian bay (dựa trên vận tốc hiện tại) và bắn vào đó; mục tiêu đổi hướng /
  dừng lại vẫn có thể né. Độ tản đạn tăng theo khoảng cách (±0,35 ô + 0,025 ô mỗi ô tầm bắn).
- **Vùng đạn rơi**: trong lúc đạn bay, chỗ đạn sắp rơi hiện vòng elip (đỏ = đạn địch, trắng mờ = đạn ta), đậm dần khi đạn gần chạm đất —
  người chơi có thể kéo quân ra khỏi vùng.
- Test: game-core +3 (ngắm đón đúng vận tốc × thời gian bay, mục tiêu đứng yên thì ngắm thẳng; cung tỉ lệ khoảng cách, bom không có cung,
  điểm rơi trong vùng tản; pháo bắn trúng xe tăng đang chạy ngang — lệch 0,7 ô thay vì ~2 ô nếu không ngắm đón). Test AI vẫn pass.

### ✅ 11.5 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **151/151** (game-data 21, game-core 115, game-ai 12, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round11** (15 bài): Profile có mục thành thạo unit (rỗng); ô Thời tiết / Thời gian trong thiết lập trận;
  trận mưa + đêm (tầm nhìn 59,5%, thanh trên hiện ☾ 🌧 Night); hàng Nâng cấp ở Barracks (bắt đầu, trừ tiền, hoàn thành, thông báo,
  dấu ★, Rifleman được +15% sát thương); đạn pháo bay theo cung; thắng trận → màn kết quả báo Rifleman lên cấp thành thạo, Profile có
  Rifleman; thiết lập được nhớ; nhãn tiếng Việt.
- Kết quả 13 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS, 0 lỗi console**. Lần chạy đầu Firefox `round11` hỏng bài nhãn
  tiếng Việt — do Firefox không đưa chữ trong ô chọn vào `innerText` (giao diện thật đã đúng tiếng Việt); sửa bài test đọc nội dung ô chọn
  → 15/15 trên cả 3 trình duyệt. Game không phải sửa.
- Tài liệu cập nhật v0.11: CHANGELOG, README, GAMEPLAY_SYSTEMS §5n, AI_DESIGN §6i, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS; menu chính ghi v0.11.

## Tổng kết đợt 11
- Đã xong: **nâng cấp từng loại unit** (AI cũng dùng), **thành thạo từng unit** + danh hiệu Chuyên gia vũ khí, **thời tiết** (mưa, bão cát,
  tuyết) và **ngày / đêm** ảnh hưởng tầm nhìn + tốc độ, **đường đạn đạo thật** (cung parabol, ngắm đón, vùng đạn rơi).
- Chất lượng: 151 unit test, 13 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.

---

## Đợt 12 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 12.1 | **Độ cao địa hình**: ô đồi đi được; đứng trên đồi được +tầm nhìn, +tầm bắn, bắn từ thấp lên đồi dễ trượt; vẽ nổi khối; có trong trình sửa map và vài map | §6 | ✅ |
| 12.2 | **Môi trường phá hủy được**: rừng / nhà dân bị pháo, bom, nổ phá thành đất trống (mở đường mới) | §6 | ✅ |
| 12.3 | **Xoay công trình**: phím R khi đặt đổi hướng mặt trước (cửa ra quân, điểm tập kết mặc định, hình vẽ) | §5 | ✅ |
| 12.4 | **Avatar** riêng trong Profile (bộ huy hiệu vẽ sẵn, chọn hình + màu) | §2 | ✅ |
| 12.5 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 12

### ✅ 12.1 Độ cao địa hình (đồi)
- Loại ô mới **Đồi** (đi được). Unit mặt đất / công trình đứng trên đồi: **+2 ô tầm nhìn**, **+1 ô tầm bắn**. Bắn thẳng (đạn, đạn pháo xe tăng,
  rocket) từ chỗ thấp vào mục tiêu trên đồi **trượt 25%** (đạn rơi cạnh mục tiêu). Pháo bắn cầu vồng và máy bay không bị ảnh hưởng;
  máy bay không được cộng điểm cao. Áp dụng như nhau cho người và AI.
- Có đồi trên **Desert Storm** (2 đồi đối xứng nhìn xuống Central Field) và trên **map ngẫu nhiên** (1–2 đồi, đối xứng; dùng luồng ngẫu nhiên
  riêng nên các seed cũ giữ nguyên phần còn lại). Trình sửa map có cọ **Đồi (điểm cao)**; cách lưu map 1 ký tự / ô vẫn giữ, map cũ đọc bình thường.
- Hình vẽ: mặt đồi sáng hơn, có đường đồng mức và **vách đá** ở cạnh giáp ô thấp; minimap / thiết lập trận có màu riêng.
- Test: game-core +3 (lưu / đọc ô đồi, có đồi trên Desert Storm và map ngẫu nhiên; trên đồi +tầm nhìn +tầm bắn, trực thăng không tính;
  bắn từ dưới lên trượt ≈ 25% qua > 60 phát). Toàn bộ test cũ vẫn pass. Kiểm tra trình duyệt: đồi hiện đúng, 0 lỗi console.
- Chưa làm: AI chưa chủ động chiếm đồi; unit đứng trên đồi chưa được vẽ nâng cao.

### ✅ 12.2 Môi trường phá hủy được
- Ô **rừng** (260 máu) và **nhà dân / khối nhà** (700 máu) bị **vũ khí nổ lan** (pháo, đạn xe tăng có nổ lan, MLRS, tên lửa, bom) phá dần;
  sát thương theo hệ số vũ khí với công trình, giảm dần ra rìa vùng nổ. Đạn súng không phá được.
- Rừng cháy thành **đất cỏ có gốc cây cháy**, nhà sập thành **gạch vụn (bê tông)** — đều **đi được**, mở đường mới; đường đi của mọi unit
  (kể cả AI) tự tính lại. Có lửa / khói khi ô bị phá (nếu nhìn thấy); minimap cập nhật.
- Mỗi trận dùng bản sao riêng của bản đồ nên map gốc không bị đổi giữa các trận.
- Test: game-core +3 (rừng → cỏ, nhà → bê tông, ô thành đi được, có sự kiện; map dùng chung không bị sửa; đạn súng không phá, pháo phá
  rừng sau vài phát). Kiểm tra trình duyệt trên Forest Warfare: cây biến mất, còn gốc cháy, 0 lỗi console.

### ✅ 12.3 Xoay công trình
- Mọi công trình đều vuông nên xoay = đổi **mặt trước** (4 hướng). Khi đang đặt công trình, phím **R** (phím Rút lui, đổi được) xoay
  1/4 vòng; bóng mờ có **mũi tên vàng** chỉ mặt trước, dòng gợi ý ghi "R: xoay".
- Mặt trước quyết định **chỗ quân mới đi ra** (Barracks, War Factory, Airfield, HQ) và **điểm tập kết mặc định**. Hình công trình được lật
  theo hướng (hướng sau / trái dùng chung hình với hướng trước / phải — hình placeholder).
- AI đặt nhà sản xuất **quay mặt về giữa bản đồ** để quân ra thẳng hướng mặt trận. Hướng mặc định giữ như cũ nên các trận / test cũ không đổi.
- Test: game-core +2 (điểm mặt trước theo 4 hướng; lệnh xây lưu hướng, giá trị sai → 0; lính ra đúng phía mặt trước với cả 4 hướng).
  Kiểm tra trình duyệt: R xoay, mũi tên đúng, Barracks lưu hướng 1 và điểm tập kết bên phải, 0 lỗi console.

### ✅ 12.4 Avatar
- Profile có mục **Ảnh đại diện**: 8 hình (ngôi sao, khiên, quân hàm, tâm ngắm, tia chớp, xe tăng, đầu lâu, đại bàng) × 8 màu nền, vẽ bằng SVG.
  Avatar hiện ở đầu trang Profile và trên huy hiệu hồ sơ ở menu chính; được lưu cùng hồ sơ.
- Hồ sơ cũ tự nhận avatar mặc định (ngôi sao xanh); dữ liệu hỏng (hình / màu không có trong danh sách) trở về mặc định.
- Test: game-core +1 (mặc định, giữ lựa chọn hợp lệ, dữ liệu hỏng / hồ sơ cũ). Kiểm tra trình duyệt: chọn đại bàng + nền đỏ, menu hiện
  đúng, tải lại trang vẫn giữ, 0 lỗi console.

### ✅ 12.5 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **160/160** (game-data 21, game-core 124, game-ai 12, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round12** (11 bài): chọn avatar (8 hình), huy hiệu menu hiện đúng, avatar được lưu; cọ Đồi trong trình sửa map;
  đồi trên Desert Storm (+2 tầm nhìn, +1 tầm bắn); R xoay công trình khi đặt (gợi ý, hướng, điểm tập kết đúng phía); R vẫn là Rút lui
  khi không đặt; pháo đốt rừng thành cỏ đi được; nhãn tiếng Việt.
- Kết quả 14 bộ × 3 trình duyệt (42 lượt): 40 lượt PASS ngay, 0 lỗi console. 2 lượt hỏng ở lần đầu: Chrome `campaign` (bài "thua nhiệm vụ +
  chơi lại") và Edge `round3` (2 bài chiếm North Ridge bằng chuột phải). Chạy lại riêng 2 lần mỗi bộ đều PASS toàn bộ → lỗi chập chờn do
  thời gian chờ của script (các bài này không liên quan thay đổi đợt 12), game không phải sửa.
- Tài liệu cập nhật v0.12: CHANGELOG, README, GAMEPLAY_SYSTEMS §5o, AI_DESIGN §6j, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS; menu chính ghi v0.12.

## Tổng kết đợt 12
- Đã xong: **đồi / điểm cao** (tầm nhìn, tầm bắn, khó bắn trúng từ dưới), **rừng / nhà bị phá** bởi vũ khí nổ (mở đường mới),
  **xoay công trình** (phím R, quân ra ở mặt trước; AI quay nhà máy về mặt trận), **avatar** riêng trong hồ sơ.
- Chất lượng: 160 unit test, 14 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Còn lại (offline): hải quân (PLAN ghi "Future"); AI chủ động chiếm đồi; vẽ unit nâng cao khi đứng trên đồi; hình công trình riêng cho
  hướng sau / trái.
- Không làm được trên trình duyệt: nút Thoát, chọn độ phân giải. Tạm hoãn theo yêu cầu: online, đồ họa / âm thanh thật.

---

## Đợt 13 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 13.1 | **AI chiếm đồi**: AI đưa quân phòng thủ / pháo lên đồi gần căn cứ hoặc gần mặt trận | §6, AI | ✅ |
| 13.2 | **Vẽ unit nâng cao trên đồi** (unit mặt đất đứng trên ô đồi được vẽ cao hơn, bóng đổ đúng) | §6 | ✅ |
| 13.3 | **Hình công trình riêng cho hướng sau / trái** (không còn lật chung với trước / phải) | §5 | ✅ |
| 13.4 | **Hải quân cơ bản**: Xưởng tàu đặt cạnh nước, tàu tuần tra / tàu pháo đi trên nước, map có nước | §4 (Future) | ✅ |
| 13.5 | Kiểm tra (unit test + trình duyệt), tài liệu | — | ✅ |

## Nhật ký đợt 13

### ✅ 13.1 AI chiếm đồi
- Từ độ khó Normal: khi quân ở nhà đủ đông (≥ 6 unit mặt đất có vũ khí và đủ lực lượng tối thiểu), AI đưa **tối đa 3 unit tầm xa**
  (ưu tiên pháo, sau đó unit có tầm bắn xa nhất) lên **ngọn đồi gần căn cứ nhất** (trong 36 ô quanh HQ) làm chốt hỏa lực.
- Quân giữ đồi không bị kéo đi tấn công; nếu đuổi địch xuống đồi thì khi rảnh sẽ tự quay lại ô của mình. Không chiếm khi đang
  phòng thủ / mở đầu trận. Easy không dùng. Map không có đồi (hoặc đồi < 3 ô) thì bỏ qua.
- Test: game-ai +1 (trên Desert Storm, AI đưa pháo + xe tăng lên đồi, 2–3 unit, đều được tính là đứng trên đồi).

### ✅ 13.2 Đồi vẽ nổi, unit đứng trên mặt đồi
- Mặt đồi giờ được vẽ **cao hơn đồng bằng 8 px**, có vách đá ở cạnh giáp ô thấp và viền sáng quanh mép; đường đồng mức nằm trên mặt đồi.
- Unit mặt đất và công trình đứng trên đồi được vẽ **trên mặt đồi** (nâng lên 8 px). Ở nửa ô quanh mép đồi độ cao chuyển mượt
  (unit "leo" lên / xuống dốc chứ không nhảy). Máy bay không bị ảnh hưởng. Vòng chọn, thanh máu, tia lửa nòng súng đi theo vị trí mới.
- Chỉ là hiển thị (không đổi mô phỏng). Kiểm tra bằng trình duyệt: xe tăng / lính trên đồi ở Coastal Front đứng đúng trên mặt đồi.
- Chưa làm: nếu rừng / nhà sát phía trên một ô đồi bị phá, phần mặt đồi nhô lên ô đó có thể bị vẽ đè (hiếm, map hiện tại không có).

### ✅ 13.3 Hình công trình mặt trước / mặt sau riêng
- Bỏ cách lật hình (hướng sau / trái dùng chung hình). Công trình được vẽ theo đúng hướng: hướng 0 / 1 (mặt trước quay về phía camera)
  có **cửa xe / cửa chính** trên mặt tường phía trước; hướng 2 / 3 (mặt trước quay ra sau) thấy **mặt sau**: cửa phụ, lưới thông gió,
  ống xả (War Factory), cửa sổ (Barracks), quạt thông gió (HQ). Sân bay có **vạch lăn bánh** sơn về phía mặt trước.
- Sửa luôn lỗi cũ: cửa xe của War Factory trước đây vẽ ở mặt +x trong khi quân ra ở mặt +y (hướng 0) — giờ cửa nằm đúng phía quân ra.
- Bóng mờ khi đặt công trình cũng vẽ theo hướng. Kiểm tra bằng trình duyệt: 4 War Factory 4 hướng có 4 hình khác nhau.

### ✅ 13.4 Hải quân cơ bản
- **Map mới Coastal Front** (Bờ biển): biển nội địa giữa bản đồ, mỗi căn cứ có một vịnh ăn vào gần (≈ 10 ô); quân bộ đi vòng theo bờ.
  Đối xứng tâm, 4 điểm chiến lược trên đất liền, 2 đồi ở mũi đất, quặng nhà xa vịnh.
- **Xưởng tàu** (Naval Yard, 1500, 3×3, cần War Factory): phải xây **ven bờ** (≥ 2 ô nước sát cạnh; sai thì báo "Phải xây ven bờ nước").
  Khi đặt, xưởng **tự quay mặt ra nước** (phím R không áp dụng). Tàu hạ thủy ở ô nước trước xưởng.
- **Tàu tuần tra** (700): nhanh, súng máy bắn được cả máy bay. **Tàu khu trục** (1800, cần Research Center): bọc thép, pháo boong bắn
  cầu vồng tầm 13 — nã được vào căn cứ sát bờ.
- Tàu **chỉ đi trên nước** (lớp điều hướng nước riêng); ra lệnh lên đất liền thì tàu đi tới chỗ nước gần nhất. Tàu không chiếm điểm /
  cờ; quân bộ không xuống nước được. Nghiên cứu giáp / động cơ xe áp dụng cho tàu.
- **AI** (từ Normal): nếu map có biển lớn (≥ 300 ô) nối bờ nhà với gần căn cứ địch thì xây 1 Xưởng tàu (quay ra nước, không tính vào
  giới hạn nhà sản xuất) và giữ tối đa 5 tàu (ưu tiên khu trục); tàu đi cùng đợt tấn công và pháo kích bờ biển. Map không có biển thì
  không xây.
- Hình vẽ: tàu có vệt sóng, thân nhọn, boong, cabin, cột ăng-ten (khu trục), tháp súng xoay; xưởng có đường trượt hạ thủy, nhà xưởng,
  cần cẩu. Icon HUD, tên / mô tả tiếng Việt.
- Test: game-core +5 (Coastal Front có 1 biển lớn tới gần mọi căn cứ và chơi được; Xưởng tàu phải ven bờ và quay ra nước; tàu hạ thủy
  trên nước, đi lên đất liền vẫn chỉ ở trên nước; xe tăng không xuống nước; khu trục bắn trúng HQ sát bờ), game-ai +2 (AI xây Xưởng tàu
  và có ≥ 2 tàu, không tàu nào lên cạn; map Desert Storm không xây).

### ✅ 13.5 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **169/169** (game-data 22, game-core 129, game-ai 15, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round13** (11 bài): Coastal Front có trong danh sách và chơi được; báo "phải xây ven bờ" khi đặt trong đất liền;
  có chỗ ven bờ gần căn cứ; Xưởng tàu có trong bảng xây dựng; xưởng tự quay ra nước (kể cả khi đã bấm R); tàu tuần tra đặt sản xuất được,
  hạ thủy trên nước; ra lệnh lên đất liền vẫn chỉ đi trên nước; War Factory đủ 4 hướng; mô tả map tiếng Việt.
  Xem ảnh chụp: đồi nổi khối với xe tăng / lính đứng trên mặt đồi; 4 hướng công trình có hình khác nhau; xưởng tàu và tàu.
- Kết quả 14 bộ × 3 trình duyệt (Chrome, Edge, Firefox): **tất cả PASS, 0 lỗi console**. Một lượt Firefox `river` hỏng ở bước mở trình
  duyệt (puppeteer hết thời gian chờ khi tạo phiên, chưa chạy bài nào); chạy lại → 7/7 PASS. Game không phải sửa.
- Sửa thêm: câu giới thiệu ở cuối menu chính bản tiếng Việt bị hiện tiếng Anh từ v0.11 (khóa dịch còn ghi v0.10) — đã cập nhật, menu ghi v0.13.
- Tài liệu cập nhật v0.13: CHANGELOG, README, GAMEPLAY_SYSTEMS §5p, AI_DESIGN §6k, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS.

## Tổng kết đợt 13
- Đã xong: **AI chiếm đồi** bằng pháo / unit tầm xa, **đồi vẽ nổi** (unit đứng trên mặt đồi), **hình công trình mặt trước / sau riêng**,
  **hải quân cơ bản** (Xưởng tàu, Tàu tuần tra, Tàu khu trục, map Coastal Front; AI cũng dùng).
- Chất lượng: 169 unit test, 14 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Giới hạn hải quân hiện tại: chỉ 2 loại tàu, chưa có tàu ngầm / tàu đổ bộ (chở quân lên bờ); AI chưa đánh riêng bằng hạm đội (tàu đi
  theo đợt tấn công chung); chỉ Coastal Front có biển đủ lớn (Island Conflict có nước nhưng bị chia thành nhiều vùng nhỏ).
- Còn lại (offline): mở rộng hải quân (tàu đổ bộ, tàu ngầm), thêm map có biển. Không làm được trên trình duyệt: nút Thoát, chọn độ phân giải.
  Tạm hoãn theo yêu cầu: online, đồ họa / âm thanh thật.

---

## Đợt 14 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 14.1 | **Tàu đổ bộ** (Landing Craft): chở bộ binh và xe mặt đất (bộ binh 1 chỗ, xe 3 chỗ, tổng 6), lên tàu từ bờ, thả quân khi sát bờ | §4 hải quân | ✅ |
| 14.2 | **AI đổ bộ**: AI có Xưởng tàu chở quân bằng tàu đổ bộ, thả gần căn cứ địch | AI | ✅ |
| 14.3 | **Map biển thứ hai** (eo biển chia đôi bản đồ, hai đầu nối đất liền) | §6 | ✅ |
| 14.4 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 14

### ✅ 14.1 Tàu đổ bộ (Landing Craft)
- Unit mới ở Xưởng tàu: **Tàu đổ bộ** (600, 500 máu, không vũ khí). Chở theo **chỗ ngồi**: 6 chỗ, bộ binh 1 chỗ, xe mặt đất (xe tăng,
  pháo, xe bọc thép…) 3 chỗ — ví dụ 1 xe tăng + 3 lính, hoặc 2 xe tăng, hoặc 6 lính. Máy bay và tàu không lên được.
- Lên tàu: chọn quân, chuột phải vào tàu đổ bộ (tàu đậu sát bờ, quân lên từ ô đất gần nhất, tầm với 2,6 ô). Ghế chia theo thứ tự chọn,
  ai không vừa thì đứng lại.
- Thả quân (phím U / nút): chỉ khi có đất trống trong vòng 2,5 ô; ngoài biển khơi báo "Đưa tàu sát bờ hơn để thả quân". Tàu chìm thì
  quân trên tàu chết theo. APC / trực thăng vận tải / Bunker vẫn chỉ nhận bộ binh như cũ.
- Bảng chọn hiện số chỗ đã dùng / 6. Hình vẽ: thân hộp đáy bằng, khoang trống, cửa dốc mũi, buồng lái ở đuôi; icon, tên / mô tả /
  thông báo lỗi tiếng Việt (bổ sung luôn bản dịch còn thiếu "Phương tiện đã đầy", "Không chở được quân").
- Test: game-core +3 (chỗ ngồi và ai được lên; APC không nhận xe tăng; chở 1 xe tăng + 3 lính qua biển, ngoài khơi không thả được, sát bãi
  biển bên kia thả được và mọi unit đứng trên đất; tàu chìm thì hành khách chết).

### ✅ 14.2 AI đổ bộ
- AI (từ Normal, đã có Xưởng tàu) đóng **1 tàu đổ bộ** sau khi có ≥ 2 chiến hạm hộ tống. Tàu đậu ở bãi biển nhà; khi đã biết căn cứ địch,
  qua mốc tấn công đầu và còn ≥ 8 unit mặt đất ở nhà, AI chọn **bãi đổ bộ cách công trình địch 5–12 ô** (ưu tiên máy khai thác / nhà máy
  điện, tránh ngay dưới họng súng), chất quân gần nhất lên (thường 1 xe tăng + 3 lính, chờ tối đa 20 giây), ra khơi, thả quân thành một
  đội tấn công mới rồi quay về bãi nhà. Tàu bị bắn còn < 40% máu thì thả quân sớm ở bãi gần nhất.
- Sửa xung đột: unit vừa được gọi lên tàu (đổ bộ hoặc trực thăng thả quân) không còn bị kéo vào đợt tấn công chung trong cùng lượt suy nghĩ.
- Map không có bãi biển gần công trình địch thì không đổ bộ.
- Test: game-ai +1 (Coastal Front: AI chất ≥ 4 chỗ lên tàu, đổ bộ, có quân lên bờ gần căn cứ địch).

### ✅ 14.3 Map Strait Crossing (Eo biển)
- Map mới **Strait Crossing**: một eo biển ngang giữa bản đồ chia **bắc / nam** (đội bắc: vị trí 1 + 3, đội nam: 2 + 4). Quân bộ chỉ
  sang được qua **hai eo đất ở hai đầu** (có đường, có đồi canh và mỏ quặng giàu); tàu làm chủ khoảng giữa. Mỗi căn cứ có một vịnh nhỏ
  để xây Xưởng tàu. Đối xứng tâm, 4 điểm chiến lược (2 eo đất, 2 bờ biển).
- Lần đầu dựng map bị 2 lỗi, đã sửa trước khi test pass: dải cát của vịnh vẽ đè lên eo biển (đổi thứ tự: cát trước, nước sau), và mỏ
  quặng nhà cách căn cứ > 12 ô (luật map hợp lệ) — dời lại gần.
- Mô tả tiếng Việt. Test: game-core +1 (map chơi được, 1 vùng biển lớn tới gần mọi căn cứ, cột giữa bị nước cắt, hai cột rìa không có
  nước), game-ai +1 (AI xây Xưởng tàu và có hạm đội trên Strait Crossing).

### ✅ 14.4 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **176/176** (game-data 23, game-core 133, game-ai 17, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round14** (10 bài): Strait Crossing có trong danh sách, có mô tả, chơi được; Xưởng tàu ven eo biển, đặt sản
  xuất tàu đổ bộ; chọn 1 xe tăng + 3 lính + 1 xe tăng hạng nặng rồi "chuột phải" vào tàu → xe tăng + 3 lính lên (6 chỗ), xe hạng nặng ở
  lại bờ; bảng chọn hiện "6/6 chỗ"; bấm U ngoài khơi bị từ chối kèm gợi ý "sát bờ hơn"; tới bãi bờ nam bấm U → cả 4 lên bờ; mô tả tiếng Việt.
- Chỉnh sau khi xem ảnh: câu gợi ý khi tàu trống và mô tả tàu đổ bộ quá dài, bị xuống dòng / cắt trong bảng chọn → rút gọn.
- Kết quả 15 bộ × 3 trình duyệt (Chrome, Edge, Firefox) = 45 lượt: **tất cả PASS ngay lần đầu, 0 lỗi console**. (Đã tăng thời gian chờ
  khởi động trình duyệt lên 120 giây sau lần Firefox mở chậm ở đợt 13; bỏ script `flow` cũ khỏi bộ chạy.)
- Tài liệu cập nhật v0.14: CHANGELOG, README, GAMEPLAY_SYSTEMS §5q, AI_DESIGN §6l, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS; menu ghi v0.14.

## Tổng kết đợt 14
- Đã xong: **tàu đổ bộ** chở cả bộ binh lẫn xe (tính theo chỗ ngồi), **AI đổ bộ** đánh vào gần căn cứ địch, **map Strait Crossing**.
- Chất lượng: 176 unit test, 15 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Còn lại (offline, tùy chọn): tàu ngầm (cần cơ chế tàng hình), AI dùng hạm đội như lực lượng riêng (săn tàu địch, phong tỏa); map biển
  thêm vào trình sửa map đã có (cọ Nước có sẵn) nhưng chưa có kiểm tra "có biển đủ lớn" cho map tự làm.
  Không làm được trên trình duyệt: nút Thoát, chọn độ phân giải. Tạm hoãn theo yêu cầu: online, đồ họa / âm thanh thật.

---

## Đợt 15 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 15.1 | **Tàu ngầm**: lặn (địch không thấy trừ khi tàu ở gần dò được hoặc vừa phóng ngư lôi), ngư lôi chỉ đánh tàu; chỉ Tàu tuần tra (bom chìm) và tàu ngầm đánh được tàu ngầm — tạo vòng khắc chế khu trục > tuần tra, tàu ngầm > khu trục, tuần tra > tàu ngầm | §4 hải quân | ✅ |
| 15.2 | **AI dùng hạm đội như lực lượng riêng**: săn tàu địch, pháo kích công trình ven biển, giữ vùng biển nhà; AI đóng tàu ngầm khi thấy chiến hạm địch | AI | ✅ |
| 15.3 | **Trình sửa map: kiểm tra biển** — báo vùng biển lớn nhất và căn cứ nào xây được Xưởng tàu | §6 | ✅ |
| 15.4 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 15

### ✅ 15.1 Tàu ngầm
- Unit mới ở Xưởng tàu: **Tàu ngầm** (1300, cần Research Center, 450 máu). Luôn lặn: **địch không thấy** (không hiện trên màn hình,
  minimap, không bị nhắm bắn) trừ khi:
  - có **sonar** của địch trong 7 ô (Tàu tuần tra, hoặc tàu ngầm khác), hoặc
  - bất kỳ unit / công trình nào của địch ở sát trong 2 ô, hoặc
  - nó **vừa phóng ngư lôi** (lộ 2 giây).
- **Ngư lôi** (tầm 6) chỉ đánh được tàu. Tàu ngầm chỉ bị đánh bởi vũ khí săn ngầm: **bom chìm của Tàu tuần tra** (sát thương ×6 với tàu
  ngầm) và ngư lôi của tàu ngầm khác. Pháo, xe tăng, máy bay, pháo khu trục không làm gì được nó; nổ lan cũng không trúng.
- Tạo **vòng khắc chế hải quân** (đã kiểm chứng bằng mô phỏng 1 đấu 1): tàu ngầm thắng khu trục, tàu tuần tra thắng tàu ngầm, khu trục thắng
  tàu tuần tra. Phải chỉnh cân bằng một lần: ban đầu tàu ngầm thắng cả tàu tuần tra → tăng hệ số bom chìm 3,5 → 6 và giãn nhịp ngư lôi 70 → 80.
- Hình vẽ: thân thuôn sát mặt nước, tháp chỉ huy, kính tiềm vọng, vệt sóng; tàu ngầm của mình vẽ **mờ** (đang lặn). Icon, tên / mô tả tiếng Việt.
- Test: game-core +3 (ai nhắm được tàu ngầm, ngư lôi không đánh xe tăng / công trình; ẩn trước khu trục cách 7 ô dù trong tầm nhìn, lộ trước
  sonar tàu tuần tra cách 6,5 ô, ẩn lại khi tàu tuần tra mất, lộ 2 giây sau khi phóng; vòng khắc chế 3 trận 1–1).
- Ghi chú: một lần chạy `pnpm -r test` báo game-data hỏng (18/23, không in tên bài lỗi); chạy riêng và chạy lại toàn bộ 2 lần đều 23/23 —
  chưa tìm ra nguyên nhân, sẽ để ý ở các lần chạy sau.

### ✅ 15.2 AI dùng hạm đội như lực lượng riêng
- Chiến hạm của AI (khu trục, tuần tra, tàu ngầm) **không còn đi chung với quân bộ** mà thành một hạm đội riêng, mỗi lượt suy nghĩ chọn
  theo thứ tự ưu tiên:
  1. **Giao chiến** với tàu địch gần nhất đang thấy.
  2. **Giữ bờ**: địch ở gần công trình của AI mà tàu áp sát được (bãi biển trong 8 ô) → kéo tới đó.
  3. **Pháo kích bờ biển**: có ≥ 3 chiến hạm và đã qua mốc tấn công đầu → tới vùng nước gần công trình địch đã biết (trong 12 ô, vừa tầm
     pháo khu trục 13).
  4. Không có việc → về **vịnh nhà** (cạnh Xưởng tàu).
- Sản xuất: tối đa 6 chiến hạm; khu trục trước, luôn có ít nhất 1 tàu tuần tra (sonar săn ngầm); **đóng tàu ngầm khi đã thấy chiến hạm
  địch**.
- Lần đầu chạy test, hạm đội không pháo kích vì chỉ tìm bãi trong 9 ô quanh mục tiêu (HQ trên Coastal Front cách nước gần nhất > 9 ô)
  → nới lên 12 ô.
- Test: game-ai +2 (2 khu trục + tàu tuần tra canh đánh chìm khu trục địch giữa biển; 3 khu trục pháo kích HQ địch đã biết, mọi tàu vẫn ở trên nước).

### ✅ 15.3 Trình sửa map: kiểm tra biển
- Dưới dòng kiểm tra "map chơi được", trình sửa map hiện thêm dòng **⚓ Hải quân**: "biển rộng N ô; xây được Xưởng tàu ở vị trí 1, 3…"
  hoặc "chưa có cảng — cần vùng biển từ 300 ô nước giáp đất trống gần một vị trí xuất phát". Cập nhật ngay khi vẽ.
- Vị trí có cảng = có chỗ 3×3 đất trống (không quặng) trong 14 ô quanh điểm xuất phát, sát ≥ 2 ô nước thuộc một vùng biển ≥ 300 ô.
  Ngưỡng 300 ô giờ là hằng số dùng chung với AI (AI chỉ làm hải quân khi có biển như vậy) nên trình sửa map báo đúng điều AI sẽ làm.
- Chỉ là thông tin, không chặn việc lưu / chơi map. Tiếng Việt đầy đủ.
- Test: game-data +1 (Coastal Front, Strait Crossing có cảng ở cả 4 vị trí và biển ≥ 300 ô; Highland Pass không có nước; hồ nhỏ ở Desert
  Storm không tính là biển).

### ✅ 15.4 Kiểm tra, trình duyệt, tài liệu
- `pnpm check`: typecheck ✅, lint ✅, test **182/182** (game-data 24, game-core 136, game-ai 19, server 3) ✅, build ✅.
- Bộ test trình duyệt mới **round15** (7 bài): trình sửa map hiện dòng ⚓ Hải quân (map trống: chưa có cảng; có cả bản tiếng Việt);
  đóng được tàu ngầm khi có Research Center; tàu ngầm địch nằm trong vùng nhìn của khu trục ta nhưng **không hiện**; thả tàu tuần tra
  vào gần → sonar làm lộ và tàu tuần tra đánh chìm nó; bảng chọn hiện Tàu ngầm.
  Hai bài hỏng ở lần chạy đầu đều do test: tàu ngầm địch đặt trong tầm ngư lôi nên phóng vào khu trục và tự lộ (đúng luật) → dời ra
  ngoài tầm; nút menu tiếng Việt là "Trình sửa bản đồ". Bỏ một bài "không hiện trên minimap" vì bài đó không thực sự kiểm tra gì.
- Xem ảnh: tàu ngầm địch không được vẽ; tàu ngầm của mình vẽ mờ. Mô tả tàu ngầm bị cắt dòng cuối trong bảng chọn → rút gọn.
- Kết quả 16 bộ × 3 trình duyệt (Chrome, Edge, Firefox) = 48 lượt: **tất cả PASS, 0 lỗi console**.
- Tài liệu cập nhật v0.15: CHANGELOG, README, GAMEPLAY_SYSTEMS §5r, AI_DESIGN §6m, TESTING, DEVELOPMENT_ROADMAP, PLAN_STATUS; menu ghi v0.15.

## Tổng kết đợt 15
- Đã xong: **tàu ngầm** (tàng hình, sonar, vòng khắc chế hải quân), **AI điều hạm đội riêng** (giao chiến tàu, giữ bờ, pháo kích, đóng
  tàu ngầm khi thấy chiến hạm địch), **kiểm tra cảng / biển trong trình sửa map**.
- Chất lượng: 182 unit test, 16 bộ test trình duyệt PASS trên Chrome / Edge / Firefox.
- Hải quân giờ đã đủ bộ cơ bản (4 loại tàu + tàu đổ bộ, 2 map biển, AI dùng đầy đủ). Hướng tiếp theo có thể là: thêm nhiệm vụ chiến
  dịch trên biển, cân bằng lại hải quân qua các trận AI-vs-AI dài, hoặc mục khác trong PLAN (offline). Không làm được trên trình duyệt:
  nút Thoát, chọn độ phân giải. Tạm hoãn theo yêu cầu: online, đồ họa / âm thanh thật.

---

## Đợt 16 — kế hoạch (chơi offline với máy)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 16.1 | **Nhiệm vụ chiến dịch 5 "Tidewater"** trên Strait Crossing: xây Xưởng tàu, đánh chìm tàu địch, đổ bộ chiếm bờ nam, tiêu diệt địch | §2 Campaign | ✅ |
| 16.2 | **Map ngẫu nhiên có biển**: ô "Biển" trong thiết lập khi chọn map ngẫu nhiên (seed cũ giữ nguyên khi tắt) | §6 | ✅ |
| 16.3 | **Mô phỏng cân bằng hải quân AI-vs-AI** trên các map biển (nhiều seed): thống kê, chỉnh nếu lệch | cân bằng | ✅ |
| 16.4 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ✅ |

## Nhật ký đợt 16

### ✅ 16.1 Nhiệm vụ chiến dịch 5 "Tidewater" (Thủy triều)
- Nhiệm vụ thứ 5, mở khóa sau Highland Siege. Map **Strait Crossing**, người chơi ở bờ bắc, đối thủ **Southern Fleet** (Pacific, Normal) ở
  bờ nam, 8000 tiền. Mục tiêu (không theo thứ tự): **xây Xưởng tàu**, **đánh chìm 3 tàu địch**, **chiếm Bờ Nam** (đổ bộ bằng tàu đổ bộ),
  **tiêu diệt toàn bộ địch**. Lời dẫn nhắc vòng khắc chế hải quân và tàu ngầm. Toàn bộ chữ có tiếng Việt.
- Thống kê mới mỗi người chơi: **số tàu bị mất** (dùng cho mục tiêu đánh chìm tàu).
- Khi thử AI đối thủ (3 seed, 14 phút) phát hiện **AI Normal xây Xưởng tàu nhưng không đóng tàu nào**: luật "giữ sản xuất trước đợt tấn
  công đầu" chặn luôn Xưởng tàu, sau đó quân bộ chiếm hết giới hạn quân số. Sửa:
  - Xưởng tàu vẫn sản xuất khi AI đang giữ quân bộ (hạm đội là lực lượng riêng).
  - Khi gần chạm giới hạn quân số (còn < 12) mà chưa có 3 chiến hạm, AI tạm dừng sản xuất quân bộ để dành chỗ cho tàu.
  Sau khi sửa: cả 3 seed AI đều có tàu tuần tra (và tàu đổ bộ ở 2 seed). AI Normal chưa có khu trục / tàu ngầm vì độ khó này không xây
  Research Center (như trước).
- Test: game-core +1 (mở khóa theo thứ tự; người chơi ở bờ bắc, địch bờ nam; Xưởng tàu → mục tiêu 1; 2 tàu + 1 xe tăng chết chưa đủ, tàu
  thứ 3 thì đủ; chiếm Bờ Nam), game-ai +1 (AI vẫn đóng tàu trong lúc giữ quân).

### ✅ 16.2 Map ngẫu nhiên có biển
- Khi chọn **map ngẫu nhiên**, thiết lập trận có ô **🌊 Biển** (được nhớ cho lần sau). Bật lên: map có **biển nội địa ở giữa** (bờ cát) và
  **vịnh ăn tới từng căn cứ** để xây Xưởng tàu; tên map thêm chữ "Coast", điểm chiến lược giữa map được bỏ (vì là biển).
- Dùng luồng ngẫu nhiên riêng: **tắt biển thì mọi seed cũ cho ra đúng map cũ**. Nếu 30 lần tạo đều không hợp lệ thì dùng Coastal Front
  (thay vì Desert Storm) — test 25 seed không seed nào phải dùng dự phòng.
- Mô tả map ngẫu nhiên giờ được dịch tiếng Việt cho **mọi seed** (trước chỉ dịch được seed 1), cả bản có biển.
- Test: game-data +1 (25 seed có biển: chơi được, biển ≥ 300 ô, cả 4 vị trí xây được Xưởng tàu, không có điểm "Centre"; cùng seed không
  biển vẫn có "Centre"), game-core +1 (trận với `mapSea` ra bản Coast, không `mapSea` ra bản thường).

### ✅ 16.3 Mô phỏng cân bằng AI-vs-AI (hải quân + công bằng vị trí xuất phát)
- Chạy 18 trận AI Hard trên Coastal Front, Strait Crossing, map ngẫu nhiên có biển (6 seed mỗi map, tính cách khác nhau). Phát hiện:
  1. **AI không bao giờ đóng Khu trục** (0 chiếc / 18 trận). Nguyên nhân: quân bộ chỉ chừa tiền bằng giá Tàu tuần tra (700), Khu trục
     giá 1800 nên không bao giờ đủ; tick sau Xưởng tàu lại đổi sang tàu rẻ. Sửa: Xưởng tàu **giữ con tàu đã chọn** đến khi đóng được,
     quân bộ **chừa đúng giá con tàu đó** khi hạm đội còn dưới 4 chiếc.
  2. Sau khi sửa (1) lộ ra AI **"nướng" tàu tuần tra** (có trận đóng 32 chiếc, mất 39). Sửa: mất ≥ 4 tàu trong 3 phút → Xưởng tàu nghỉ 2 phút.
  3. **Bên ở vị trí xuất phát 2 thắng 17 / 19 trận có kết quả**, không phụ thuộc phe hay thứ tự slot (đã thử đổi phe, đổi thứ tự cập
     nhật AI, đổi vị trí). Tìm ra 3 nguồn lệch theo tọa độ tuyệt đối và đã sửa:
     - **Đặt công trình**: vòng xoắn luôn thử phía trên-trái trước → căn cứ góc tây bắc bị dồn vào góc map, quân ra chậm. Giờ thử phía
       giữa map trước, lật theo từng góc → 4 góc có bố cục giống nhau.
     - **Chọn đồi để giữ**: đo khoảng cách tới ô đầu tiên của đồi (luôn là góc tây bắc) → một bên coi cao nguyên giữa là "gần" và đưa
       quân lên chết dần. Giờ đo tới tâm đồi, lính đứng ở các ô đồi gần căn cứ mình nhất.
     - **Tìm đường A\***: khi hai đường dài bằng nhau, thứ tự duyệt hướng cố định khiến cả hai bên cùng vòng phía tây. Giờ ưu tiên ô gần
       đường thẳng và lệch phải theo hướng đi (không đổi khi xoay map 180°) → đường đi của hai bên đối xứng hoàn toàn (đã kiểm tra trên
       Highland Pass, Forest Warfare). Phần ưu tiên tối đa ~0,1 ô nên đường không dài thêm đáng kể.
     - Lõi chiến đấu được kiểm tra riêng (2 nhóm 8 unit giống hệt, đặt đối xứng, không AI): không nghiêng về bên nào (vị trí 1 thắng 8/12).
- Kết quả sau khi sửa:
  - Hải quân: AI đóng **1–7 Khu trục** mỗi trận, không còn đóng tàu hàng loạt (nhiều nhất 7 tàu tuần tra). Khu trục pháo kích bờ rất
    hiệu quả (có trận 69–89 lần hạ địch) — người chơi có Tàu ngầm để khắc chế, nên chưa giảm sức mạnh; sẽ theo dõi.
  - Công bằng vị trí (30 trận Warlord Hard giống hệt nhau trên 5 map đối xứng): **trước 2 – 17, sau 5 – 16, hòa 9**. Desert Storm và
    River Crossing đã cân (3–1, 1–4 với ít mẫu), Island Conflict hầu như hòa. **Còn lệch: Highland Pass 0–6, Forest Warfare 1–5** —
    nguyên nhân còn lại nằm ở chiến lược AI trên 2 map này (chưa tìm ra; đường đi, bố cục căn cứ, lõi chiến đấu đã đối xứng). Ảnh hưởng
    chủ yếu tới trận AI-vs-AI và đồng minh AI; để ý ở đợt sau.
- Dọn dẹp: gỡ 2 hook debug còn sót trong code (`__flip` ở placement, `__swap` ở world) và 3 file debug test đã lỡ commit; mô phỏng được
  gom vào `packages/game-ai/src/balance.sim.ts`, chạy riêng bằng `pnpm --filter @shadow-front/game-ai sim` (~3 phút, không nằm trong
  `pnpm test`).

### ✅ 16.4 Kiểm tra, trình duyệt, tài liệu
- Unit test: **186 PASS** (server 3, game-data 25, game-core 138, game-ai 20); typecheck + lint toàn repo sạch.
- Bộ test trình duyệt mới **round16** (7 bài): Tidewater đã mở khóa, chạy trên Strait Crossing, có mục tiêu Xưởng tàu; map ngẫu nhiên có ô
  Biển → map "Coast" có biển lớn, không có điểm Centre, lựa chọn được nhớ; AI Hard (có Xưởng tàu + Research Center) đặt đóng Khu trục.
- **17 bộ test trình duyệt PASS trên Chrome / Edge / Firefox**. Ghi chú trung thực: lần chạy đầu bộ `campaign` báo 2 lỗi trên Chrome /
  Edge vì bộ test còn đếm 4 nhiệm vụ (đã có nhiệm vụ thứ 5 từ 16.1) — sửa bộ test, game không phải sửa; `round3` trên Edge lỗi 2 bài
  (nghiên cứu, sửa chữa — hết thời gian chờ), chạy lại PASS, game không phải sửa.
- Tài liệu: CHANGELOG 0.16.0, AI_DESIGN §6n, TESTING (v0.16, lệnh `sim`), README (chiến dịch 5 nhiệm vụ — trước ghi nhầm 4).

## Tổng kết đợt 16
- Đã xong: **nhiệm vụ 5 Tidewater**, **map ngẫu nhiên có biển**, **AI đóng Khu trục / không nướng tàu**, **sửa 3 nguồn lệch vị trí xuất
  phát** (đặt công trình, chọn đồi, tìm đường), dọn code debug, mô phỏng cân bằng chạy riêng bằng `pnpm sim`.
- Chất lượng: 186 unit test, 17 bộ test trình duyệt PASS trên 3 trình duyệt.
- Còn tồn tại: AI giống hệt nhau vẫn thắng nhiều hơn ở vị trí 2 trên **Highland Pass (0–6)** và **Forest Warfare (1–5)**; Khu trục pháo
  kích bờ rất mạnh trong tay AI — theo dõi tiếp.

---

## Đợt 17 — kế hoạch (chơi offline với máy; người dùng chọn: AI tự thích nghi + thêm nhiệm vụ chiến dịch)

| # | Công việc | Mục PLAN | Trạng thái |
|---|---|---|---|
| 17.1 | **AI thích nghi trong trận** (Normal trở lên): rút kinh nghiệm sau mỗi đợt tấn công (thua đậm → gom quân đông hơn, đổi mục tiêu / hướng đánh), nhận ra lối chơi của người chơi (rush sớm, rùa phòng thủ, không quân, hải quân) và đổi kế hoạch xây (trụ sớm, pháo + tên lửa tầm xa, SAM, tàu ngầm); thông báo "Địch đổi chiến thuật" | AI | ✅ |
| 17.2 | **AI nhớ lối chơi của bạn giữa các trận** (Hard / Insane, lưu trong hồ sơ offline): chuẩn bị đối sách từ đầu trận; tắt được trong Settings | AI | ✅ |
| 17.3 | **Nhiệm vụ 6 "Iron Convoy"** (Snowfield, tuyết + đêm): hộ tống MCV tới vị trí, lập căn cứ tiền tuyến, giữ 5 phút, tiêu diệt địch | §2 Campaign | ✅ |
| 17.4 | **Nhiệm vụ 7 "Shadow Front"** (trận cuối, 2v2 có đồng minh AI, địch Hard thích nghi): chiếm mọi điểm, phá HQ cả hai địch | §2 Campaign | ✅ |
| 17.5 | Kiểm tra (unit test + Chrome / Edge / Firefox), tài liệu | — | ⏳ |

## Nhật ký đợt 17

### ✅ 17.1 AI thích nghi trong trận
- **Cách làm**: không dùng học máy, mà là luật có trí nhớ, chạy tất định (cùng seed → cùng kết quả). Module mới
  `packages/game-ai/src/adaptation.ts`: commander báo sự kiện → module rút bài học → commander đọc lại tham số.
- **Rút kinh nghiệm sau tấn công** (Normal trở lên): mỗi đội tấn công được chấm điểm **mỗi 90 giây** và khi tan: giá trị
  địch bị hạ (dựa trên điểm kinh nghiệm của unit) so với giá trị quân mình mất.
  - Thua đậm (tỉ số < 0,5, mất ≥ 20%) → **gom quân đông hơn** (ngưỡng ×1,3, tối đa ×2).
  - Thua 2 lần cùng một chỗ → **đổi mục tiêu**, tránh chỗ đó 5 phút.
  - Thắng lớn → **dồn ép** (rút ngắn thời gian chờ giữa các đợt).
  - Ban đầu chỉ chấm khi đội tan, nhưng mô phỏng cho thấy cả 6 trận × 25 phút chỉ có 2 lần chấm (đội AI đánh rất lâu
    mới tan) → đổi sang chấm theo từng giai đoạn 90 giây.
- **Đọc lối chơi của bạn** (Hard; Insane nhận ra sớm hơn), mỗi kiểu phản ứng một lần:
  - Rush (bị đánh tới căn cứ trước 5,5 phút) → giữ quân ở nhà nhiều hơn 30% trong 10 phút đầu.
  - Rùa (≥ 4 công trình phòng thủ) → pháo binh / unit tầm xa, Missile Launcher, gom quân đông hơn 15%.
  - Không quân (≥ 30% quân thấy được) → SAM (tối đa 3), unit bắn được máy bay.
  - Hải quân (≥ 3 chiến hạm) → ưu tiên tàu ngầm.
- **Người chơi thấy được**: thông báo "Warlord 1 đổi chiến thuật: …" trong trận; màn kết quả có mục **"Đối thủ đã thích
  nghi thế nào"** (thời điểm + nội dung). Cùng một chiến thuật không thông báo lại trong 2 phút. Có tiếng Việt.
- **Kiểm chứng bằng mô phỏng** (cùng AI Warlord Hard, bật / tắt thích nghi, đánh 24 trận với đối thủ Rush và Fortress):
  - Bản đầu chống rush bằng cách xây thêm 2 trụ: **thua nhiều hơn** (14–6 so với 17–4) vì chậm kinh tế → bỏ, thay bằng
    giữ quân ở nhà. Đã thử tắt "dồn ép" (không đổi gì) và bỏ hệ số ×1,15 khi công thành (kém hơn) → giữ nguyên.
  - Kết quả cuối: tỉ lệ thắng **gần như bằng** (Rush 16–5 so với 17–4, Fortress 11–8 so với 12–8) nhưng **thắng nhanh
    hơn** (15,4 so với 17,0 phút; 18,9 so với 19,5 phút). Nói thẳng: AI-vs-AI chưa chứng minh AI thích nghi mạnh hơn —
    các phản ứng theo lối chơi nhắm vào thói quen của người chơi (rush sớm, rùa, spam máy bay) mà AI đối thủ ít thể hiện.
- Test: game-ai +9 (`adaptation.test.ts`), tổng **195 unit test PASS**; typecheck + lint sạch. Bộ test trình duyệt mới
  **round17** (6 bài): địch Hard biết 4+ trụ của bạn → thông báo công thành; màn kết quả liệt kê; không thích nghi thì
  không hiện mục; bản tiếng Việt.
- **18 bộ test trình duyệt PASS trên Chrome / Edge / Firefox**. Ghi chú: lần chạy đầu `survival` lỗi 1 bài trên cả 3
  trình duyệt (đọc đồng hồ "next in 02:" lúc trận chưa kịp chạy, vì Vite vừa biên dịch lại sau khi sửa code); chạy lại
  8/8 PASS trên cả 3 — game không phải sửa.

### ✅ 17.2 AI nhớ lối chơi của bạn giữa các trận
- **Ghi nhận**: AI ở mọi độ khó đều ghi lại lối chơi nó thấy ở bạn (rush / rùa / không quân / hải quân); cuối trận các
  AI phía địch gộp lại thành `detectedStyles`.
- **Lưu thói quen** (khóa `shadow-front.habits` trong trình duyệt): trung bình trượt, trận gần nhất chiếm 40%.
  Gặp **2 trận liền** → thành thói quen (≥ 0,5); thói quen giữ từ 4 trận trở lên thì qua 1 trận không gặp vẫn còn.
  Chiến dịch không học và không dùng trí nhớ (nhiệm vụ đã được thiết kế sẵn); Survival / tutorial không có AI địch
  nên không cập nhật.
- **Dùng trí nhớ**: khi vào trận đấu tự do, thói quen được đưa vào cấu hình trận; AI **Hard / Insane** đối đầu
  với người chơi chuẩn bị đối sách **ngay từ giây đầu** và báo "Warlord 1 nhớ lối chơi của bạn: …". Màn kết quả
  đánh dấu "(nhớ từ các trận trước)". Trận AI đấu AI bỏ qua trí nhớ.
- **Settings**: ô "AI Khó nhớ lối chơi của tôi" (mặc định bật), dòng "Đang nhớ: phòng thủ dày…" và nút **Quên**
  (xóa hồ sơ cũng xóa luôn trí nhớ). Có tiếng Việt.
- Lỗi phát hiện khi test trình duyệt và đã sửa: nút Quên chỉ hiện khi đã thành thói quen, nên dữ liệu chưa đủ ngưỡng
  (vd. 0,25) không xóa được → giờ hiện khi có bất kỳ dữ liệu nào.
- Test: game-ai +4 (tổng **199 unit test PASS**); typecheck + lint sạch. Bộ **round17** mở rộng lên 12 bài, PASS trên
  Chrome (ghi nhận rùa → 0,4; Settings hiện thói quen; AI Hard chuẩn bị từ trí nhớ; tắt tùy chọn → AI bắt đầu từ đầu;
  Quên xóa trí nhớ).
- Chạy lại cả **18 bộ test trình duyệt trên Chrome / Edge / Firefox: PASS**. Ghi chú: `campaign` trên Edge lỗi 1 bài
  ("objective completes out of order") ở lần chạy loạt, chạy lại riêng PASS; `round13` trên Firefox đạt 11/11 nhưng
  có lỗi tải font Google (mạng), không liên quan game.

### ✅ 17.3 Nhiệm vụ 6 "Iron Convoy" (Đoàn xe thép)
- Map **Snowfield**, **tuyết + ban đêm**, mở khóa sau Tidewater. Người chơi **không có căn cứ**: chỉ có xe MCV, 2 xe tăng,
  công binh và 5 unit thường ở góc tây bắc. Đối thủ **Iron Guard** (phe Iron, Normal, lối Rush).
- Mục tiêu (theo thứ tự): **hộ tống MCV tới Ngã tư Băng giá** (giữa map) → **triển khai căn cứ tiền tuyến** (phím U) →
  **giữ căn cứ 5 phút** (căn cứ bị phá thì đồng hồ tính lại) → **tiêu diệt Iron Guard**.
- **Ổ phục kích** 7 unit giữa đường. Hạ tầng mới: `MissionDef.setup` (dàn quân riêng cho nhiệm vụ), `World.missionMarks`
  (đồng hồ của mục tiêu), cờ `guard` cho unit (AI không điều động — nếu không, AI gọi quân phục kích về nhà).
- **Cân chỉnh bằng mô phỏng** (người chơi giả lập: đi thẳng, triển khai, xây 1 nhà điện + 2 trụ rồi đứng yên):
  - Bản đầu: phục kích quá yếu (mất 1 unit) và **Iron Guard không bao giờ tấn công** → tìm ra **lỗi AI thật**: AI chỉ
    trinh sát các vị trí xuất phát nên không bao giờ thấy căn cứ đặt ở chỗ khác. Sửa: trinh sát thêm các điểm chiến lược
    và giữa map, rồi đi tuần lại liên tục (cũng có lợi cho trận thường khi người chơi mở căn cứ bằng MCV).
  - Phục kích có thêm trụ → đoàn xe chết sạch ở cả 4 seed (quá khó) → bỏ trụ, giữ 7 unit và cho chúng đứng yên.
  - Iron Guard kiểu Warlord vẫn không tấn công (quân dưới ngưỡng) → đổi sang Rush. Kết quả cuối: người chơi giả lập
    giữ được căn cứ đủ 5 phút rồi bị đánh bại ở phút 10–12 nếu không xây thêm quân — người chơi thật cần phòng thủ.
- Sửa thêm: camera lúc vào trận nhìn vào đoàn quân khi chưa có căn cứ (trước đó chỉ nhìn HQ).

### ✅ 17.4 Nhiệm vụ 7 "Shadow Front" (Mặt trận Bóng tối) — trận cuối
- Map **Forest Warfare**, chu kỳ ngày / đêm, chế độ Chặt đầu, 10 000 tiền. **2 đấu 2**: bạn + **Northern Wing** (AI Hard)
  đấu **Shadow Legion** (Eastern, lối Shadow) và **Black Sun** (Desert, lối Eagle), cả hai **Hard có thích nghi** (17.1).
  Lời dẫn nhắc: chúng đọc lối đánh của bạn, hãy đổi chiến thuật.
- Mục tiêu: **giữ cả 3 điểm chiến lược cùng lúc**, **phá cả hai Sở chỉ huy địch**. Hoàn thành nhiệm vụ này là hoàn thành
  chiến dịch (thành tích "hoàn thành chiến dịch" đã có trong hồ sơ, giờ cần đủ 7 nhiệm vụ).
- Toàn bộ chữ của 2 nhiệm vụ có tiếng Việt.
- Test: game-core +2 (Iron Convoy: không căn cứ, đoàn xe + phục kích, không bị xử thua khi chưa có công trình, đủ 4 mục
  tiêu, đồng hồ tính lại khi mất căn cứ; Shadow Front: 2v2 Hard, đủ điểm + 2 HQ, thắng kiểu chặt đầu; thứ tự mở khóa
  7 nhiệm vụ). Tổng **201 unit test PASS**; typecheck + lint sạch. Bộ trình duyệt mới **round17b** (11 bài) và bộ
  `campaign` (giờ 7 nhiệm vụ) PASS trên Chrome.

