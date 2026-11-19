# SHADOW FRONT
# MASTER GAME DEVELOPMENT DOCUMENT
**Version:** 1.0  
**Project:** SHADOW FRONT  
**Genre:** Modern Warfare – Real-Time Strategy (RTS)  
**Platform:** Web / PC Browser  
**Development approach:** AI-assisted development  
**Game engine:** Phaser 3  
**Frontend:** React + TypeScript  
**Backend:** NestJS + Socket.IO  
**Primary mode:** Online Co-op vs AI  

---

# PART 1. PROJECT OVERVIEW

## 1.1. Vision

SHADOW FRONT là game chiến thuật thời gian thực (RTS), lấy cảm hứng từ Command & Conquer: Red Alert 3, nhưng đặt trong bối cảnh chiến tranh hiện đại.

Người chơi có thể:

- Xây dựng căn cứ quân sự.
- Khai thác tài nguyên.
- Sản xuất bộ binh, xe tăng, máy bay, pháo binh.
- Nghiên cứu công nghệ.
- Điều khiển quân đội trên chiến trường.
- Thành lập đội với bạn bè.
- Tạo phòng chơi online.
- Phối hợp 1–5 người chống lại AI.
- Chơi PvP 1v1, 3v3 và 5v5 trong các phiên bản sau.

Mục tiêu là tạo ra một RTS thực sự có chiều sâu chiến thuật, không phải game click-and-wait hoặc game chiến thuật dạng idle.

## 1.2. Design Decisions

Các quyết định đã thống nhất và không được tự ý thay đổi:

| Category | Decision |
|---|---|
| Camera | 2.5D Isometric |
| Art style | Stylized Realism |
| Genre | Real-Time Strategy |
| Setting | Modern Warfare |
| Factions | 5 |
| Combat | Hybrid |
| Economy | Classic RTS |
| Multiplayer priority | Co-op |
| Maximum players | 5 |
| AI | Custom RTS AI |
| Frontend | React + TypeScript |
| Game Engine | Phaser 3 |
| Backend | NestJS |
| Realtime | Socket.IO |
| Database | PostgreSQL |
| Cache | Redis |

## 1.3. Core Design Philosophy

Game phải đáp ứng 5 nguyên tắc:

1. Strategic Depth: người chơi phải suy nghĩ về chiến thuật, kinh tế và quân đội.
2. Real-time Combat: các đơn vị tự động chiến đấu nhưng người chơi có thể can thiệp.
3. Cooperative Gameplay: phối hợp đồng đội là trải nghiệm quan trọng.
4. Intelligent AI: AI phải biết xây dựng, sản xuất, trinh sát, tấn công và phòng thủ.
5. Expandable Architecture: kiến trúc phải hỗ trợ thêm phe, đơn vị, map và chế độ chơi.

---

# PART 2. GAMEPLAY DESIGN

## 2.1. Main Gameplay Loop

BUILD BASE → GATHER RESOURCES → BUILD ARMY → EXPLORE → CONTROL TERRITORY → COMBAT → VICTORY.

Người chơi bắt đầu với một Headquarters và tài nguyên ban đầu.

Sau đó:

1. Xây Power Plant.
2. Xây Barracks.
3. Xây War Factory.
4. Khai thác tài nguyên.
5. Sản xuất quân đội.
6. Trinh sát bản đồ.
7. Chiếm các vị trí chiến lược.
8. Tấn công hoặc phòng thủ.
9. Hoàn thành nhiệm vụ.

Một trận đấu mục tiêu kéo dài 20–35 phút.

## 2.2. Five Factions

### Faction 1 – WESTERN ALLIANCE

Phong cách: Balanced Warfare.

- Modern Main Battle Tank.
- Mechanized Infantry.
- Attack Helicopter.
- Fighter Jet.
- Advanced Radar.
- Mobile Artillery.

Đặc điểm: cân bằng giữa bộ binh, thiết giáp, không quân và phòng thủ.

### Faction 2 – EASTERN LEGION

Phong cách: Heavy Firepower.

- Heavy Battle Tank.
- Rocket Artillery.
- Armored Infantry.
- Heavy APC.
- Long-range Missile System.

Đặc điểm: hỏa lực mạnh, xe tăng hạng nặng và pháo binh.

### Faction 3 – PACIFIC TECHNOLOGY

Phong cách: Advanced Technology.

- Recon Drone.
- Combat Robot.
- Electronic Warfare Vehicle.
- Advanced Fighter.
- Smart Defense System.

Đặc điểm: công nghệ, trinh sát và kiểm soát thông tin.

### Faction 4 – DESERT CORPS

Phong cách: Rapid Assault.

- Light Attack Vehicle.
- Special Forces.
- Fast Recon Vehicle.
- Attack Helicopter.
- Mobile Rocket System.

Đặc điểm: tốc độ, phục kích và tấn công cơ động.

### Faction 5 – IRON REPUBLIC

Phong cách: Defensive Warfare.

- Heavy Defense Tank.
- Advanced SAM.
- Fortified Bunker.
- Coastal Defense.
- Strategic Missile System.

Đặc điểm: phòng thủ, kiểm soát khu vực và phản công.

Các phe phải có cân bằng về gameplay. Không được tạo phe mạnh tuyệt đối.

Trong MVP, có thể dùng chung một số đơn vị cơ bản và tạo khác biệt qua chỉ số, công nghệ, skin và đơn vị đặc trưng.

## 2.3. Military Units

Chia quân đội thành 6 nhóm:

**Infantry**
- Rifleman
- Anti-Tank Soldier
- Engineer
- Sniper
- Special Forces

**Armored**
- Light Tank
- Main Battle Tank
- Heavy Tank
- APC
- IFV

**Air Force**
- Attack Helicopter
- Recon Drone
- Fighter Jet
- Bomber
- Transport Helicopter

**Artillery**
- Mobile Artillery
- Rocket Launcher
- Long-range Artillery
- MLRS

**Navy**
- Destroyer
- Frigate
- Submarine
- Aircraft Carrier

Navy thuộc giai đoạn mở rộng.

**Defense**
- Machine Gun Turret
- Anti-Tank Turret
- SAM
- Radar Station
- Missile Defense

## 2.4. Hybrid Combat System

Đơn vị tự động chiến đấu khi phát hiện mục tiêu phù hợp.

Người chơi có thể:

- Move.
- Attack.
- Attack Move.
- Hold Position.
- Defensive Stance.
- Retreat.
- Focus Fire.
- Stop.

Combat phải có:

- Attack range.
- Vision range.
- Damage.
- Armor.
- Attack speed.
- Projectile.
- Hit detection.
- Health.
- Death animation.
- Unit counter system.

Không được tạo combat chỉ bằng cách giảm HP tức thời mà không có hình ảnh, animation và phản hồi trực quan.

## 2.5. Economy

Hai loại tài nguyên chính:

**Credits**
- Xây dựng công trình.
- Sản xuất quân.
- Nâng cấp công nghệ.

**Power**
- Cung cấp điện cho công trình.
- Cấp năng lượng cho radar.
- Duy trì các hệ thống phòng thủ.

Các nguồn tài nguyên:

- Resource Extractor.
- Supply Depot.
- Resource Nodes.
- Strategic Control Points.

Mỗi đơn vị và công trình có cost, build time và các thông số cấu hình riêng.

## 2.6. Buildings

MVP gồm:

1. Headquarters.
2. Power Plant.
3. Barracks.
4. War Factory.
5. Airfield.
6. Research Center.

Các công trình mở rộng:

- Naval Yard.
- Missile Silo.
- Advanced Radar.
- Defense Center.
- Supply Depot.

---

# PART 3. GAME MODES

## 3.1. Co-op vs AI – Primary Mode

Ưu tiên số một.

Cấu hình:

- 1–5 người chơi.
- 1–5 AI đối thủ.
- Chọn map.
- Chọn phe.
- Chọn độ khó.
- Chọn tài nguyên ban đầu.
- Public / Private Room.

Các kịch bản:

- 1 Player vs 1 AI.
- 2 Players vs 2 AI.
- 3 Players vs 3 AI.
- 5 Players vs 5 AI.

