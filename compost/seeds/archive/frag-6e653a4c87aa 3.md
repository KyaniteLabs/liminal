# frag-6e653a4c87aa

**Score:** 4.017755371598206

## Tech Stack

### Frontend Core

**Framework:** None (Vanilla TypeScript with optional React for UI only)
- **Version:** TypeScript 5.7+
- **Why:** Maximum performance for game loop; React only for non-game UI (menus, settings, modals)

**Build Tool:** Vite 6.x
- **Why:** Fastest HMR (<100ms), native ESM, optimized production builds
- **Config:** `vite.config.ts` with code splitting for lazy loading

**Package Manager:** pnpm 9.x
- **Why:** 3x faster than npm, efficient disk space, strict dependency resolution

### Rendering Engine

**Library:** PixiJS v8.5+
- **Purpose:** 2D WebGL rendering for game world
- **Features used:**
  - Sprite batching for performance
  - Particle systems (cell trails, environment effects)
  - Custom shaders for glow effects
  - Graphics API for procedural shapes
  - Container hierarchy for scene management
- **Canvas size:** Dynamic (scales to viewport)
- **Render resolution:** Auto-detects device pixel ratio

### Physics Engine

**Library:** Matter.js v0.20+
- **Purpose:** 2D rigid body physics for cell/creature movement
- **Features used:**
  - Collision detection (AABB with spatial hashing)
  - Velocity/force simulation
  - Constraints for creature joints (Phase 2)
- **Performance:** Optimized with sleeping bodies for inactive entities

### Data Visualization

**Library:** D3.js v7.9+
- **Purpose:** Scientific data visualizations (evolution trees, population graphs, trait charts)
- **Charts needed:**
  - Line chart: Population over time
  - Tree diagram: Evolutionary lineage
  - Radar chart: Creature trait analysis
  - Bar chart: Resource levels (ATP, glucose, etc.)
  - Heatmap: Biome fitness analysis

### State Management

**Library:** Zustand v4.5+
- **Purpose:** Centralized game state management
- **Why:** Minimal API, no boilerplate, perfect for game loops
- **Store structure:**
```typescript
{
  gameState: 'menu' | 'playing' | 'paused' | 'editing',
  simulation: { speed: 1 | 10 | 100 | 1000, generation: number },
  playerSpecies: Species,
  aiSpecies: Species[],
  entities: Map<string, Entity>,
  environment: BiomeMap,
  ui: UIState,
  settings: GameSettings
}
```

### Database

**Type:** IndexedDB with Dexie.js v4.0+
- **Purpose:** Browser-native persistent storage
- **Why:** Fast, works offline, no server needed, 50MB+ storage per origin
- **Schema:**
  - `creatures` table: id, genome, stats, createdAt, generation
  - `evolutionHistory` table: id, speciesId, generation, population, traits
  - `saves` table: id, name, gameState, timestamp
  - `settings` table: key-value config

### Development Tools

**Linter:** ESLint v9.x with TypeScript plugin
**Formatter:** Prettier v3.x
**Type Checking:** TypeScript strict mode enabled
**Testing:** Vitest v2.x (unit tests), Playwright v1.x (E2E tests)

### Infrastructure

**Hosting:** Vercel (primary) / Netlify (backup)
- **Why:** Zero-config deployment, instant global CDN, automatic HTTPS, great DX
- **Build command:** `pnpm build`
- **Output directory:** `dist/`

**CI/CD:** GitHub Actions
- **Triggers:** Push to main, PR creation
- **Jobs:** Lint, type check, unit tests, build, deploy preview

**Analytics:** Umami (privacy-friendly, self-hosted optional)

---

---

Sources: text
Collision: heuristic
Promoted: 2026-03-21T06:55:19.763Z
