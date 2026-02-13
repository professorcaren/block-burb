## Developer Build Memo

**Project:** Block ’Burb
**Client:** Intro Sociology Classroom Tool
**Author:** Neal Caren
**Purpose:** Functional prototype for classroom gameplay + sociological debrief

---

# 1. Project Overview

**Block ’Burb** is a swipe-based spatial puzzle game inspired by 2048 mechanics but designed to simulate residential segregation dynamics.

Primary pedagogical goal:

> Demonstrate how mild individual preferences + structural rules produce segregated outcomes — even without explicit prejudice.

This is not a commercial game. It is a classroom simulation tool optimized for:

* Short play sessions (5–10 minutes)
* Immediate visual feedback
* End-screen analytical debrief

---

# 2. Core Gameplay Framework

## Grid

* Size: Configurable (default 5×5)
* Each cell holds 0 or 1 tile
* Grid state stored as 2D array

```json
{
  "row": 0,
  "col": 0,
  "tile_type": "household_blue",
  "locked": false,
  "merged": false
}
```

---

## Tile Types

### Households

| Type     | Color  | Description             |
| -------- | ------ | ----------------------- |
| Majority | Blue   | Dominant population     |
| Minority | Orange | Marginalized population |

Spawn ratio adjustable via config:

```js
spawnRatio = {
  blue: 0.9,
  orange: 0.1
}
```

Ratio should be able to shift over time.

---

### Institutional Tiles (Phase 2, but plan architecture now)

| Tile              | Color     | Function             |
| ----------------- | --------- | -------------------- |
| Commercial/Public | Green     | Anchor / stabilizer  |
| Community Center  | Purple    | Integration bonus    |
| Gated Community   | Dark Blue | Stability, low score |

---

# 3. Movement Mechanics

Swipe controls:

* Up
* Down
* Left
* Right

Behavior:

* All tiles slide until collision
* Identical merge rules evaluated after movement
* Locked tiles do **not move**

Movement order should follow standard 2048 resolution logic to avoid overlap bugs.

---

# 4. Happiness / Constraint Mechanics

## 4.1 Token Isolation Lock

Trigger condition:

A tile becomes **locked** if:

* It is the only tile of its color in its row **AND**
* The only tile of its color in its column

Effect:

* Tile cannot move
* Functions as a wall

Unlock condition:

* A same-color tile enters its row or column

Visuals:

* Grey overlay
* Padlock icon

This mechanic is essential — do not deprioritize.

---

## 4.2 Tipping Point / Flight

Trigger threshold (configurable):

```js
tippingThreshold = 0.30
```

Measured within:

* Row
* Column
* 2×2 sector (configurable which unit we use)

When minority share exceeds threshold:

### Flight Event

Options (build as toggles for testing):

**Version A — Deterministic**

* 50% majority tiles relocate to farthest edge

**Version B — Probabilistic (preferred)**

* Each majority tile has X% chance of fleeing

Flight behaviors:

* Despawn OR
* Relocate to edge OR
* Convert to suburban tile (future expansion)

Animation needed for clarity.

---

# 5. Merge Mechanics

## Same-Color Merge

Result: **Gated Community**

Properties:

* Immune to flight
* Occupies 1 tile
* Low score yield
* Cannot merge again

---

## Mixed-Color Merge

Result: **Community Center**

Properties:

* Prevents flight in adjacent tiles
* Generates integration bonus
* Hard to create

Adjacency radius: configurable (default = 1 tile)

---

# 6. Scoring System

Scoring runs per turn.

## Integration Score

For each row:

If diversity balance is between:

```js
0.30 ≤ minority_share ≤ 0.70
```

→ Award integration points.

## Segregation Outcome

If row = 100% single color:

→ 0 points

If entire board segregates:

→ Show warning but allow play to continue.

---

# 7. Spawn Logic

After each turn:

* Spawn 1 new household tile
* Select empty cell randomly
* Use demographic ratio

Future expansion:

* Time-based demographic shifts
* Policy scenarios

---

# 8. Game Over Conditions

Game ends when:

* No legal moves remain
* Board fully locked
* Or player manually ends session

---

# 9. End-Game Debrief Screen

This is not cosmetic — it’s pedagogically central.

Display:

### 1. Final Map

Player’s city layout

### 2. Segregation Index

Simple metric:

```js
segregation_score = % same-color adjacency
```

### 3. Integration Turns Survived

How long diversity thresholds were maintained

### 4. Comparison Map

Auto-generated “natural equilibrium” map

---

# 10. Visual Design Notes

Keep visuals schematic, not realistic.

Avoid:

* Houses
* Faces
* Cultural signifiers

Use abstract tiles to avoid stereotyping concerns.

Color palette:

* Blue / Orange households
* Green institutional
* Purple integration anchors

---

# 11. Technical Stack (Flexible)

Prototype recommendations:

* HTML5 Canvas or SVG
* JavaScript (Vanilla or React)
* Mobile swipe + desktop arrow keys

Performance requirements minimal.

---

# 12. Configurability Requirements

All sociological parameters must be adjustable via config:

* Grid size
* Spawn ratios
* Tipping thresholds
* Flight probability
* Integration scoring band

This allows classroom scenario variation.

---

# 13. Minimum Viable Prototype (Phase 1)

Must include:

* Grid movement
* Tile spawning
* Token locking
* Basic tipping flight
* Integration scoring
* End-screen map

Do **not** build institutional tiles yet if it slows delivery.

---

# 14. Phase 2 Expansion

After classroom testing:

* Institutional actors
* Policy levers
* School funding effects
* Transit nodes
* Redlining overlays

---

# 15. Success Criteria

Prototype is successful if:

* Students can learn mechanics in <2 minutes
* Game sessions last 5–10 minutes
* Segregation emerges without instruction
* Debrief discussion triggers structural explanations

---

# Deliverable

Working browser prototype deployable via URL for classroom projection and student devices.