Có thể thêm AI đồng minh trong những kịch bản đặc biệt.

## 3.2. AI Difficulty

Easy:
- Xây dựng chậm.
- Sản xuất ít quân.
- Ít tổ chức tấn công.
- Phản ứng chậm.

Normal:
- Biết phát triển kinh tế.
- Biết xây dựng căn cứ.
- Biết tổ chức quân đội.
- Biết phòng thủ.

Hard:
- Biết khắc chế quân đội.
- Biết trinh sát.
- Biết phối hợp tấn công.
- Biết thay đổi chiến thuật.

Insane:
- Quản lý tài nguyên tối ưu.
- Tổ chức nhiều hướng tấn công.
- Phản ứng nhanh.
- Sử dụng chiến thuật phối hợp.

Không được tạo độ khó bằng cách gian lận tài nguyên hoặc nhìn thấy toàn bộ bản đồ.

## 3.3. AI Commander Personalities

RUSH:
- Aggressive.
- Early Attack.
- Fast Production.

FORTRESS:
- Defensive.
- Strong Base.
- Counter Attack.

EAGLE:
- Air Force.
- Reconnaissance.
- Aerial Assault.

SHADOW:
- Intelligence.
- Ambush.
- Tactical Attack.

WARLORD:
- Balanced Army.
- Large-scale Attack.
- Multi-front Strategy.

## 3.4. Future Modes

- PvP 1v1.
- PvP 3v3.
- PvP 5v5.
- Survival.
- Campaign.
- Ranked.
- Tournament.

Không triển khai tất cả ngay trong MVP.

---

# PART 4. MAP DESIGN

MVP có hai bản đồ.

## Map 01 – DESERT STORM

Đặc điểm:
- Sa mạc.
- Địa hình rộng.
- Nhiều khu vực tài nguyên.
- Một số vị trí cao.
- Đường di chuyển xe tăng thuận lợi.
- Các khu vực có thể xây căn cứ.

Gameplay:
- Tank battle.
- Long-range artillery.
- Territorial control.

## Map 02 – URBAN CONFLICT

Đặc điểm:
- Thành phố hiện đại.
- Nhà cao tầng.
- Công trình công nghiệp.
- Đường phố hẹp.
- Vật cản.
- Các tuyến đường chiến thuật.

Gameplay:
- Infantry.
- Ambush.
- Close combat.
- Urban defense.

Mỗi map cần:

- Tilemap.
- Isometric coordinates.
- Collision layer.
- Resource locations.
- Spawn points.
- Base zones.
- Strategic points.
- Pathfinding data.
- Fog of War.

Map phải được thiết kế để người chơi có nhiều lựa chọn chiến thuật.

---

# PART 5. ART DIRECTION & IMAGE DESIGN

## 5.1. Visual Style

Phong cách hình ảnh:

Stylized Realism + Modern Military RTS.

Yêu cầu:

- Military atmosphere.
- Realistic proportions.
- Detailed vehicles.
- Modern military architecture.
- High-quality terrain.
- Clear unit silhouettes.
- Consistent faction colors.
- Readable combat effects.

Không sử dụng phong cách:
- Pixel art.
- Cartoon.
- Anime.
- Low-detail mobile game.
- Flat 2D icons làm hình ảnh chiến trường.

## 5.2. Camera

2.5D Isometric.

Góc nhìn chéo từ trên xuống.

Yêu cầu:

- Zoom in/out.
- Camera pan.
- Smooth camera movement.
- Unit selection.
- Drag selection.
- Minimap.
- Terrain depth.
- Layered objects.

## 5.3. Image Asset Rules

Mỗi asset phải có:

- Unique ID.
- Filename.
- Category.
- Dimensions.
- Animation state.
- Faction.
- License information.
- Transparent background nếu là sprite.

Tên file phải thống nhất.

Ví dụ:

```text
assets/
  units/
    western/
      rifleman/
      main-battle-tank/
      attack-helicopter/

    eastern/
      heavy-tank/
      rocket-artillery/

  buildings/
    headquarters/
    barracks/
    war-factory/
    power-plant/

  maps/
    desert-storm/
    urban-conflict/

  effects/
    explosions/
    muzzle-flash/
    projectiles/
    smoke/

  ui/
    icons/
    buttons/
    panels/
    backgrounds/
```

## 5.4. MASTER IMAGE GENERATION PROMPT

Dùng prompt sau để tạo hình ảnh tham chiếu cho dự án:

"Create a premium modern warfare real-time strategy video game visual concept.

The game features a large modern military battlefield viewed from a 2.5D isometric perspective.

Show modern main battle tanks, mechanized infantry, military helicopters, mobile artillery, military headquarters, defensive structures and modern industrial buildings.

Visual style: high-quality stylized realism, realistic military proportions, detailed PBR-inspired materials, cinematic environmental lighting, sophisticated terrain design.

The scene should look like a premium PC real-time strategy game, with clear visual hierarchy, readable units and carefully designed battlefield composition.

Use realistic modern military environments, detailed terrain, natural shadows, believable proportions and atmospheric depth.

No cartoon aesthetics, no anime, no pixel art, no fantasy weapons, no excessive visual clutter.

The final image must communicate the visual identity of SHADOW FRONT."

## 5.5. IMAGE PROMPTS – MAIN MENU

Prompt:

"Design a premium PC military strategy game main menu for SHADOW FRONT.

Dark military command center atmosphere, cinematic battlefield in the background, modern military headquarters, armored tanks, helicopters, radar screens and tactical map overlays.

Dark graphite UI, military green accents, subtle orange warning lights, sophisticated typography, clean modern interface.

Include space for:
PLAY
MULTIPLAYER
ARMY
PROFILE
SETTINGS

Professional AAA-inspired strategy game menu design, realistic visual hierarchy, high-quality game UI mockup."

## 5.6. IMAGE PROMPTS – LOBBY

"Create a high-quality multiplayer RTS game lobby interface for SHADOW FRONT.

Military command center visual theme.

Show:
- Blue team slots.
- Red team slots.
- Five player positions per team.
- AI bot selection.
- Map preview.
- Faction selection.
- Difficulty selection.
- Game settings.
- Ready button.
- Start match button.

Dark military interface, clear information hierarchy, tactical map preview, modern PC strategy game UI."

## 5.7. IMAGE PROMPTS – IN-GAME HUD

"Create a premium modern warfare RTS gameplay HUD mockup.

2.5D isometric battlefield with military bases, tanks, infantry and helicopters.

Interface layout:

Top left:
Credits and power resources.

Top center:
Match timer and objectives.

Top right:
Minimap and team status.

Bottom:
Selected units, command buttons, unit production, building construction.

Use dark military panels, green highlights, subtle orange accents, clear icons and readable typography.

The battlefield must occupy most of the screen.

Professional desktop RTS interface, no mobile UI."

## 5.8. IMAGE PROMPTS – UNITS

For each unit, generate separate assets.

Example:

"Create a modern main battle tank game asset for SHADOW FRONT.

Three-quarter isometric view, stylized realistic military vehicle, detailed armor plates, realistic tracks, modern turret, believable proportions.

Orthographic isometric camera, consistent lighting, isolated transparent background, full vehicle visible, centered composition.

No text, no watermark, no UI, no background, no cropped components.

Designed for a premium 2.5D military RTS game."

Create similar prompts for:

- Rifleman.
- Anti-Tank Soldier.
- Engineer.
- Light Tank.
- Heavy Tank.
- APC.
- Attack Helicopter.
- Fighter Jet.
- Recon Drone.
- Mobile Artillery.

## 5.9. IMAGE PROMPTS – BUILDINGS

"Create a modern military headquarters building asset for SHADOW FRONT.

Isometric orthographic perspective, modern command center, military communication antennas, defensive walls, reinforced architecture, realistic military design.

Stylized realism, detailed materials, consistent camera angle, isolated transparent background, full building visible.

Designed for a 2.5D isometric real-time strategy game."

Create separate assets for:

- Headquarters.
- Power Plant.
- Barracks.
- War Factory.
- Airfield.
- Research Center.
- Radar Station.
- Defense Turret.

## 5.10. IMAGE PROMPTS – MAPS

DESERT STORM:

