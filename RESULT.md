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
| 4.6 | Mô phỏng cân bằng (độ dài trận theo độ khó), `pnpm check`, test trình duyệt Chrome/Edge/Firefox, cập nhật docs            | ⬜         |

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
