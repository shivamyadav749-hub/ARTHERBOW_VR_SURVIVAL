# AetherBow VR — Quest Archery & Ballistics Suite

An interactive 3D and WebXR VR archery survival simulation built with **React**, **TypeScript**, **Three.js**, and **Tailwind CSS**, paired with a built-in **28-script Unity Meta Quest C# Inspector** for porting bow mechanics, spatial audio, haptics, enemy AI, and stamina systems into Unity XR Interaction Toolkit projects.

---

## Features

- **3D & WebXR VR Archery Simulation**: Real-time Three.js combat arena with WebXR stereo headset support (`webxrVrRig.ts`), virtual IPD and dominant-eye calibration, and string-hand anchor offset controls.
- **Aerodynamic Ballistics & Trajectory Preview**: Draw-length tension physics, gravity/drag coefficients per arrow type, crosswind drift, parabolic arc previews, and live telemetry (draw %, velocity, flight distance, active projectiles).
- **5 Specialized Arrow Types (`1`–`5`)**:
  - **Carbon Broadhead (`1`)** — High-velocity precision shaft built for `2.5x` critical headshots.
  - **Thermite Detonator (`2`)** — Ordnance arrow with a `5.5m` AoE blast wave that bypasses raised shields.
  - **Cryo-Frost Shard (`3`)** — Sub-zero shaft slowing charging and ranged enemies by `88%` for `6s`.
  - **Volt-Arc Seeker (`4`)** — Plasma-tipped arrow that arcs across up to `2` nearby enemies within `10.5m`.
  - **Chrono-Split Volley (`5`)** — Splits mid-flight into `3` phase-locked arrows to break phalanx formations.
- **50-Level Survival Campaign (5 Seasons)**:
  - Progress from *Alpine Dawn* through *Emerald Valley*, *Crimson Dusk*, *Frostbound Peak*, and *Eclipse Summit* against Shield Hoplites, Javelineers, and Centurions with localized hitboxes (`head` `2.5x`, `torso` `1.0x`, `limb` `0.65x`, `shield` `0x` block).
- **Ancient Armory & Defense Stats**: Spend earned campaign coins on 5 armor pieces and 5 helmets (scaling max HP and damage reduction) with instant repair (`R`) and emergency medkit (`H`) mechanics.
- **Multi-Touch Mobile Controls**: Responsive portrait/landscape HUD with a virtual movement joystick, auto-sprint / Sprint Lock, Hold-to-Draw trigger with radial tension ring, Cancel Shot gesture, crouch toggle, and touch swipe-to-aim sensitivity calibration.
- **Procedural Web Audio Engine**: Synthesized bowstring draw creaks, release snaps, spatial arrow whooshes, impact textures, and UI feedback with zero external audio assets required.
- **28 Production Unity Meta Quest C# Scripts**: In-app code inspector (`C`) with copyable C# modules covering XR bow interaction, ballistics, penetration, wind, dynamic sights, enemy NavMesh AI, non-stop wave spawning, haptics, spatial audio, and bow stamina.

---

## Controls

### Desktop (Keyboard & Mouse)
| Input | Action |
| --- | --- |
| `W A S D` / Arrow Keys | Move |
| `Shift` | Sprint |
| `X` / `Q` | Crouch & take cover |
| `Mouse Move` | Aim |
| `Hold Left Click` / `Space` | Draw & release arrow |
| `1` – `5` / `Mouse Wheel` | Switch arrow type |
| `H` / `R` / `M` | Use Medkit / Repair Armor / Toggle Mute |
| `I` / `L` / `K` / `C` | Armory / Campaign Levels / Calibration / Unity C# Scripts |
| `Esc` | Pause / Resume |

### Mobile & Tablet (Touch)
- **Left Thumb Zone**: Virtual analog joystick with auto-sprint threshold and Sprint Lock toggle.
- **Right Thumb Zone**: Hold-to-Draw bow trigger with radial draw tension gauge, fine-aim drag, Cancel Shot button, Crouch toggle, and Center View button.
- **Viewport Swipe**: Swipe anywhere outside controls to look around (configurable in Calibration settings).

### VR Headset (WebXR)
- Click **Enter VR Headset** to launch WebXR stereo mode with tracked dual controllers, controller-driven nocking/drawing, and diegetic HUD telemetry.

---

## Included Unity C# Scripts (`src/data/unityScripts.ts`)

The in-app **Unity C# Inspector** includes 28 ready-to-adapt C# files under `namespace MetaQuestArchery`:

1. `ArrowTypeData.cs`
2. `VRArrowQuiverInventory.cs`
3. `VRBowController.cs`
4. `VRArrowProjectile.cs`
5. `VRPlayerRigCalibration.cs`
6. `VRArcherySpatialAudio.cs`
7. `TrajectoryPreviewGenerator.cs`
8. `ArmoredEnemyAI.cs`
9. `EnemyHitboxZone.cs`
10. `PlayerHealthDiegeticUI.cs`
11. `SurvivalCampaignAndArmory.cs`
12. `VRPlayerLocomotionAndCover.cs`
13. `HitboxDebugger.cs`
14. `VibrationController.cs`
15. `ArrowPenetration.cs`
16. `WindEffectController.cs`
17. `HitboxMultiplier.cs`
18. `QuiverManager.cs`
19. `ProjectileTrailManager.cs`
20. `VRSmoothLocomotion.cs`
21. `DynamicSightController.cs`
22. `BowScopeStabilizer.cs`
23. `ImpactParticleManager.cs`
24. `EnemyPathfinding.cs`
25. `EnemyWaveController.cs`
26. `VrHapticController.cs`
27. `VrHapticAndAudio.cs`
28. `BowStaminaController.cs`

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **3D & XR**: Three.js, WebXR Device API
- **UI & Motion**: Lucide React, Motion
- **Tooling**: Vite 8

---

## Local Development

### Prerequisites
- Node.js 20+
- npm or bun

### Setup & Commands

```bash
# Install dependencies
npm install

# Start development server on port 3000
npm run dev

# Type-check with TypeScript
npm run lint

# Build production bundle
npm run build

# Preview production build
npm run preview
```

### Environment Variables
Copy `.env.example` if configuring optional runtime variables:
- `GEMINI_API_KEY` — Optional Gemini API key if extending AI capabilities.
- `APP_URL` — Hosted application URL.

---

## Project Structure

```text
├── index.html
├── metadata.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── LICENSE
├── README.md
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── index.css
    ├── audio/
    │   └── soundEngine.ts
    ├── components/
    │   ├── ArcheryCanvas.tsx
    │   ├── ArmoryModal.tsx
    │   ├── LevelSelectModal.tsx
    │   ├── MobileControlsOverlay.tsx
    │   ├── SettingsModal.tsx
    │   └── UnityScriptModal.tsx
    ├── data/
    │   ├── armoryData.ts
    │   ├── campaignLevels.ts
    │   └── unityScripts.ts
    ├── three/
    │   ├── proceduralModels.ts
    │   ├── proceduralTextures.ts
    │   └── webxrVrRig.ts
    └── types/
        └── archery.ts
```

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.