"Create a large seamless 2.5D isometric RTS desert battlefield environment.

Desert terrain, rocky mountains, sandy roads, resource deposits, abandoned military installations, strategic open spaces, realistic terrain transitions.

Designed for a modern warfare real-time strategy game.

No UI, no text, no perspective distortion.

Clear grid-compatible isometric composition."

URBAN CONFLICT:

"Create a detailed 2.5D isometric modern urban military battlefield.

Modern city blocks, industrial facilities, destroyed buildings, roads, bridges, defensive structures, urban obstacles and strategic combat zones.

Stylized realistic PC RTS game environment.

Clear walkable areas and obstacle placement."

Important:
Image generation is for visual assets and references. Actual playable map data must be created in Tiled or an equivalent map editor. Do not use a single generated image as the complete game map.

## 5.11. ANIMATION ASSET REQUIREMENTS

Each unit should have:

- Idle.
- Move.
- Attack.
- Hit.
- Destroy.

Buildings:

- Construction.
- Idle.
- Damaged.
- Destroyed.

Effects:

- Muzzle flash.
- Bullet projectile.
- Missile projectile.
- Explosion.
- Smoke.
- Fire.
- Impact.

Prefer sprite sheets with consistent frame dimensions, transparent backgrounds and clear animation states.

For units with directional movement, prepare 8 directional animations where feasible.

---

# PART 6. TECHNICAL ARCHITECTURE

## 6.1. Tech Stack

Frontend:
- React.
- TypeScript.
- Vite.
- Phaser 3.
- Zustand.
- Tailwind CSS.

Backend:
- NestJS.
- Socket.IO.
- PostgreSQL.
- Redis.
- Prisma.

Game:
- Phaser Renderer.
- Isometric Map System.
- Game Simulation.
- Combat Engine.
- Economy Engine.
- AI Engine.
- A* Pathfinding.

Infrastructure:
- Docker.
- CI/CD.
- Cloud game server.
- Logging and monitoring.

## 6.2. Monorepo Structure

```text
shadow-front/
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── pages/
│   │       ├── stores/
│   │       └── game/
│   │
│   └── server/
│       └── src/
│           ├── auth/
│           ├── rooms/
│           ├── matchmaking/
│           ├── matches/
│           ├── simulation/
│           ├── combat/
│           ├── economy/
│           ├── ai/
│           └── gateway/
│
├── packages/
│   ├── game-core/
│   ├── game-ai/
│   ├── game-data/
│   ├── shared-types/
│   └── game-config/
│
├── assets/
│   ├── units/
│   ├── buildings/
│   ├── maps/
│   ├── effects/
│   ├── audio/
│   └── ui/
│
├── tools/
│   └── map-editor/
│
└── docs/
    ├── GDD.md
    ├── ARCHITECTURE.md
    ├── API.md
    ├── ASSETS.md
    └── ROADMAP.md
```

## 6.3. Architecture Principles

1. Game Core must not depend on React or Phaser.
2. Phaser only handles rendering and player input.
3. NestJS manages authoritative multiplayer simulation.
4. AI runs on the server.
5. Game data must be configuration-driven.
6. All gameplay commands must be validated by the server.
7. Use fixed simulation timestep.
8. Use delta snapshots for multiplayer.
9. Use entity IDs consistently.
10. Keep gameplay logic testable independently.

## 6.4. Server Simulation

Initial targets:

- Simulation: 20 ticks/second.
- Client snapshots: 10 updates/second.
- AI decisions: 2–4 times/second.
- Client rendering: target 60 FPS.

Use:
- Spatial partitioning.
- Object pooling.
- Snapshot interpolation.
- Interest management.
- Pathfinding optimization.
- AI scheduling.

These are targets to validate through profiling, not guaranteed performance figures.

## 6.5. AI Engine

Implement custom RTS AI using TypeScript.

Components:

- AI Commander.
- Economy AI.
- Building AI.
- Production AI.
- Tactical AI.
- Recon AI.
- Army Management.
- Decision Engine.

Use:
- Behavior Tree.
- Utility Scoring.
- Finite State Machine.
- A* Pathfinding.
- Rule-based Counter Strategy.

Do not call external LLM APIs for ordinary combat decisions.

AI must use the same game rules, resource costs, build times and unit limitations as human players.

---

# PART 7. DEVELOPMENT PHASES

AI coding agents must implement the project phase by phase.

Do not attempt to generate the entire game in one response or one coding operation.

Each phase must produce a working result before the next phase begins.

## PHASE 0 – PROJECT FOUNDATION

Estimated: 1 week.

Tasks:

1. Initialize monorepo.
2. Configure React + TypeScript + Vite.
3. Configure Phaser 3.
4. Configure NestJS.
5. Configure PostgreSQL and Prisma.
6. Configure Redis.
7. Create shared packages.
8. Configure ESLint and Prettier.
9. Configure environment variables.
10. Create documentation.

Deliverables:

- Running frontend.
- Running backend.
- Database connection.
- Basic application shell.
- Initial project documentation.

Acceptance criteria:

- Frontend starts successfully.
- Backend starts successfully.
- Database migration works.
- Shared packages compile.
- No TypeScript errors.

## PHASE 1 – ISOMETRIC GAME ENGINE

Estimated: 2 weeks.

Tasks:

1. Integrate Tiled.
2. Load isometric map.
3. Implement camera.
4. Implement zoom.
5. Implement camera boundaries.
6. Implement mouse selection.
7. Implement drag selection.
8. Render unit sprites.
9. Implement minimap.
10. Implement collision layer.

Deliverables:

Playable map with camera and selectable units.

Acceptance criteria:

- Map renders correctly.
- Camera movement works.
- Zoom works.
- Units can be selected.
- Terrain collision works.
- Minimap displays map information.

## PHASE 2 – UNIT MOVEMENT & PATHFINDING

Estimated: 1–2 weeks.

Tasks:

1. Build unit entity system.
2. Implement A*.
3. Implement grid navigation.
4. Implement movement commands.
5. Implement obstacle avoidance.
6. Implement unit separation.
7. Implement group movement.
8. Implement movement animation.

Deliverables:

Units can move around the map.

Acceptance criteria:

- Units cannot move through blocked terrain.
- Units can navigate around obstacles.
- Multiple units can move together.
- Movement remains smooth.

## PHASE 3 – ECONOMY & BASE BUILDING

Estimated: 2 weeks.

Tasks:

1. Credits system.
2. Power system.
3. Resource nodes.
4. Resource extraction.
5. Building placement.
6. Building construction.
7. Building health.
8. Production queues.
9. Unit spawning.
10. Building destruction.

Deliverables:

Playable offline RTS economy.

Acceptance criteria:

- Players can build a base.
- Players can produce units.
- Resources are deducted correctly.
- Power consumption works.
- Buildings can be damaged and destroyed.

## PHASE 4 – COMBAT ENGINE

Estimated: 2 weeks.

Tasks:

1. Unit vision.
2. Target detection.
3. Target selection.
4. Attack commands.
5. Automatic combat.
6. Projectile system.
7. Damage calculation.
8. Armor and counters.
9. Unit destruction.
10. Combat effects.

Deliverables:

Fully functional offline combat.

Acceptance criteria:

- Units detect enemies.
- Units attack automatically.
- Player commands override default behavior.
- Damage is calculated correctly.
- Combat animations work.
- Units can be destroyed.

## PHASE 5 – AI COMMANDER

Estimated: 2–3 weeks.

Tasks:

1. AI resource management.
2. AI base building.
3. AI production.
4. AI army management.
5. AI scouting.
6. AI tactical decisions.
7. AI attack strategy.
8. AI defense strategy.
9. AI retreat strategy.
10. Difficulty settings.
11. Commander personalities.

Deliverables:

One human player can play against AI.

Acceptance criteria:

- AI builds a functioning base.
- AI gathers resources.
- AI produces military units.
- AI launches attacks.
- AI defends its base.
- AI responds to player strategy.
- AI respects fog of war.

## PHASE 6 – ONLINE MULTIPLAYER FOUNDATION

Estimated: 2 weeks.

Tasks:

