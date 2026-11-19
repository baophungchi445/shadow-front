# SHADOW FRONT — Art & Asset Guide

## 1. Visual direction

Stylized realism, modern military, 2.5D isometric (2:1 diamond, 64×32 px tiles). Dark graphite UI with military green highlights and subtle orange warnings. **Not** pixel art, cartoon, anime or flat icons on the battlefield.

## 2. Current status — PLACEHOLDERS

The current build renders all battlefield objects **procedurally** with Phaser Graphics (isometric prisms for buildings, hull + turret shapes for vehicles, figures for infantry, rotor discs for helicopters). These are placeholders and **must not be presented as production art**. They exist so gameplay can be developed and the asset loader can later swap them for sprites.

## 3. Folder & naming convention

```text
assets/
  units/<faction>/<unit-id>/<unit-id>_<state>_<dir>.png     e.g. main-battle-tank_move_se.png
  buildings/<building-id>/<building-id>_<state>.png         states: construction, idle, damaged, destroyed
  maps/<map-id>/          (reference art only; playable maps are Tiled JSON in packages/game-data/src/maps/)
  effects/{explosions,muzzle-flash,projectiles,smoke}/
  audio/{sfx,music}/
  ui/{icons,buttons,panels,backgrounds}/
```

IDs are kebab-case and match `game-data` ids.

## 4. Manifest

Every asset must be registered in `assets/manifest.json`:

```json
{
  "id": "unit.western.main-battle-tank.move",
  "file": "units/western/main-battle-tank/main-battle-tank_move_se.png",
  "category": "unit",
  "faction": "western",
  "width": 128,
  "height": 96,
  "frames": 8,
  "state": "move",
  "license": "CC0 / generated in-house",
  "transparent": true
}
```

## 5. Requirements

- Units: idle, move, attack, hit, destroy; 8 directions where feasible; consistent frame size.
- Buildings: construction, idle, damaged, destroyed.
- Effects: muzzle flash, bullet, missile, explosion, smoke, fire, impact.
- Transparent background, consistent light from top-left.
- License documented for every file. Never use unlicensed internet images.

## 6. Generation prompts

Use the prompts in `MASTER_GAME_DEVELOPMENT.md` §5.4–5.10. Generated images are references or sprite sources; playable maps are data (`game-data/maps`), never a single painted image.

## 7. Acceptance criteria

- Every non-placeholder asset appears in the manifest with license info.
- Replacing a placeholder requires only adding the sprite + manifest entry (renderer looks up by id).