1. Authentication.
2. Socket.IO connection.
3. Room management.
4. Create room.
5. Join room.
6. Leave room.
7. Ready system.
8. Faction selection.
9. Bot management.
10. Match start.
11. Server game state.
12. Reconnection.

Deliverables:

Online lobby and room system.

Acceptance criteria:

- Multiple browsers can join the same room.
- Room state is synchronized.
- Players can select factions.
- Host can configure AI.
- Players can start a match.

## PHASE 7 – ONLINE CO-OP

Estimated: 2–3 weeks.

Tasks:

1. Server-authoritative simulation.
2. Game command validation.
3. Multiplayer movement.
4. Multiplayer combat.
5. Economy synchronization.
6. Building synchronization.
7. AI server integration.
8. Fog of War synchronization.
9. Shared vision.
10. Reconnection.
11. Match result.

Deliverables:

Online Co-op with 2–5 players against AI.

Acceptance criteria:

- Players see consistent game state.
- Players can cooperate.
- AI behaves correctly.
- Game continues when one player disconnects.
- Server validates all gameplay commands.

## PHASE 8 – UI, CONTENT & POLISH

Estimated: 2–3 weeks.

Tasks:

1. Main menu.
2. Multiplayer lobby.
3. Faction selection.
4. In-game HUD.
5. Building menu.
6. Unit command panel.
7. Minimap.
8. Match results.
9. Sound effects.
10. Animation improvements.
11. Two maps.
12. Five faction data configurations.

Deliverables:

MVP-ready SHADOW FRONT.

## PHASE 9 – TESTING & RELEASE

Tasks:

1. Gameplay testing.
2. AI testing.
3. Multiplayer testing.
4. Network stress testing.
5. Performance profiling.
6. Browser compatibility.
7. Security review.
8. Bug fixing.
9. Deployment.
10. Playtest.

Deliverables:

Public playable beta.

---

# PART 8. DEVELOPMENT RULES FOR AI CODING AGENTS

These rules are mandatory.

## 8.1. Before Writing Code

Always:

1. Inspect the current repository.
2. Read existing documentation.
3. Understand the current architecture.
4. Identify existing implementations.
5. Reuse existing code where appropriate.
6. Identify missing requirements.
7. Create an implementation plan.

Never assume the repository is empty.

## 8.2. During Development

- Use TypeScript strict mode.
- Avoid unnecessary dependencies.
- Avoid duplicated game logic.
- Keep modules small and focused.
- Separate game logic from rendering.
- Use reusable components.
- Use configuration-driven unit definitions.
- Use clear naming conventions.
- Add error handling.
- Add tests for important game logic.

Do not:

- Put all game logic into one file.
- Hardcode unit statistics in components.
- Put AI decision logic inside Phaser scenes.
- Let clients calculate authoritative damage.
- Generate fake multiplayer behavior.
- Use mock data as a substitute for implemented features.
- Claim a feature is complete when it is only a visual prototype.

## 8.3. Phase Completion

Before completing any phase:

1. Run lint.
2. Run TypeScript checks.
3. Run relevant tests.
4. Build the application.
5. Verify actual functionality.
6. Fix errors.
7. Update documentation.
8. Report completed features.
9. Report incomplete features.
10. Identify the next phase.

Do not automatically move to the next phase if the current phase has blocking errors.

## 8.4. Image and Asset Management

Before generating or importing an asset:

1. Check whether it already exists.
2. Check dimensions and format.
3. Check transparent background requirements.
4. Check animation requirements.
5. Check visual consistency.
6. Check license and usage rights.
7. Register it in the asset manifest.

Never use random images from the internet without checking their licensing.

Generated images must be integrated into actual game assets, not merely displayed as decorative UI backgrounds.

## 8.5. Documentation

Maintain:

- GDD.md
- ARCHITECTURE.md
- API.md
- ASSETS.md
- ROADMAP.md
- CHANGELOG.md
- TESTING.md

Update documents whenever implementation decisions materially change.

---

# PART 9. MASTER PROMPT FOR AI CODING AGENTS

Copy the following prompt when starting the project in Cursor, Claude Code or another coding agent.

---

You are the Lead Game Architect, Senior TypeScript Engineer, RTS Gameplay Programmer, Multiplayer Engineer and Technical Project Manager responsible for developing SHADOW FRONT.

Your responsibility is to build a complete browser-based real-time strategy game.

You must follow the SHADOW FRONT MASTER GAME DEVELOPMENT DOCUMENT as the source of truth.

PROJECT VISION:

SHADOW FRONT is a modern military RTS inspired by Command & Conquer: Red Alert 3.

It uses:
- 2.5D Isometric camera.
- Stylized realistic military visuals.
- Five unique military factions.
- Classic RTS economy.
- Base construction.
- Military unit production.
- Hybrid real-time combat.
- Custom RTS AI.
- Online Co-op.
- Future PvP 1v1, 3v3 and 5v5.

TECHNOLOGY:

Frontend:
React, TypeScript, Vite, Phaser 3, Zustand, Tailwind CSS.

Backend:
NestJS, Socket.IO, PostgreSQL, Prisma, Redis.

Architecture:
Monorepo, shared TypeScript packages, server-authoritative game simulation.

DEVELOPMENT STRATEGY:

Build the game incrementally.

Never attempt to implement the entire game at once.

Start by inspecting the repository.

Determine:
- Existing code.
- Existing dependencies.
- Existing architecture.
- Missing features.
- Current implementation phase.

Then propose the smallest meaningful implementation step.

For every task:

1. Explain the implementation plan.
2. Identify affected files.
3. Implement the feature.
4. Add necessary tests.
5. Run lint and TypeScript checks.
6. Run the build.
7. Verify the feature.
8. Update documentation.
9. Report the result.

GAME ENGINE REQUIREMENTS:

Phaser 3 handles:
- Isometric rendering.
- Camera.
- Unit rendering.
- Animation.
- Mouse interaction.
- Selection.
- Minimap.
- Visual effects.

Game Core handles:
- Units.
- Buildings.
- Economy.
- Combat.
- Commands.
- Game simulation.
- Pathfinding.

AI Engine handles:
- Economy decisions.
- Base building.
- Production.
- Army management.
- Scouting.
- Tactical decisions.
- Difficulty.
- Commander personalities.

Backend handles:
- Authentication.
- Rooms.
- Matchmaking.
- Multiplayer.
- Authoritative simulation.
- AI execution.
- Reconnection.
- Match results.

IMPORTANT:

Do not use React for rendering hundreds of individual game entities.

Do not place game simulation inside UI components.

Do not allow clients to control authoritative game state.

Do not use external LLM APIs for ordinary AI combat behavior.

Do not create fake multiplayer systems.

Do not use placeholder images as finished game assets.

Do not skip phases.

Do not modify established architecture without explaining why and obtaining approval.

CURRENT OBJECTIVE:

Start with PHASE 0.

Inspect the repository, prepare the monorepo architecture, initialize the applications and establish a working development environment.

Do not implement later phases until the current phase has been validated.

Your final response for each task must include:

- What was implemented.
- Files created or modified.
- Dependencies added.
- Commands to run.
- Tests performed.
- Remaining issues.
- Recommended next task.

Your goal is to build a genuinely playable, maintainable and expandable SHADOW FRONT game, not just a collection of UI mockups.

---

# PART 10. FIRST PROMPT – START DEVELOPMENT

Use this prompt for the first coding session:

"Let's begin developing SHADOW FRONT.

Read the complete SHADOW FRONT Master Game Development Document.

Start with PHASE 0 – Project Foundation.

First inspect the current workspace and determine whether an existing project is present.

Then propose the monorepo structure and explain the responsibilities of each application and shared package.

Initialize:
- React + TypeScript + Vite frontend.
- Phaser 3 integration.
- NestJS backend.
- PostgreSQL + Prisma.
- Redis integration.
- Shared game-core package.
- Shared game-data package.
- Shared types package.
- AI engine package.

Configure development scripts, linting, formatting and environment variables.

Do not build gameplay yet.

Make sure the project can start successfully.

Run all relevant checks and report the results.

Do not proceed to PHASE 1 until PHASE 0 is complete."

---

# PART 11. PHASE-SPECIFIC PROMPTS

These prompts are intended to be used sequentially.

## PROMPT PHASE 1 – ISOMETRIC MAP

"Implement PHASE 1 of SHADOW FRONT.

Build the 2.5D Isometric rendering system using Phaser 3.

Requirements:
- Tiled map integration.
- Isometric coordinate conversion.
- Camera pan.
- Camera zoom.
- Camera bounds.
- Terrain rendering.
- Object layers.
- Collision layers.
- Mouse selection.
- Drag selection.
- Unit rendering.
- Minimap.

Use a consistent isometric coordinate system.

Keep the renderer separate from game-core logic.

Create a playable Desert Storm prototype.

Do not implement multiplayer yet.

Test all camera and selection interactions."

## PROMPT PHASE 2 – UNIT MOVEMENT

"Implement PHASE 2.

Create a reusable unit entity system.

Implement:
- Unit state.
- A* pathfinding.
- Movement commands.
- Obstacle avoidance.
- Group movement.
- Collision.
- Unit separation.
- Movement animation.
- Selection feedback.

Units must navigate around buildings and terrain obstacles.

Ensure movement is deterministic enough to support future server-authoritative multiplayer.

Create tests for pathfinding and movement."

## PROMPT PHASE 3 – ECONOMY

"Implement PHASE 3.

Build the complete initial RTS economy.

Implement:
- Credits.
- Power.
- Resource nodes.
- Resource extraction.
- Building placement.
- Construction progress.
- Building health.
- Production queues.
- Unit spawning.
- Resource validation.

Create six initial building definitions.

Use configuration-driven data.

Build a playable base-building experience.

Do not hardcode gameplay values inside React or Phaser components."

## PROMPT PHASE 4 – COMBAT

"Implement PHASE 4.

Build a complete RTS combat engine.

Implement:
- Vision.
- Target detection.
- Target selection.
- Automatic attacks.
- Manual attack commands.
- Attack move.
- Hold position.
- Focus fire.
- Damage.
- Armor.
- Projectiles.
- Health.
- Destruction.
- Combat animation.

Create unit counter rules.

Ensure that combat is visually understandable and tactically meaningful.

Add automated tests for damage calculations and targeting."

## PROMPT PHASE 5 – AI COMMANDER

"Implement PHASE 5.

Build the SHADOW FRONT RTS AI Engine.

The AI must:
- Gather resources.
- Construct buildings.
- Produce units.
- Manage the army.
- Scout the map.
- Defend the base.
- Attack enemy bases.
- Retreat when appropriate.
- Adapt its strategy.

Implement four difficulty levels.

Implement at least three initial commander personalities.

Use Behavior Trees, Utility Scoring, State Machines and Pathfinding where appropriate.

AI must follow the same economy and gameplay rules as human players.

AI must respect Fog of War.

Do not use external AI APIs.

The result must be a fully playable human-versus-AI RTS match."

## PROMPT PHASE 6 – ONLINE LOBBY

"Implement PHASE 6.

Build the online multiplayer lobby using NestJS and Socket.IO.

Features:
- Authentication.
- Create room.
- Join room.
- Leave room.
- Public room.
- Private room.
- Password.
- Ready state.
- Faction selection.
- Map selection.
- Add AI.
- Remove AI.
- Difficulty configuration.
- Host permissions.
- Start match.

Multiple browser sessions must be able to join and synchronize the same room.

Build a complete multiplayer lobby UI."

## PROMPT PHASE 7 – ONLINE CO-OP

"Implement PHASE 7.

Integrate the game simulation with the authoritative NestJS server.

Implement:
- Multiplayer game sessions.
- Server-side game state.
- Player commands.
- Unit synchronization.
- Building synchronization.
- Economy synchronization.
- Combat synchronization.
- AI server execution.
- Fog of War.
- Shared vision.
- Reconnection.
- Match completion.

Use efficient snapshots and delta updates.

The server must validate all important game commands.

Support Co-op for up to five players against AI.

Test with multiple independent browser sessions."

## PROMPT PHASE 8 – VISUAL POLISH

"Implement PHASE 8.

Improve the complete SHADOW FRONT visual experience.

Build:
- Main menu.
- Multiplayer lobby.
- Faction selection.
- In-game HUD.
- Building menu.
- Unit command panel.
- Minimap.
- Match results.
- Visual effects.
- Sound effects.
- Unit animation.

Integrate actual game assets.

Ensure all UI controls are functional.

Keep a consistent military command center visual identity.

Optimize rendering performance."

## PROMPT PHASE 9 – RELEASE

"Implement PHASE 9.

Prepare SHADOW FRONT for public beta testing.

Perform:
- Functional testing.
- AI testing.
- Multiplayer testing.
- Security validation.
- Performance profiling.
- Network testing.
- Browser compatibility.
- Deployment configuration.
- Bug fixing.

Test matches with multiple players and AI.

Document known issues.

Do not claim release readiness unless the acceptance criteria have been verified."

---

# PART 12. MVP DEFINITION OF DONE

The MVP is considered complete only when all of the following work:

## Game

- [ ] Isometric map renders.
- [ ] Camera works.
- [ ] Units can be selected.
- [ ] Units can move.
- [ ] Pathfinding works.
- [ ] Buildings can be constructed.
- [ ] Resources work.
- [ ] Units can be produced.
- [ ] Units can fight.
- [ ] Units can be destroyed.
- [ ] Fog of War works.

## AI

- [ ] AI constructs a base.
- [ ] AI collects resources.
- [ ] AI produces units.
- [ ] AI defends.
- [ ] AI attacks.
- [ ] AI adapts to the opponent.
- [ ] AI difficulty works.
- [ ] AI respects game rules.

## Multiplayer

- [ ] Players can create rooms.
- [ ] Players can join rooms.
- [ ] Players can select factions.
- [ ] Players can select maps.
- [ ] Players can add AI.
- [ ] Players can start a match.
- [ ] Game state synchronizes.
- [ ] Players can cooperate.
- [ ] Disconnected players can reconnect.

## Content

- [ ] Five faction configurations.
- [ ] Six initial buildings.
- [ ] Eight to twelve unit types.
- [ ] Two playable maps.
- [ ] Three initial AI personalities.
- [ ] Four difficulty levels.
- [ ] Two mission types.

## Quality

- [ ] No critical gameplay bugs.
- [ ] No critical synchronization bugs.
- [ ] No resource duplication exploits.
- [ ] No invalid client-side authoritative commands.
- [ ] Performance has been profiled.
- [ ] Build and tests pass.
- [ ] Documentation is updated.

---

# PART 13. FINAL PROJECT DIRECTION

SHADOW FRONT must prioritize a genuinely playable RTS experience over visual complexity.

Development priorities:

1. Gameplay foundation.
2. Unit movement.
3. Base building.
4. Economy.
5. Combat.
6. AI Commander.
7. Multiplayer.
8. Visual quality.
9. More factions and content.
10. PvP expansion.

The first major milestone is:

**A player opens SHADOW FRONT in a browser, starts a match on Desert Storm, constructs a military base, gathers resources, produces tanks and infantry, and fights against an AI Commander that independently builds its own base and launches attacks.**

The second major milestone is:

**The player invites friends, creates a private Co-op room, selects factions, adds AI opponents and fights together in an online multiplayer match.**

The long-term vision is a complete modern military RTS platform with five factions, multiple maps, intelligent AI opponents, cooperative warfare and competitive multiplayer.

**SHADOW FRONT – Build Your Army. Command Your Team. Conquer the Battlefield.**


# SHADOW FRONT — MASTER AUTONOMOUS DEVELOPMENT PROMPT

Bạn là một Senior Game Engineer, Game Architect, Technical Lead và Full-stack Engineer có kinh nghiệm phát triển RTS game, multiplayer game và browser-based game.

Nhiệm vụ của bạn là trực tiếp phát triển dự án **SHADOW FRONT** trong workspace hiện tại.

Bạn phải tự đọc tài liệu, phân tích kiến trúc, tạo thư mục, tạo file, viết code, cài đặt dependencies, chạy kiểm tra và sửa lỗi. Không chỉ trả lời bằng hướng dẫn hoặc ví dụ code.

---

# 1. QUY TẮC BẮT BUỘC

Trước khi thực hiện bất kỳ thay đổi nào:

1. Kiểm tra toàn bộ cấu trúc project hiện tại.
2. Đọc đầy đủ file `docs/MASTER_GAME_DEVELOPMENT.md`.
3. Đọc các tài liệu khác trong `docs/` nếu đã tồn tại.
4. Kiểm tra các file cấu hình và source code hiện có.
5. Xác định những phần đã hoàn thành và những phần còn thiếu.

Quy tắc:

- `docs/MASTER_GAME_DEVELOPMENT.md` là tài liệu thiết kế gốc và nguồn tham chiếu chính.
- Không tự ý thay đổi các quyết định gameplay đã được thống nhất.
- Không xóa file hiện có nếu chưa thực sự cần thiết.
- Không ghi đè nội dung có giá trị.
- Không tạo file trùng lặp.
- Không tạo quá nhiều abstraction không cần thiết.
- Không viết code giả hoặc chỉ tạo giao diện tĩnh để báo đã hoàn thành gameplay.
- Không sử dụng dữ liệu giả để thay thế những tính năng được yêu cầu phải hoạt động.
- Không bỏ qua lỗi TypeScript, ESLint hoặc build.
- Không dừng lại sau khi tạo kế hoạch. Phải thực hiện công việc.
- Nếu một tính năng quá lớn, chia thành các bước nhỏ và hoàn thành từng bước có thể kiểm chứng.
- Nếu gặp vấn đề không thể giải quyết, ghi rõ nguyên nhân và tiếp tục các phần độc lập khác.
- Không hỏi người dùng những câu hỏi không thực sự cần thiết. Chủ động chọn giải pháp kỹ thuật hợp lý.

Mọi thay đổi phải tương thích với cấu trúc hiện tại.

---

# 2. TỔNG QUAN GAME

Tên game: SHADOW FRONT

Thể loại:
- Real-time Strategy (RTS).
- Modern Warfare.
- Base Building.
- Tactical Combat.
- Online Multiplayer.
- Cooperative PvE.
- Competitive PvP.

Định hướng gameplay:

Lấy cảm hứng từ dòng Command & Conquer: Red Alert 3, nhưng xây dựng một thế giới chiến tranh hiện đại với công nghệ quân sự, phương tiện, vũ khí và chiến thuật hiện đại.

Không sao chép tài sản, hình ảnh, âm thanh, bản đồ hoặc nội dung có bản quyền của Red Alert 3.

Nền tảng:
- Chạy trực tiếp trên trình duyệt.
- Không yêu cầu người chơi cài đặt game.
- Ưu tiên desktop.
- Có khả năng mở rộng cho các trình duyệt phổ biến.

Phong cách hình ảnh:
- Stylized Realism.
- Modern Military.
- 2.5D Isometric.
- Môi trường chiến trường hiện đại.
- Hiệu ứng cháy nổ, khói, đạn và chiến đấu.
- UI theo phong cách quân sự hiện đại.
- Không sử dụng pixel art.
- Không sử dụng phong cách anime hoặc cartoon.

Camera:
- Isometric.
- Zoom in/out.
- Pan camera.
- Theo dõi đơn vị khi cần thiết.

---

# 3. GAMEPLAY ĐÃ THỐNG NHẤT

## 3.1. Main Gameplay Loop

BUILD BASE → GATHER RESOURCES → BUILD ARMY → EXPLORE → CONTROL TERRITORY → COMBAT → VICTORY.

Người chơi bắt đầu với Headquarters và một lượng tài nguyên ban đầu.

Sau đó:

1. Xây Power Plant.
2. Xây Barracks.
3. Xây War Factory.
4. Khai thác tài nguyên.
5. Sản xuất quân đội.
6. Trinh sát bản đồ.
7. Chiếm các vị trí chiến lược.
8. Tấn công hoặc phòng thủ.
9. Hoàn thành nhiệm vụ hoặc tiêu diệt căn cứ đối phương.

Thời lượng trận đấu mục tiêu: 20–35 phút.

## 3.2. Economy

Hai tài nguyên chính:

- Credits.
- Power.

Các công trình:

- Headquarters.
- Power Plant.
- Barracks.
- War Factory.
- Airfield.
- Research Center.

Cơ chế:
- Công trình có giá xây dựng.
- Công trình có thời gian xây dựng.
- Công trình tiêu thụ hoặc cung cấp Power.
- Credits được khai thác hoặc thu thập.
- Một số công trình mở khóa đơn vị và công nghệ mới.
- Headquarters bị phá hủy có thể dẫn đến thất bại tùy chế độ chơi.

## 3.3. Five Factions

### Faction 1: WESTERN ALLIANCE

Phong cách: Balanced Warfare.

Đơn vị:
- Modern Main Battle Tank.
- Mechanized Infantry.
- Attack Helicopter.
- Fighter Jet.
- Advanced Radar.
- Mobile Artillery.

Đặc điểm:
- Cân bằng.
- Linh hoạt.
- Phù hợp người mới.

### Faction 2: EASTERN LEGION

Phong cách: Heavy Firepower.

Đơn vị:
- Heavy Battle Tank.
- Rocket Artillery.
- Armored Infantry.
- Heavy APC.
- Long-range Missile System.

Đặc điểm:
- Hỏa lực mạnh.
- Chịu sát thương tốt.
- Di chuyển chậm hơn.

### Faction 3: PACIFIC TECHNOLOGY

Phong cách: Advanced Technology.

Đặc điểm:
- Công nghệ tiên tiến.
- UAV.
- Electronic Warfare.
- Precision Weapons.
- Advanced Defense.

### Faction 4: DESERT CORPS

Phong cách: Rapid Assault.

Đặc điểm:
- Di chuyển nhanh.
- Tấn công bất ngờ.
- Đơn vị cơ động.
- Guerrilla Warfare.

### Faction 5: IRON REPUBLIC

Phong cách: Defensive Warfare.

Đặc điểm:
- Công trình phòng thủ mạnh.
- Heavy Armor.
- Defensive Structures.
- Phòng thủ khu vực.

Mỗi faction phải có ưu điểm, nhược điểm và gameplay riêng. Không chỉ thay đổi màu sắc hoặc chỉ số.

## 3.4. Unit Categories

- Infantry.
- Armored Vehicles.
- Air Force.
- Artillery.
- Defensive Units.
- Naval Units: triển khai trong giai đoạn sau.

Mỗi unit cần có:
- Health.
- Armor.
- Damage.
- Attack Range.
- Movement Speed.
- Attack Speed.
- Production Cost.
- Production Time.
- Vision Range.
- Faction.
- Unit Type.

## 3.5. Combat

Hệ thống combat hỗ trợ:

- Select Unit.
- Move.
- Attack.
- Attack Move.
- Hold Position.
- Retreat.
- Patrol.
- Focus Fire.
- Group Selection.
- Unit Formation.
- Auto Attack.
- Target Priority.

Điều khiển hybrid:

Đơn vị có khả năng tự chiến đấu nhưng người chơi có thể ra lệnh chiến thuật.

## 3.6. Maps

MVP có hai bản đồ:

1. Desert Storm.
2. Urban Conflict.

Mỗi bản đồ cần:
- Terrain.
- Roads.
- Obstacles.
- Resource Nodes.
- Strategic Locations.
- Spawn Points.
- Base Locations.
- Pathfinding Grid.
- Fog of War.

Bản đồ phải là dữ liệu game thực tế, không phải một ảnh nền tĩnh.

---

# 4. AI SYSTEM

AI là một thành phần quan trọng của SHADOW FRONT.

Không sử dụng LLM API để điều khiển AI trong trận đấu.

Xây dựng AI bằng logic game thông thường:

- Finite State Machine.
- Behavior Tree.
- Utility Scoring.
- A* Pathfinding.
- Tactical Decision Making.

AI phải có khả năng:

1. Xây dựng căn cứ.
2. Quản lý tài nguyên.
3. Xây dựng Power Plant.
4. Xây Barracks.
5. Xây War Factory.
6. Sản xuất quân.
7. Trinh sát.
8. Phòng thủ.
9. Tấn công.
10. Rút lui khi cần thiết.
11. Bảo vệ căn cứ.
12. Tấn công các mục tiêu chiến lược.

AI phải tuân thủ cùng quy tắc tài nguyên, xây dựng và chiến đấu như người chơi.

AI không được nhìn xuyên Fog of War.

Các AI personalities:

- Rush.
- Fortress.
- Eagle.
- Shadow.
- Warlord.

Difficulty:

- Easy.
- Normal.
- Hard.
- Insane.

AI cần có khả năng mở rộng để phối hợp theo team trong chế độ Co-op và PvP.

---

# 5. MULTIPLAYER

Ưu tiên phát triển Co-op trước PvP.

Các chế độ:

### Co-op PvE
- 1–5 người chơi cùng đội.
- Đối đầu với AI.
- Có thể tạo team AI với nhiều mức độ khó.
- Người chơi có thể phối hợp xây dựng và chiến đấu.

### PvP
- 3v3.
- 5v5.
- Người chơi có thể tạo phòng.
- Mời bạn bè.
- Chọn faction.
- Chọn map.
- Chọn chế độ chơi.
- Thêm bot.
- Ready.
- Start Match.

### Human vs AI
- Một team người chơi đối đầu với một team AI.
- Có thể chọn số lượng AI.
- Chọn độ khó.
- Chọn faction cho AI.

Kiến trúc multiplayer:

- Server authoritative.
- Server là nguồn dữ liệu trạng thái trận đấu đáng tin cậy.
- Client gửi command, không tự quyết định kết quả combat.
- Server kiểm tra tính hợp lệ của command.
- Đồng bộ trạng thái bằng snapshot và delta.
- Có xử lý reconnect.
- Có kiểm soát tốc độ gửi command.
- Có cơ chế phát hiện các hành động không hợp lệ.

---

# 6. TECHNOLOGY STACK

Sử dụng TypeScript làm ngôn ngữ chính.

## Frontend

- React.
- TypeScript.
- Vite.
- Phaser 3.
- Tailwind CSS.
- Zustand nếu cần quản lý state UI.
- TanStack Query nếu cần quản lý dữ liệu API.

React chỉ phụ trách:
- Main Menu.
- Lobby.
- Room.
- Settings.
- HUD overlay.
- UI và các màn hình ngoài gameplay.

Phaser phụ trách:
- Game rendering.
- Camera.
- Terrain.
- Unit rendering.
- Animation.
- Selection.
- Game input.
- Gameplay visualization.

Game Core phải độc lập với React và Phaser.

Không để logic mô phỏng game phụ thuộc trực tiếp vào component React.

## Backend

- Node.js.
- TypeScript.
- NestJS.
- Socket.IO.
- PostgreSQL.
- Prisma.
- Redis.

Backend phụ trách:
- Authentication.
- Player.
- Room.
- Matchmaking.
- Multiplayer.
- Match Simulation.
- Economy Validation.
- Combat Validation.
- AI.
- Match Results.

## Game Core

Tạo package riêng:

packages/game-core

Chịu trách nhiệm:
- Entity.
- Component.
- Movement.
- Combat.
- Economy.
- Building.
- Production.
- Pathfinding.
- Fog of War.
- Game State.
- Simulation Tick.

Không phụ thuộc React, Phaser hoặc NestJS.

## AI

packages/game-ai

Chịu trách nhiệm:
- AI Controller.
- Behavior Tree.
- Decision Making.
- Resource Management.
- Base Building.
- Unit Production.
- Tactical Combat.
- Difficulty.
- AI Personality.

## Game Data

packages/game-data

Chứa dữ liệu cấu hình:
- Factions.
- Units.
- Buildings.
- Weapons.
- Maps.
- Technologies.
- Balance Config.

Ưu tiên config-driven design.

Không hardcode toàn bộ thông số gameplay vào component.

---

# 7. PROJECT STRUCTURE

Thiết kế monorepo như sau:

shadow-front/
│
├── apps/
│   ├── web/
│   │   └── React + Phaser
│   │
│   └── server/
│       └── NestJS
│
├── packages/
│   ├── game-core/
│   ├── game-ai/
│   ├── game-data/
│   └── shared-types/
│
├── assets/
│   ├── maps/
│   ├── units/
│   ├── buildings/
│   ├── effects/
│   ├── audio/
│   └── ui/
│
├── tools/
│   └── map-editor/
│
├── docs/
│   ├── MASTER_GAME_DEVELOPMENT.md
│   ├── GAME_DESIGN.md
│   ├── TECHNICAL_ARCHITECTURE.md
│   ├── GAMEPLAY_SYSTEMS.md
│   ├── AI_DESIGN.md
│   ├── MULTIPLAYER_DESIGN.md
│   ├── ART_ASSET_GUIDE.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── API_SPECIFICATION.md
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md

Nếu workspace đã có cấu trúc tương tự thì tái sử dụng, không tạo bản sao.

---

# 8. VISUAL DESIGN

Giao diện cần có phong cách quân sự hiện đại.

Main Menu:
- Logo SHADOW FRONT.
- Background chiến trường.
- Military vehicles.
- Smoke and lighting effects.
- Play.
- Multiplayer.
- Campaign.
- Settings.
- Exit.

Lobby:
- Danh sách người chơi.
- Faction selection.
- Map selection.
- Team assignment.
- Bot configuration.
- Difficulty selection.
- Ready status.
- Start Match.

In-game HUD:
- Minimap.
- Resources.
- Power.
- Unit Selection Panel.
- Building Panel.
- Production Queue.
- Command Buttons.
- Unit Information.
- Team Status.
- Game Timer.
- Pause Menu.

Visual quality:
- Hiện đại.
- Dễ đọc.
- Tối ưu cho màn hình desktop.
- Không lạm dụng hiệu ứng.
- Có hierarchy rõ ràng.
- Có thể mở rộng cho các màn hình sau này.

Nếu chưa có asset thật:
- Tạo placeholder phù hợp.
- Có thể dùng hình khối, SVG hoặc procedural graphics.
- Thiết kế asset loader để dễ thay thế.
- Không giả vờ rằng placeholder là asset production.
- Không tải asset không rõ giấy phép.

---

# 9. DEVELOPMENT ROADMAP

Phát triển theo thứ tự:

## PHASE 0 — FOUNDATION

- Kiểm tra workspace.
- Thiết kế monorepo.
- Tạo package management.
- Thiết lập TypeScript.
- Thiết lập lint.
- Thiết lập build.
- Hoàn thiện docs.
- Tạo README.

## PHASE 1 — ISOMETRIC GAME PROTOTYPE

- React application.
- Phaser integration.
- Isometric coordinate system.
- Isometric terrain.
- Camera pan.
- Camera zoom.
- Map boundaries.
- Unit rendering.
- Unit selection.
- Mouse interaction.

Kết quả phải là một prototype chạy được trên browser.

## PHASE 2 — UNIT MOVEMENT

- Movement system.
- Grid.
- A* pathfinding.
- Obstacle.
- Unit destination.
- Unit movement animation.
- Basic collision avoidance.

## PHASE 3 — ECONOMY AND BUILDING

- Credits.
- Power.
- Headquarters.
- Power Plant.
- Barracks.
- War Factory.
- Building placement.
- Building construction.
- Production queue.

## PHASE 4 — COMBAT

- Unit health.
- Weapon.
- Attack range.
- Target selection.
- Projectile.
- Damage.
- Destruction.
- Attack Move.
- Hold Position.

## PHASE 5 — AI

- AI controller.
- AI economy.
- AI base building.
- AI production.
- AI scouting.
- AI defense.
- AI attack.
- Difficulty.

## PHASE 6 — LOBBY

- Create room.
- Join room.
- Leave room.
- Player list.
- Team assignment.
- Faction selection.
- Map selection.
- Bot configuration.
- Ready state.

## PHASE 7 — MULTIPLAYER CO-OP

- NestJS gateway.
- Socket.IO.
- Match lifecycle.
- Server-authoritative simulation.
- Command validation.
- State synchronization.
- Reconnect.
- AI opponents.

## PHASE 8 — PVP

- 3v3.
- 5v5.
- Team management.
- Competitive balancing.
- Match result.
- Disconnect handling.

## PHASE 9 — POLISH

- Graphics.
- Animations.
- Effects.
- Sound.
- Performance.
- UI.
- Testing.
- Deployment.

Không được cố gắng implement tất cả các phase trong một lần.

---

# 10. NHIỆM VỤ THỰC HIỆN NGAY BÂY GIỜ

Bạn phải bắt đầu thực hiện công việc theo trình tự dưới đây.

## TASK A — INSPECT PROJECT

- Đọc toàn bộ `docs/MASTER_GAME_DEVELOPMENT.md`.
- Kiểm tra project hiện tại.
- Kiểm tra các folder đã tồn tại.
- Kiểm tra Node.js và package manager.
- Xác định file nào cần giữ lại.
- Không xóa tài liệu hiện có.

## TASK B — COMPLETE DOCUMENTATION

Tạo hoặc hoàn thiện các file:

- docs/GAME_DESIGN.md
- docs/TECHNICAL_ARCHITECTURE.md
- docs/GAMEPLAY_SYSTEMS.md
- docs/AI_DESIGN.md
- docs/MULTIPLAYER_DESIGN.md
- docs/ART_ASSET_GUIDE.md
- docs/DEVELOPMENT_ROADMAP.md
- docs/API_SPECIFICATION.md

Các tài liệu phải:
- Viết bằng tiếng Anh kỹ thuật rõ ràng.
- Nội dung chi tiết.
- Có mục tiêu, phạm vi và acceptance criteria.
- Thống nhất với MASTER_GAME_DEVELOPMENT.md.
- Không sao chép máy móc toàn bộ master document.
- Không tự ý thay đổi thiết kế đã thống nhất.

## TASK C — INITIALIZE PROJECT

Khởi tạo monorepo với pnpm workspace.

Tạo:
- Root package.json.
- pnpm-workspace.yaml.
- tsconfig.base.json.
- ESLint configuration.
- Prettier configuration nếu phù hợp.
- .gitignore.
- README.md.

Tạo các workspace:
- apps/web.
- apps/server.
- packages/game-core.
- packages/game-ai.
- packages/game-data.
- packages/shared-types.

Thiết lập TypeScript path/build phù hợp để các package có thể sử dụng lẫn nhau.

Ưu tiên cấu hình đơn giản, ổn định, không lạm dụng công cụ.

## TASK D — IMPLEMENT FIRST PLAYABLE PROTOTYPE

Sau khi foundation hoàn thành, triển khai PHASE 1.

Tạo một browser-based RTS prototype với:

### Game Scene

- Isometric battlefield.
- Kích thước map đủ lớn để camera di chuyển.
- Terrain có phân biệt khu vực.
- Có đường đi và vật cản.
- Có vị trí căn cứ ban đầu.
- Có các ô lưới hoặc hệ thống tọa độ để phục vụ pathfinding sau này.

### Camera

- Pan bằng WASD hoặc phím mũi tên.
- Pan bằng kéo chuột phù hợp.
- Zoom bằng scroll wheel.
- Giới hạn camera trong phạm vi map.

### Units

Tạo một số unit placeholder:

- Main Battle Tank.
- Infantry.
- Armored Vehicle.

Mỗi unit có:
- ID.
- Position.
- Faction.
- Health.
- Selection state.
- Movement speed.
- Unit type.

Dùng hình ảnh hoặc graphics placeholder có phân biệt rõ ràng.

### Interaction

- Click chọn một unit.
- Có viền hoặc vòng tròn thể hiện unit đang được chọn.
- Click vào vị trí khác để ra lệnh di chuyển.
- Hiển thị đường đi hoặc điểm đến.
- Có thể chọn nhiều unit bằng kéo chuột nếu không làm ảnh hưởng đến các thao tác khác.
- Không để click vào HUD gây ra lệnh di chuyển trong game.

Lưu ý: Trong Phase 1, movement có thể sử dụng logic đơn giản nếu A* chưa được triển khai. Nhưng phải tổ chức code để có thể thay bằng pathfinding ở Phase 2.

### UI

Tạo một HUD cơ bản:

- Logo SHADOW FRONT.
- Credits.
- Power.
- Minimap placeholder.
- Selected Unit Panel.
- Command Panel.
- Game Menu.

Thiết kế theo phong cách modern military RTS.

### React và Phaser

- React quản lý UI.
- Phaser quản lý game scene.
- Không nhét toàn bộ game logic vào React.
- Không tạo nhiều Phaser Game instance khi React re-render.
- Quản lý vòng đời Phaser đúng cách.
- Cleanup event và game instance khi unmount.
- Thiết kế giao tiếp React ↔ Phaser rõ ràng.

## TASK E — VALIDATION

Sau khi triển khai:

1. Cài đặt dependencies.
2. Chạy TypeScript check.
3. Chạy ESLint nếu đã cấu hình.
4. Chạy production build.
5. Sửa lỗi phát sinh.
6. Kiểm tra các import giữa workspace.
7. Kiểm tra browser runtime nếu có công cụ hỗ trợ.
8. Đảm bảo lệnh chạy development hoạt động.

Không báo hoàn thành nếu build vẫn lỗi.

---

# 11. CODING STANDARDS

- TypeScript strict mode.
- Tránh sử dụng any.
- Không viết toàn bộ logic vào một file.
- Tách game systems theo trách nhiệm.
- Dùng interfaces và types rõ ràng.
- Config-driven gameplay.
- Không hardcode dữ liệu gameplay rải rác.
- Ưu tiên composition.
- Hạn chế global mutable state.
- Không phụ thuộc trực tiếp vào DOM trong game core.
- Không để React component xử lý simulation.
- Không tạo circular dependencies.
- Có error handling.
- Có logging phù hợp.
- Có comment cho thuật toán phức tạp.
- Code dễ bảo trì và mở rộng.

---

# 12. DEFINITION OF DONE

Trong lần thực hiện này, mục tiêu bắt buộc là:

1. Đã đọc và hiểu master document.
2. Đã tạo hoặc hoàn thiện bộ documentation.
3. Đã khởi tạo monorepo.
4. Đã thiết lập React + TypeScript + Vite.
5. Đã tích hợp Phaser 3.
6. Đã có bản đồ isometric.
7. Camera hoạt động.
8. Có ít nhất ba loại unit placeholder.
9. Chọn được unit.
10. Ra lệnh di chuyển được.
11. Có HUD cơ bản.
12. Có lệnh chạy development.
13. TypeScript check thành công.
14. Production build thành công.

Chưa yêu cầu hoàn thành multiplayer, AI hoặc toàn bộ game trong lần đầu tiên.

---

# 13. CÁCH BÁO CÁO SAU KHI THỰC HIỆN

Khi hoàn thành, báo cáo:

### 1. Project Structure
Những thư mục và file đã tạo.

### 2. Documentation
Những tài liệu đã hoàn thiện.

### 3. Implemented Features
Những tính năng thực sự đã hoạt động.

### 4. Technology
Các công nghệ và dependencies đã sử dụng.

### 5. Validation
Kết quả:
- TypeScript.
- ESLint.
- Build.
- Runtime test nếu có.

### 6. How to Run
Hướng dẫn chạy project cụ thể.

### 7. Remaining Tasks
Những việc chưa hoàn thành và lý do.

### 8. Next Phase
Đề xuất công việc tiếp theo, ưu tiên Phase 2.

---

# FINAL INSTRUCTION

Bắt đầu bằng việc đọc `docs/MASTER_GAME_DEVELOPMENT.md` và kiểm tra toàn bộ workspace.

Sau đó tự động thực hiện TASK A → TASK B → TASK C → TASK D → TASK E.

Không chỉ đưa ra kế hoạch.

Không chỉ viết code mẫu trong câu trả lời.

Hãy trực tiếp tạo và chỉnh sửa file trong workspace, cài dependencies, chạy kiểm tra và sửa lỗi.

Ưu tiên tạo ra một SHADOW FRONT prototype thực sự có thể chạy trên trình duyệt, thay vì tạo một lượng lớn code chưa hoạt động.

Hãy hành động như Technical Lead chịu trách nhiệm đưa dự án từ tài liệu thiết kế thành một sản phẩm game có thể chơi được.